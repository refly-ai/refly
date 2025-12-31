import { useRef } from 'react';
import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Tooltip, Popover, message, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@refly/utils/cn';
import {
  useListSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useGetCreditUsageByCanvasId,
} from '@refly-packages/ai-workspace-common/queries';
import { useSkillResponseLoadingStatus } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-loading-status';
import { useCanvasStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import type { WorkflowSchedule, ListSchedulesResponse } from '@refly/openapi-schema';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { LuAlarmClock } from 'react-icons/lu';
import {
  SchedulePopoverContent,
  parseScheduleConfig,
  generateCronExpression,
  type ScheduleFrequency,
  type ScheduleConfig,
} from '@refly-packages/ai-workspace-common/components/common/schedule-popover-content';
import './index.scss';

dayjs.extend(utc);
dayjs.extend(timezone);

interface ScheduleButtonProps {
  canvasId: string;
}

const ScheduleButton = memo(({ canvasId }: ScheduleButtonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scheduleLimitModalVisible, setScheduleLimitModalVisible] = useState(false);
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Local state for popover form
  const [schedule, setSchedule] = useState<WorkflowSchedule | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(dayjs('08:00', 'HH:mm'));

  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);

  // Get subscription plan type and credit insufficient modal setter
  const { planType, setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));

  // API mutations
  const listSchedulesMutation = useListSchedules();
  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  // State for total enabled schedules count
  const [totalEnabledSchedules, setTotalEnabledSchedules] = useState(0);
  const [isLoadingScheduleCount, setIsLoadingScheduleCount] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  // Calculate schedule quota based on plan type
  const scheduleQuota = useMemo(() => {
    return planType === 'free' ? 1 : 20;
  }, [planType]);

  // Get execution status for validation
  const { nodeExecutions } = useCanvasStoreShallow((state) => ({
    nodeExecutions: state.canvasNodeExecutions[canvasId] ?? [],
  }));

  const executionStats = useMemo(() => {
    const total = nodeExecutions.length;
    const executing = nodeExecutions.filter((n) => n.status === 'executing').length;
    const waiting = nodeExecutions.filter((n) => n.status === 'waiting').length;
    return { total, executing, waiting };
  }, [nodeExecutions]);

  const { isLoading: skillResponseLoading, skillResponseNodes } =
    useSkillResponseLoadingStatus(canvasId);

  // Credit usage query
  const { data: creditUsageData, isLoading: isCreditUsageLoading } = useGetCreditUsageByCanvasId(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: !!canvasId,
    },
  );

  const toolbarLoading =
    executionStats.executing > 0 || executionStats.waiting > 0 || skillResponseLoading;

  const disabled = useMemo(() => {
    return toolbarLoading || !skillResponseNodes?.length;
  }, [toolbarLoading, skillResponseNodes]);

  // Fetch all enabled schedules count
  const fetchAllEnabledSchedulesCount = useCallback(async () => {
    try {
      setIsLoadingScheduleCount(true);
      const result = await listSchedulesMutation.mutateAsync({
        body: {
          // Don't pass canvasId to get all schedules for the user
          page: 1,
          pageSize: 1000, // Get a large number to count all
        },
      });

      const response = result as ListSchedulesResponse;
      let schedules: any[] = [];

      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        const nestedData = (response.data as any).data;
        schedules = nestedData?.items || [];
      } else if (Array.isArray(response.data)) {
        schedules = response.data;
      }

      // Count only enabled schedules
      const enabledCount = schedules.filter((schedule: any) => schedule.isEnabled === true).length;
      setTotalEnabledSchedules(enabledCount);
    } catch (error) {
      console.error('Failed to fetch all schedules count:', error);
      setTotalEnabledSchedules(0);
    } finally {
      setIsLoadingScheduleCount(false);
      setHasLoadedInitially(true);
    }
  }, []); // Remove listSchedulesMutation from dependencies to prevent infinite loop

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    if (!canvasId) return;

    try {
      const result = await listSchedulesMutation.mutateAsync({
        body: {
          canvasId: canvasId,
          page: 1,
          pageSize: 1,
        },
      });

      // Get the first schedule for this canvas if it exists
      const response = result as ListSchedulesResponse;

      // fix data parsing: the data is in a nested structure
      // response.data.data.items is the actual schedule tasks array
      let schedules: any[] = [];

      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        // nested structure: response.data.data.items
        const nestedData = (response.data as any).data;
        schedules = nestedData?.items || [];
      } else if (Array.isArray(response.data)) {
        // direct array structure: response.data (backup compatibility)
        schedules = response.data;
      }

      const currentSchedule = schedules.length > 0 ? schedules[0] : null;
      setSchedule(currentSchedule);

      if (currentSchedule) {
        const config = parseScheduleConfig(currentSchedule.scheduleConfig);
        const serverTime = config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm');
        const currentTimeStr = timeValue?.format('HH:mm') ?? '';
        const serverTimeStr = serverTime.format('HH:mm');

        setIsEnabled(currentSchedule.isEnabled ?? false);
        setFrequency(config?.type || 'daily');

        // Only update timeValue if it's actually different to prevent infinite loop
        // Compare as strings to avoid dayjs object reference issues
        if (currentTimeStr !== serverTimeStr) {
          setTimeValue(serverTime);
        }

        // Only update weekdays/monthDays if they're actually different
        const serverWeekdays = config?.weekdays || [1];
        const serverMonthDays = config?.monthDays || [1];
        const currentWeekdaysStr = JSON.stringify(weekdays.sort());
        const currentMonthDaysStr = JSON.stringify(monthDays.sort());
        const serverWeekdaysStr = JSON.stringify(serverWeekdays.sort());
        const serverMonthDaysStr = JSON.stringify(serverMonthDays.sort());

        if (currentWeekdaysStr !== serverWeekdaysStr) {
          setWeekdays(serverWeekdays);
        }
        if (currentMonthDaysStr !== serverMonthDaysStr) {
          setMonthDays(serverMonthDays);
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setSchedule(null);
    }
  }, [canvasId]); // Remove listSchedulesMutation from dependencies to prevent infinite loop

  // Fetch schedule data on mount and when canvasId changes
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Fetch all enabled schedules count on mount only
  useEffect(() => {
    fetchAllEnabledSchedulesCount();
  }, []); // Run only once on mount

  // Reset state when popover opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    // Only handle closing, opening is handled by handleButtonClick
    if (!newOpen) {
      setOpen(false);
    }
  }, []);

  // Auto save function (without validation for enabled state)
  const autoSave = useCallback(
    async (enabled: boolean) => {
      if (!timeValue) return;

      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timeStr = timeValue.format('HH:mm');
        const scheduleConfig: ScheduleConfig = {
          type: frequency,
          time: timeStr,
          ...(frequency === 'weekly' && { weekdays }),
          ...(frequency === 'monthly' && { monthDays }),
        };

        const cronExpression = generateCronExpression(scheduleConfig);
        const scheduleConfigStr = JSON.stringify(scheduleConfig);

        const requestData = {
          canvasId,
          name: `Schedule for ${canvasId}`,
          cronExpression,
          scheduleConfig: scheduleConfigStr,
          timezone: userTimezone,
          isEnabled: enabled,
        };
        if (schedule?.scheduleId) {
          await updateScheduleMutation.mutateAsync({
            body: {
              scheduleId: schedule.scheduleId,
              ...requestData,
            },
          });
        } else {
          await createScheduleMutation.mutateAsync({
            body: requestData,
          });
        }

        // Refresh the total count after saving
        // Call it directly to avoid dependency loop issues
        try {
          setIsLoadingScheduleCount(true);
          const countResult = await listSchedulesMutation.mutateAsync({
            body: {
              page: 1,
              pageSize: 1000,
            },
          });

          const response = countResult as ListSchedulesResponse;
          let schedules: any[] = [];

          if (response.data && typeof response.data === 'object' && 'data' in response.data) {
            const nestedData = (response.data as any).data;
            schedules = nestedData?.items || [];
          } else if (Array.isArray(response.data)) {
            schedules = response.data;
          }

          const enabledCount = schedules.filter(
            (schedule: any) => schedule.isEnabled === true,
          ).length;
          setTotalEnabledSchedules(enabledCount);
        } catch (countError) {
          console.error('Failed to refresh schedule count:', countError);
        } finally {
          setIsLoadingScheduleCount(false);
          setHasLoadedInitially(true);
        }
      } catch (error) {
        console.error('Failed to auto save schedule:', error);
        message.error(t('schedule.saveFailed') || 'Failed to save schedule');
      }
    },
    [
      canvasId,
      schedule?.scheduleId,
      frequency,
      timeValue,
      weekdays,
      monthDays,
      createScheduleMutation,
      updateScheduleMutation,
      fetchSchedule,
      t,
    ],
  );

  // Handle switch change with auto save and deactivate confirmation
  const handleSwitchChange = useCallback(
    async (checked: boolean) => {
      if (checked) {
        // Enabling: auto save immediately
        setIsEnabled(true);
        await autoSave(true);
        // Refresh schedule data after enabling
        await fetchSchedule();
        message.success(t('schedule.saveSuccess') || 'Schedule saved');
      } else {
        // Disabling: show confirmation modal and close popover
        setOpen(false);
        setDeactivateModalVisible(true);
      }
    },
    [autoSave, fetchSchedule, t],
  );

  // Handle confirmed deactivation
  const handleConfirmDeactivate = useCallback(async () => {
    setIsEnabled(false);
    await autoSave(false);
    // Refresh schedule data after deactivating
    await fetchSchedule();
    setDeactivateModalVisible(false);
    message.success(t('schedule.deactivateSuccess') || 'Schedule deactivated');
  }, [autoSave, fetchSchedule, t]);

  // Handle auto save when other settings change (if enabled)
  // Use ref to track if we're currently saving to prevent infinite loops
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (isEnabled && schedule?.scheduleId && !isSavingRef.current) {
      // Only auto save if schedule is enabled and exists, and we're not already saving
      const timer = setTimeout(async () => {
        isSavingRef.current = true;
        try {
          await autoSave(true);
        } finally {
          // Reset flag after a short delay to allow state updates to settle
          setTimeout(() => {
            isSavingRef.current = false;
          }, 100);
        }
      }, 500); // Debounce auto save
      return () => clearTimeout(timer);
    }
  }, [frequency, timeValue, weekdays, monthDays, isEnabled, schedule?.scheduleId, autoSave]);

  const handleButtonClick = useCallback(() => {
    if (disabled) return;

    logEvent('canvas::schedule_button_click', Date.now(), {
      canvas_id: canvasId,
    });

    // Check if this canvas already has an ENABLED schedule (only enabled schedules count toward quota)
    const hasEnabledSchedule = !!schedule?.isEnabled;

    // If canvas doesn't have enabled schedule and quota is reached, show appropriate modal
    if (!hasEnabledSchedule && totalEnabledSchedules >= scheduleQuota) {
      if (planType === 'free') {
        // Free user: show credit insufficient modal
        setCreditInsufficientModalVisible(true, undefined, 'schedule');
      } else {
        // Paid user: show schedule limit reached modal
        setScheduleLimitModalVisible(true);
      }
      return; // Don't open popover when showing limit modals
    }

    // Initialize form state when opening popover
    const config = parseScheduleConfig(schedule?.scheduleConfig);
    setIsEnabled(schedule?.isEnabled ?? false);
    setFrequency(config?.type || 'daily');
    setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
    setWeekdays(config?.weekdays || [1]);
    setMonthDays(config?.monthDays || [1]);

    setOpen(true);
  }, [
    disabled,
    canvasId,
    schedule,
    totalEnabledSchedules,
    scheduleQuota,
    planType,
    setCreditInsufficientModalVisible,
  ]);

  // Handle popover close
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Handle upgrade click
  const handleUpgradeClick = useCallback(() => {
    setOpen(false); // Hide popover first
    // Delay opening modal to ensure popover is fully closed
    setTimeout(() => {
      setCreditInsufficientModalVisible(true, undefined, 'schedule');
    }, 100);
  }, [setCreditInsufficientModalVisible]);

  // Handle view schedules click
  const handleViewSchedulesClick = useCallback(() => {
    setScheduleLimitModalVisible(false);
    navigate('/workflow-list');
  }, [navigate]);

  // Determine style based on schedule status
  const isScheduled = schedule?.isEnabled;

  return (
    <>
      <style>
        {`
          .schedule-timepicker-popup .ant-picker-time-panel {
            width: 180px !important;
            min-width: 180px !important;
          }
          .schedule-timepicker-popup .ant-picker-dropdown {
            width: 180px !important;
            min-width: 180px !important;
          }
        `}
      </style>
      <Popover
        content={
          <SchedulePopoverContent
            canvasId={canvasId}
            schedule={schedule}
            isEnabled={isEnabled}
            frequency={frequency}
            timeValue={timeValue}
            weekdays={weekdays}
            monthDays={monthDays}
            onEnabledChange={handleSwitchChange}
            onFrequencyChange={setFrequency}
            onTimeChange={setTimeValue}
            onWeekdaysChange={setWeekdays}
            onMonthDaysChange={setMonthDays}
            onClose={handleClose}
            creditCost={creditUsageData?.data?.total}
            isCreditLoading={isCreditUsageLoading}
            showUpgrade={planType === 'free'}
            onUpgradeClick={handleUpgradeClick}
          />
        }
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomLeft"
        overlayClassName="schedule-popover"
      >
        <Tooltip
          title={
            open || !isHovered
              ? ''
              : // Only show tooltip when hovering and popover is not open
                toolbarLoading
                ? t('shareContent.waitForAgentsToFinish')
                : !skillResponseNodes?.length
                  ? t('shareContent.noSkillResponseNodes')
                  : isScheduled
                    ? t('schedule.editSchedule') || 'Edit Schedule'
                    : t('schedule.title') || 'Schedule'
          }
          placement="top"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <div
                className={cn(
                  'rounded-lg p-1.5 transition-colors flex items-center justify-center',
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-refly-tertiary-hover',
                )}
                onClick={handleButtonClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <LuAlarmClock
                  className={cn(
                    'text-lg transition-colors',
                    disabled ? 'opacity-50' : '',
                    'text-gray-600 dark:text-gray-400',
                  )}
                />
              </div>
              {schedule && (
                <div className="absolute -bottom-0 -right-1">
                  <span
                    className={`px-0.5 py-0.5 flex items-center text-[8px] font-bold leading-[8px] rounded-sm ${
                      isScheduled
                        ? 'bg-refly-primary-default text-refly-bg-body-z0'
                        : 'bg-refly-fill-hover text-refly-text-3'
                    }`}
                  >
                    {isScheduled ? t('schedule.status.on') : t('schedule.status.off')}
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {!hasLoadedInitially && isLoadingScheduleCount ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  <span>/</span>
                  <div className="w-2 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
              ) : (
                `${totalEnabledSchedules}/${scheduleQuota}`
              )}
            </span>
          </div>
        </Tooltip>
      </Popover>

      {/* Schedule Limit Reached Modal */}
      <Modal
        title={t('schedule.limitReached.title') || 'Schedule Limit Reached'}
        open={scheduleLimitModalVisible}
        onOk={() => setScheduleLimitModalVisible(false)}
        onCancel={() => setScheduleLimitModalVisible(false)}
        centered
        wrapClassName="schedule-limit-modal"
        footer={[
          <Button key="cancel" onClick={() => setScheduleLimitModalVisible(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>,
          <Button
            key="view-schedules"
            type="primary"
            className="view-schedules-btn"
            onClick={handleViewSchedulesClick}
          >
            {t('schedule.viewSchedules') || 'View Schedules'}
          </Button>,
        ]}
      >
        <p>
          {t('schedule.limitReached.message') ||
            "You've reached the maximum number of scheduled workflows for your plan. You can manage or disable existing schedules to create a new one."}
        </p>
      </Modal>

      {/* Deactivate Schedule Confirmation Modal */}
      <Modal
        title={t('schedule.deactivate.title') || 'Deactivate Schedule'}
        open={deactivateModalVisible}
        onCancel={() => setDeactivateModalVisible(false)}
        centered
        footer={[
          <Button key="cancel" onClick={() => setDeactivateModalVisible(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>,
          <Button
            key="deactivate"
            type="primary"
            onClick={handleConfirmDeactivate}
            className="!bg-gray-600 hover:!bg-gray-700 !border-gray-600"
          >
            {t('schedule.deactivate.confirm') || 'Deactivate'}
          </Button>,
        ]}
      >
        <p>
          {t('schedule.deactivate.message') ||
            'Are you sure you want to deactivate this schedule? The workflow will no longer run automatically until you activate it again.'}
        </p>
      </Modal>
    </>
  );
});

ScheduleButton.displayName = 'ScheduleButton';

export default ScheduleButton;
