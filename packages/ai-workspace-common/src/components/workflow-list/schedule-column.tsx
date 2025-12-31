import { memo, useMemo, useState, useCallback } from 'react';
import { Popover, Modal, message } from 'antd';
import { WorkflowSchedule } from '@refly/openapi-schema';
import {
  useUpdateSchedule,
  useGetCreditUsageByCanvasId,
} from '@refly-packages/ai-workspace-common/queries';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStoreShallow } from '@refly/stores';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useDebouncedCallback } from 'use-debounce';
import {
  SchedulePopoverContent,
  parseScheduleConfig,
  generateCronExpression,
  type ScheduleFrequency,
  type ScheduleConfig,
} from '@refly-packages/ai-workspace-common/components/common/schedule-popover-content';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface ScheduleColumnProps {
  schedule?: WorkflowSchedule;
  canvasId: string;
  onScheduleChange?: () => void;
  totalEnabledSchedules?: number;
  scheduleQuota?: number;
}

export const ScheduleColumn = memo(
  ({
    schedule,
    canvasId,
    onScheduleChange,
    totalEnabledSchedules = 0,
    scheduleQuota = 1,
  }: ScheduleColumnProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [scheduleLimitModalVisible, setScheduleLimitModalVisible] = useState(false);

    // Get subscription plan type and credit insufficient modal setter
    const { planType, setCreditInsufficientModalVisible } = useSubscriptionStoreShallow(
      (state) => ({
        planType: state.planType,
        setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
      }),
    );

    // Local state for popover form
    const existingConfig = parseScheduleConfig(schedule?.scheduleConfig);
    const [isEnabled, setIsEnabled] = useState(schedule?.isEnabled ?? false);
    const [frequency, setFrequency] = useState<ScheduleFrequency>(existingConfig?.type || 'daily');
    const [timeValue, setTimeValue] = useState<dayjs.Dayjs>(
      existingConfig?.time ? dayjs(existingConfig.time, 'HH:mm') : dayjs('08:00', 'HH:mm'),
    );
    const [weekdays, setWeekdays] = useState<number[]>(existingConfig?.weekdays || [1]);
    const [monthDays, setMonthDays] = useState<number[]>(existingConfig?.monthDays || [1]);

    // API mutation
    const updateScheduleMutation = useUpdateSchedule();

    // Credit usage query
    const { data: creditUsageData, isLoading: isCreditUsageLoading } = useGetCreditUsageByCanvasId(
      {
        query: { canvasId },
      },
      undefined,
      {
        enabled: !!canvasId && open,
      },
    );

    // Reset state when popover opens
    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (newOpen) {
          // Check quota before opening for disabled schedules
          // If schedule is disabled and user already reached quota, show modal instead
          if (!schedule?.isEnabled && totalEnabledSchedules >= scheduleQuota) {
            if (planType === 'free') {
              setCreditInsufficientModalVisible(true, undefined, 'schedule');
            } else {
              setScheduleLimitModalVisible(true);
            }
            return; // Don't open popover
          }

          const config = parseScheduleConfig(schedule?.scheduleConfig);
          setIsEnabled(schedule?.isEnabled ?? false);
          setFrequency(config?.type || 'daily');
          setTimeValue(config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'));
          setWeekdays(config?.weekdays || [1]);
          setMonthDays(config?.monthDays || [1]);
        }
        setOpen(newOpen);
      },
      [schedule, totalEnabledSchedules, scheduleQuota, planType, setCreditInsufficientModalVisible],
    );

    // Handle enabled change - auto save
    const handleEnabledChange = useCallback(
      async (enabled: boolean) => {
        if (!schedule?.scheduleId || !timeValue) return;

        // Check quota when trying to enable
        if (enabled && !schedule?.isEnabled) {
          // This schedule is not currently enabled, check if quota allows enabling
          if (totalEnabledSchedules >= scheduleQuota) {
            if (planType === 'free') {
              // Free user: show credit insufficient modal
              setCreditInsufficientModalVisible(true, undefined, 'schedule');
            } else {
              // Paid user: show schedule limit reached modal
              setScheduleLimitModalVisible(true);
            }
            return;
          }
        }

        setIsEnabled(enabled);

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

          await updateScheduleMutation.mutateAsync({
            body: {
              scheduleId: schedule.scheduleId,
              cronExpression,
              scheduleConfig: JSON.stringify(scheduleConfig),
              timezone: userTimezone,
              isEnabled: enabled,
            },
          });

          message.success(
            enabled
              ? t('schedule.saveSuccess') || 'Schedule enabled'
              : t('schedule.deactivateSuccess') || 'Schedule disabled',
          );
          onScheduleChange?.();
        } catch (error) {
          console.error('Failed to update schedule:', error);
          message.error(t('schedule.saveFailed') || 'Failed to update schedule');
          // Revert on error
          setIsEnabled(!enabled);
        }
      },
      [
        schedule,
        canvasId,
        frequency,
        timeValue,
        weekdays,
        monthDays,
        updateScheduleMutation,
        onScheduleChange,
        t,
        totalEnabledSchedules,
        scheduleQuota,
        planType,
        setCreditInsufficientModalVisible,
      ],
    );

    // Handle close
    const handleClose = useCallback(() => {
      setOpen(false);
    }, []);

    // Debounced auto-save for config changes (frequency, time, weekdays, monthDays)
    const debouncedSaveConfig = useDebouncedCallback(
      async (
        currentFrequency: ScheduleFrequency,
        currentTimeValue: dayjs.Dayjs,
        currentWeekdays: number[],
        currentMonthDays: number[],
      ) => {
        if (!schedule?.scheduleId || !currentTimeValue) return;

        try {
          const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const timeStr = currentTimeValue.format('HH:mm');
          const scheduleConfig: ScheduleConfig = {
            type: currentFrequency,
            time: timeStr,
            ...(currentFrequency === 'weekly' && { weekdays: currentWeekdays }),
            ...(currentFrequency === 'monthly' && { monthDays: currentMonthDays }),
          };

          const cronExpression = generateCronExpression(scheduleConfig);

          await updateScheduleMutation.mutateAsync({
            body: {
              scheduleId: schedule.scheduleId,
              cronExpression,
              scheduleConfig: JSON.stringify(scheduleConfig),
              timezone: userTimezone,
              isEnabled,
            },
          });

          onScheduleChange?.();
        } catch (error) {
          console.error('Failed to auto-save schedule config:', error);
          message.error(t('schedule.saveFailed') || 'Failed to save schedule');
        }
      },
      800, // 800ms debounce delay
    );

    // Wrapper handlers that trigger auto-save on user changes
    const handleFrequencyChange = useCallback(
      (newFrequency: ScheduleFrequency) => {
        setFrequency(newFrequency);
        debouncedSaveConfig(newFrequency, timeValue, weekdays, monthDays);
      },
      [weekdays, monthDays, timeValue, debouncedSaveConfig],
    );

    const handleTimeChange = useCallback(
      (newTime: dayjs.Dayjs) => {
        setTimeValue(newTime);
        debouncedSaveConfig(frequency, newTime, weekdays, monthDays);
      },
      [frequency, weekdays, monthDays, debouncedSaveConfig],
    );

    const handleWeekdaysChange = useCallback(
      (newWeekdays: number[]) => {
        setWeekdays(newWeekdays);
        debouncedSaveConfig(frequency, timeValue, newWeekdays, monthDays);
      },
      [frequency, timeValue, monthDays, debouncedSaveConfig],
    );

    const handleMonthDaysChange = useCallback(
      (newMonthDays: number[]) => {
        setMonthDays(newMonthDays);
        debouncedSaveConfig(frequency, timeValue, weekdays, newMonthDays);
      },
      [frequency, timeValue, weekdays, debouncedSaveConfig],
    );

    // Schedule display for badge
    const scheduleDisplay = useMemo(() => {
      if (!schedule?.scheduleId) {
        return null;
      }

      const config = parseScheduleConfig(schedule.scheduleConfig);
      const typeLabel =
        config?.type === 'daily'
          ? t('schedule.daily')
          : config?.type === 'weekly'
            ? t('schedule.weekly')
            : config?.type === 'monthly'
              ? t('schedule.monthly')
              : t('schedule.title');
      const enabled = schedule.isEnabled ?? false;

      return {
        label: typeLabel,
        isEnabled: enabled,
      };
    }, [schedule, t]);

    // Render badge
    const renderBadge = () => {
      if (!scheduleDisplay) {
        return null;
      }

      const { label, isEnabled: enabled } = scheduleDisplay;

      return (
        <div className="flex items-center gap-1 bg-refly-bg-control-z0 rounded-[6px] px-2 h-[26px]">
          <span className="text-xs font-normal leading-[18px] text-refly-text-0">{label}</span>
          <span
            className={`px-1 py-0.5 flex items-center text-[9px] font-bold leading-[11px] rounded-sm ${
              enabled
                ? 'bg-refly-primary-default text-refly-bg-body-z0'
                : 'bg-refly-fill-hover text-refly-text-3'
            }`}
          >
            {enabled ? t('schedule.status.on') : t('schedule.status.off')}
          </span>
        </div>
      );
    };

    // If no schedule, show "-" without popover
    if (!schedule?.scheduleId) {
      return <span className="text-gray-400 select-none">-</span>;
    }

    return (
      <>
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
              onEnabledChange={handleEnabledChange}
              onFrequencyChange={handleFrequencyChange}
              onTimeChange={handleTimeChange}
              onWeekdaysChange={handleWeekdaysChange}
              onMonthDaysChange={handleMonthDaysChange}
              onClose={handleClose}
              creditCost={creditUsageData?.data?.total}
              isCreditLoading={isCreditUsageLoading}
              showUpgrade={planType === 'free'}
              onUpgradeClick={() => {
                setOpen(false); // Hide popover first
                setTimeout(() => {
                  setCreditInsufficientModalVisible(true, undefined, 'schedule');
                }, 100);
              }}
            />
          }
          trigger="click"
          open={open}
          onOpenChange={handleOpenChange}
          placement="bottomLeft"
          overlayClassName="schedule-popover"
        >
          <div
            className="flex items-center justify-center gap-1 cursor-pointer hover:opacity-70 transition-opacity select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {renderBadge()}
          </div>
        </Popover>

        {/* Schedule Limit Modal for paid users */}
        <Modal
          open={scheduleLimitModalVisible}
          onCancel={() => setScheduleLimitModalVisible(false)}
          footer={null}
          centered
          width={400}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-lg font-semibold">{t('schedule.limitReached.title')}</div>
            <div className="text-sm text-gray-500 text-center">
              {t('schedule.limitReached.description', { limit: scheduleQuota })}
            </div>
          </div>
        </Modal>
      </>
    );
  },
);

ScheduleColumn.displayName = 'ScheduleColumn';
