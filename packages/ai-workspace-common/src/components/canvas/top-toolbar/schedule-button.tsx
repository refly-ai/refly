import { useRef } from 'react';
import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Popover, message, Modal, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@refly/utils/cn';
import {
  useListSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useGetCreditUsageByCanvasId,
  useListUserTools,
  useGetCanvasData,
} from '@refly-packages/ai-workspace-common/queries';
import { useSkillResponseLoadingStatus } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-loading-status';
import {
  useCanvasStoreShallow,
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useCanvasResourcesPanelStoreShallow,
} from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import type {
  WorkflowSchedule,
  ListSchedulesResponse,
  GenericToolset,
  UserTool,
} from '@refly/openapi-schema';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { LuAlarmClock } from 'react-icons/lu';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useRequiredInputsCheck } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
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

/**
 * Check if a toolset is authorized/installed
 * - External OAuth tools: need authorization (check userTools.authorized)
 * - Other tools (builtin, non-OAuth): always available, no installation needed
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  // MCP servers need to be checked separately
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  // Builtin tools are always available
  if (toolset.builtin) {
    return true;
  }

  // Find matching user tool by key
  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);

  // If not in userTools list, user hasn't installed/authorized this tool
  if (!matchingUserTool) {
    return false;
  }

  // For external OAuth tools, check authorized status
  return matchingUserTool.authorized ?? false;
};

interface ScheduleButtonProps {
  canvasId: string;
  className?: string;
}

const ScheduleButton = memo(({ canvasId, className }: ScheduleButtonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [scheduleLimitModalVisible, setScheduleLimitModalVisible] = useState(false);
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);

  // Local state for popover form
  const [schedule, setSchedule] = useState<WorkflowSchedule | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isEnabledLoading, setIsEnabledLoading] = useState(false);

  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(dayjs('08:00', 'HH:mm'));

  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);
  const [hours, setHours] = useState<number>(1);

  // Get subscription plan type and credit insufficient modal setter
  const { planType, setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));

  // Get user login status for dependency checks
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  // Get tools dependency store for triggering popover
  const { setToolsDependencyOpen, setToolsDependencyHighlight } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setToolsDependencyOpen: state.setToolsDependencyOpen,
      setToolsDependencyHighlight: state.setToolsDependencyHighlight,
    }));

  // Get canvas data for dependency checks
  const { data: canvasResponse } = useGetCanvasData({ query: { canvasId } }, [], {
    enabled: !!canvasId && isLogin,
    refetchOnWindowFocus: false,
  });

  // Get user tools for dependency checks
  const { data: userToolsData } = useListUserTools({}, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

  // Get credit balance for dependency checks
  const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();

  // API mutations
  const listSchedulesMutation = useListSchedules();
  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  // State for total enabled schedules count
  const [totalEnabledSchedules, setTotalEnabledSchedules] = useState(0);
  const [isLoadingScheduleCount, setIsLoadingScheduleCount] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

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

  // Check for required inputs that are not filled
  const { count: requiredInputsCount } = useRequiredInputsCheck(canvasId);

  // Check for tool dependencies and errors
  const hasToolDependencyError = useMemo(() => {
    if (!isLogin || !schedule?.isEnabled) {
      return false;
    }

    const nodes = canvasResponse?.data?.nodes || [];
    const userTools = userToolsData?.data ?? [];

    // Extract toolsets from canvas nodes
    const toolsetsWithNodes = extractToolsetsWithNodes(nodes);

    // Check for uninstalled tools
    const uninstalledTools = toolsetsWithNodes.filter((tool) => {
      const isAuthorized = isToolsetAuthorized(tool.toolset, userTools);
      return !isAuthorized;
    });

    const hasUninstalledTools = uninstalledTools.length > 0;

    // Check for credit insufficiency
    const estimatedCreditUsage = creditUsageData?.data?.total ?? 0;
    const isCreditInsufficient =
      isBalanceSuccess &&
      Number.isFinite(estimatedCreditUsage) &&
      estimatedCreditUsage > 0 &&
      creditBalance < estimatedCreditUsage;

    // Check for unfilled required inputs
    const hasUnfilledRequiredInputs = requiredInputsCount > 0;

    const hasError = hasUninstalledTools || isCreditInsufficient || hasUnfilledRequiredInputs;

    return hasError;
  }, [
    isLogin,
    schedule?.isEnabled,
    schedule?.scheduleId,
    canvasResponse?.data?.nodes,
    userToolsData?.data,
    creditUsageData?.data?.total,
    isBalanceSuccess,
    creditBalance,
    requiredInputsCount,
  ]);

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

        // Only update weekdays/monthDays/hours if they're actually different
        const serverWeekdays = config?.weekdays || [1];
        const serverMonthDays = config?.monthDays || [1];
        const serverHours = config?.hours || 1;
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
        if (hours !== serverHours) {
          setHours(serverHours);
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
          ...(frequency === 'hourly' && { hours }),
        };

        const cronExpression = generateCronExpression(scheduleConfig);
        const scheduleConfigStr = JSON.stringify(scheduleConfig);

        const requestData = {
          canvasId,
          name: canvasResponse?.data?.title ?? '',
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
      hours,
      createScheduleMutation,
      updateScheduleMutation,
      fetchSchedule,
      t,
    ],
  );

  // Immediate dependency check function (without waiting for schedule to be enabled)
  const checkDependenciesImmediately = useCallback(() => {
    if (!isLogin) {
      return false;
    }

    const nodes = canvasResponse?.data?.nodes || [];
    const userTools = userToolsData?.data ?? [];

    // Extract toolsets from canvas nodes
    const toolsetsWithNodes = extractToolsetsWithNodes(nodes);

    // Check for uninstalled tools
    const uninstalledTools = toolsetsWithNodes.filter((tool) => {
      const isAuthorized = isToolsetAuthorized(tool.toolset, userTools);
      return !isAuthorized;
    });

    const hasUninstalledTools = uninstalledTools.length > 0;

    // Check for credit insufficiency
    const estimatedCreditUsage = creditUsageData?.data?.total ?? 0;
    const isCreditInsufficient =
      isBalanceSuccess &&
      Number.isFinite(estimatedCreditUsage) &&
      estimatedCreditUsage > 0 &&
      creditBalance < estimatedCreditUsage;

    // Check for unfilled required inputs
    const hasUnfilledRequiredInputs = requiredInputsCount > 0;

    const hasError = hasUninstalledTools || isCreditInsufficient || hasUnfilledRequiredInputs;

    return hasError;
  }, [
    isLogin,
    canvasResponse?.data?.nodes,
    userToolsData?.data,
    creditUsageData?.data?.total,
    isBalanceSuccess,
    creditBalance,
    requiredInputsCount,
  ]);

  // Handle switch change with auto save and deactivate confirmation
  const handleSwitchChange = useCallback(
    async (checked: boolean) => {
      if (checked) {
        try {
          // Start loading immediately
          setIsEnabledLoading(true);

          // Check for dependency errors BEFORE enabling (immediate check)
          const hasDependencyError = checkDependenciesImmediately();

          // Show dependency popover if there are issues (but don't block enabling)
          if (hasDependencyError) {
            setOpen(false); // Close schedule popover first
            setToolsDependencyOpen(canvasId, true); // Open tools dependency popover
            setToolsDependencyHighlight(canvasId, true); // Highlight install buttons
          }

          // Enabling: auto save immediately (continue regardless of dependency errors)
          setIsEnabled(true);
          await autoSave(true);
          // Refresh schedule data after enabling
          await fetchSchedule();

          // Show message after all async operations complete
          if (hasDependencyError) {
            message.warning(t('schedule.dependencyError') || 'Schedule has dependency errors');
          } else {
            message.success(t('schedule.saveSuccess') || 'Schedule saved');
          }
        } catch (error) {
          console.error('Error enabling schedule:', error);
          message.error(t('schedule.saveFailed') || 'Failed to save schedule');
          // Reset enabled state if error occurs
          setIsEnabled(false);
        } finally {
          // End loading after all operations and message display
          setIsEnabledLoading(false);
        }
      } else {
        // Disabling: show confirmation modal and close popover
        setOpen(false);
        setDeactivateModalVisible(true);
      }
    },
    [
      checkDependenciesImmediately,
      autoSave,
      fetchSchedule,
      t,
      canvasId,
      setToolsDependencyOpen,
      setToolsDependencyHighlight,
    ],
  );

  // Handle confirmed deactivation
  const handleConfirmDeactivate = useCallback(async () => {
    if (isDeactivating) return; // Prevent multiple clicks

    try {
      setIsDeactivating(true);
      setIsEnabled(false);
      await autoSave(false);
      // Refresh schedule data after deactivating
      await fetchSchedule();
      setDeactivateModalVisible(false);
      message.success(t('schedule.deactivateSuccess') || 'Schedule deactivated');
    } catch (error) {
      console.error('Error deactivating schedule:', error);
      message.error(t('schedule.deactivateError') || 'Failed to deactivate schedule');
      // Reset enabled state if error occurs
      setIsEnabled(true);
    } finally {
      setIsDeactivating(false);
    }
  }, [autoSave, fetchSchedule, t, isDeactivating]);

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
  }, [frequency, timeValue, weekdays, monthDays, hours, isEnabled, schedule?.scheduleId, autoSave]);

  const handleButtonClick = useCallback(() => {
    if (disabled) return;

    logEvent('schedule_entry_click');

    // Initialize form state when opening popover
    const config = parseScheduleConfig(schedule?.scheduleConfig);
    setIsEnabled(schedule?.isEnabled ?? false);
    setFrequency(config?.type || 'daily');
    setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
    setWeekdays(config?.weekdays || [1]);
    setMonthDays(config?.monthDays || [1]);
    setHours(config?.hours || 1);

    setOpen(true);
  }, [disabled, schedule]);

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
    navigate('/workflow-list', {
      state: { autoEnableScheduleFilter: true },
    });
  }, [navigate]);

  // Determine schedule status
  const isScheduled = schedule?.isEnabled;
  const [isHovered, setIsHovered] = useState(false);
  const scheduleStatus = useMemo(() => {
    if (!isScheduled) {
      return 'off';
    }
    if (hasToolDependencyError) {
      return 'error';
    }
    return 'on';
  }, [isScheduled, hasToolDependencyError, schedule?.scheduleId]);

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
            isEnabledLoading={isEnabledLoading}
            frequency={frequency}
            timeValue={timeValue}
            weekdays={weekdays}
            monthDays={monthDays}
            hours={hours}
            onEnabledChange={handleSwitchChange}
            onFrequencyChange={setFrequency}
            onTimeChange={setTimeValue}
            onWeekdaysChange={setWeekdays}
            onMonthDaysChange={setMonthDays}
            onHoursChange={setHours}
            onClose={handleClose}
            creditCost={creditUsageData?.data?.total}
            isCreditLoading={isCreditUsageLoading}
            showUpgrade={planType === 'free'}
            onUpgradeClick={handleUpgradeClick}
            totalEnabledSchedules={totalEnabledSchedules}
            scheduleQuota={scheduleQuota}
            hasLoadedInitially={hasLoadedInitially}
            isLoadingScheduleCount={isLoadingScheduleCount}
            planType={planType}
            setCreditInsufficientModalVisible={setCreditInsufficientModalVisible}
            setScheduleLimitModalVisible={setScheduleLimitModalVisible}
          />
        }
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottom"
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
          <Button
            type="text"
            disabled={disabled}
            className={cn('schedule-toolbar-button', className)}
            onClick={handleButtonClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative">
              <div
                className={cn(
                  'schedule-toolbar-icon-wrap rounded-lg transition-colors',
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
              >
                <LuAlarmClock
                  className={cn(
                    'schedule-toolbar-icon transition-colors',
                    disabled ? 'opacity-50' : '',
                  )}
                />
              </div>
              {schedule && (
                <div className="absolute -bottom-0 -right-1">
                  <span
                    className={`px-0.5 py-0.5 flex items-center text-[8px] font-bold leading-[8px] rounded-sm ${
                      scheduleStatus === 'on'
                        ? 'bg-refly-primary-default text-refly-bg-body-z0'
                        : scheduleStatus === 'error'
                          ? 'bg-refly-func-danger-default text-refly-bg-body-z0'
                          : 'bg-refly-fill-hover text-refly-text-3'
                    }`}
                  >
                    {t(`schedule.status.${scheduleStatus}`)}
                  </span>
                </div>
              )}
            </div>
            <span className="schedule-toolbar-text">
              {!hasLoadedInitially && isLoadingScheduleCount ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  <span>/</span>
                  <div className="w-2 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
              ) : (
                <>
                  <span className="schedule-toolbar-label">
                    {t('schedule.title') || 'Schedule'}
                  </span>
                </>
              )}
            </span>
          </Button>
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
        onCancel={isDeactivating ? undefined : () => setDeactivateModalVisible(false)}
        closable={!isDeactivating}
        maskClosable={!isDeactivating}
        centered
        wrapClassName="deactivate-schedule-modal"
        footer={[
          <Button
            key="cancel"
            disabled={isDeactivating}
            onClick={() => setDeactivateModalVisible(false)}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>,
          <Button
            key="deactivate"
            type="primary"
            loading={isDeactivating}
            onClick={handleConfirmDeactivate}
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
