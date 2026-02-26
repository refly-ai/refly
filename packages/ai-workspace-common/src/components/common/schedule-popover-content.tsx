import { memo, useCallback, useMemo } from 'react';
import { Button, Switch, TimePicker, Select, Divider, Spin, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import type { WorkflowSchedule } from '@refly/openapi-schema';
import { CronExpressionParser } from 'cron-parser';
import { LOCALE } from '@refly/common-types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ArrowRight } from 'lucide-react';
import './schedule-popover-content.scss';

dayjs.extend(utc);
dayjs.extend(timezone);

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface ScheduleConfig {
  type: ScheduleFrequency;
  time: string;
  weekdays?: number[];
  monthDays?: number[];
  hours?: number; // For hourly schedule - specifies which hour to run (1-12)
}

export interface SchedulePopoverContentProps {
  canvasId: string;
  schedule?: WorkflowSchedule | null;
  isEnabled: boolean;
  isEnabledLoading?: boolean;
  frequency: ScheduleFrequency;
  timeValue: dayjs.Dayjs;
  weekdays: number[];
  monthDays: number[];
  hours: number; // For hourly schedule (1-12)
  onEnabledChange: (enabled: boolean) => void;
  onFrequencyChange: (frequency: ScheduleFrequency) => void;
  onTimeChange: (time: dayjs.Dayjs) => void;
  onWeekdaysChange: (weekdays: number[]) => void;
  onMonthDaysChange: (monthDays: number[]) => void;
  onHoursChange: (hours: number) => void;
  onClose?: () => void;
  creditCost?: number | string;
  isCreditLoading?: boolean;
  showUpgrade?: boolean;
  onUpgradeClick?: () => void;
  // New props for schedule count
  totalEnabledSchedules?: number;
  scheduleQuota?: number;
  hasLoadedInitially?: boolean;
  isLoadingScheduleCount?: boolean;
  // Props for quota check
  planType?: string;
  setCreditInsufficientModalVisible?: (visible: boolean, reason?: any, source?: string) => void;
  setScheduleLimitModalVisible?: (visible: boolean) => void;
}

export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

export const HOURLY_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
];

export function parseScheduleConfig(configStr?: string): ScheduleConfig | null {
  if (!configStr) return null;
  try {
    return JSON.parse(configStr) as ScheduleConfig;
  } catch {
    return null;
  }
}

export function generateCronExpression(config: ScheduleConfig): string {
  const [hour, minute] = config.time.split(':').map(Number);

  switch (config.type) {
    case 'hourly': {
      // Run at the top of the hour for every N hours (1-12)
      const hourInterval = config.hours || 1;
      return `0 */${hourInterval} * * *`;
    }
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const weekdays = config.weekdays?.join(',') || dayjs().day().toString();
      return `${minute} ${hour} * * ${weekdays}`;
    }
    case 'monthly': {
      const monthDays = config.monthDays?.join(',') || dayjs().date().toString();
      return `${minute} ${hour} ${monthDays} * *`;
    }
    default:
      return `${minute} ${hour} * * *`;
  }
}

export const SchedulePopoverContent = memo(
  ({
    canvasId,
    isEnabled,
    isEnabledLoading = false,
    frequency,
    timeValue,
    weekdays,
    monthDays,
    hours,
    onEnabledChange,
    onFrequencyChange,
    onTimeChange,
    onWeekdaysChange,
    onMonthDaysChange,
    onHoursChange,
    onClose,
    creditCost,
    isCreditLoading,
    showUpgrade,
    onUpgradeClick,
    totalEnabledSchedules,
    scheduleQuota,
    hasLoadedInitially,
    isLoadingScheduleCount,
    planType,
    setCreditInsufficientModalVisible,
    setScheduleLimitModalVisible,
  }: SchedulePopoverContentProps) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const language = i18n.languages?.[0];

    // Helper function to format selected weekdays for display
    const formatSelectedWeekdays = useCallback(
      (selectedWeekdays: number[]) => {
        if (selectedWeekdays.length === 0) return t('schedule.selectDate') || 'Select Date';

        const sortedWeekdays = [...selectedWeekdays].sort((a, b) => {
          // Convert Sunday (0) to 7 for proper sorting
          const aVal = a === 0 ? 7 : a;
          const bVal = b === 0 ? 7 : b;
          return aVal - bVal;
        });

        const weekdayLabels = sortedWeekdays
          .map((value) => {
            const weekday = WEEKDAYS.find((w) => w.value === value);
            return weekday
              ? t(`schedule.weekday.${weekday.label.toLowerCase()}`) || weekday.label
              : '';
          })
          .filter(Boolean);

        const isZh = language === 'zh-CN';

        let result: string;
        if (isZh) {
          // For Chinese, show detailed format if ≤ 2 days, otherwise show first 2 with ellipsis
          if (weekdayLabels.length <= 2) {
            result = `每${weekdayLabels.join('、')}`;
          } else {
            result = `每${weekdayLabels.slice(0, 2).join('、')}...`;
          }
        } else {
          // For English, show detailed format if ≤ 2 days, otherwise show first 2 with ellipsis
          if (weekdayLabels.length <= 2) {
            result = `${weekdayLabels.join(', ')}`;
          } else {
            result = `${weekdayLabels.slice(0, 2).join(', ')}...`;
          }
        }

        return result;
      },
      [t, language],
    );

    // Helper function to format selected month days for display
    const formatSelectedMonthDays = useCallback(
      (selectedDays: number[]) => {
        if (selectedDays.length === 0) return t('schedule.selectDate') || 'Select Date';

        const sortedDays = [...selectedDays].sort((a, b) => a - b);
        const isZh = language === 'zh-CN';

        let result: string;
        if (isZh) {
          // For Chinese, show detailed format if ≤ 2 days, otherwise show first 2 with ellipsis
          if (sortedDays.length <= 2) {
            const dayLabels = sortedDays.map((day) => `${day}号`);
            result = `每月${dayLabels.join('、')}`;
          } else {
            const dayLabels = sortedDays.slice(0, 2).map((day) => `${day}号`);
            result = `每月${dayLabels.join('、')}...`;
          }
        } else {
          // For English, show detailed format if ≤ 2 days, otherwise show first 2 with ellipsis
          if (sortedDays.length <= 3) {
            const dayLabels = sortedDays.map((day) => {
              const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
              return `${day}${suffix}`;
            });
            result = `${dayLabels.join(', ')}`;
          } else {
            const dayLabels = sortedDays.slice(0, 3).map((day) => {
              const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
              return `${day}${suffix}`;
            });
            result = `${dayLabels.join(', ')}...`;
          }
        }

        return result;
      },
      [t, language],
    );

    // Calculate next run time
    const nextRunTime = useMemo(() => {
      if (!isEnabled || !timeValue) return null;

      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Generate cron expression based on current settings
        const config: ScheduleConfig = {
          type: frequency,
          time: timeValue.format('HH:mm'),
          weekdays: frequency === 'weekly' ? weekdays : undefined,
          monthDays: frequency === 'monthly' ? monthDays : undefined,
          hours: frequency === 'hourly' ? hours : undefined,
        };

        const cronExpression = generateCronExpression(config);

        // Use CronExpressionParser to calculate next run time (same as backend)
        const interval = CronExpressionParser.parse(cronExpression, { tz: userTimezone });
        const nextRun = interval.next().toDate();

        // Use time utility function for i18n support (same as run-history)
        return time(nextRun, language as LOCALE).format('YYYY/MM/DD, hh:mm A');
      } catch (error) {
        console.error('[Schedule Debug] Error calculating next run time:', error);
        return null;
      }
    }, [isEnabled, timeValue, frequency, weekdays, monthDays]);

    // Handle view history navigation
    const handleViewHistory = useCallback(() => {
      onClose?.();
      navigate(`/run-history?canvasId=${canvasId}`);
    }, [navigate, canvasId, onClose]);

    const handleFrequencyClick = useCallback(
      (freq: ScheduleFrequency) => {
        onFrequencyChange(freq);

        // Set default hours for hourly frequency
        if (freq === 'hourly' && hours === 1) {
          // Keep default as 1 hour interval
          onHoursChange(1);
        }
        // Check if weekdays contains only the default Monday (value 1)
        if (
          freq === 'weekly' &&
          (weekdays.length === 0 || (weekdays.length === 1 && weekdays[0] === 1))
        ) {
          // Default to current weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
          const currentWeekday = dayjs().day();
          onWeekdaysChange([currentWeekday]);
        }
        // Check if monthDays contains only the default 1st day (value 1)
        if (
          freq === 'monthly' &&
          (monthDays.length === 0 || (monthDays.length === 1 && monthDays[0] === 1))
        ) {
          // Default to current day of month
          const currentDay = dayjs().date();
          onMonthDaysChange([currentDay]);
        }
      },
      [
        weekdays,
        monthDays,
        hours,
        onFrequencyChange,
        onWeekdaysChange,
        onMonthDaysChange,
        onHoursChange,
      ],
    );

    // Handle Switch change with quota check
    const handleSwitchChange = useCallback(
      (checked: boolean) => {
        if (checked) {
          // Check if this canvas already has an ENABLED schedule (only enabled schedules count toward quota)
          const hasEnabledSchedule = !!isEnabled;

          // If canvas doesn't have enabled schedule and quota is reached, show appropriate modal
          if (!hasEnabledSchedule && (totalEnabledSchedules ?? 0) >= (scheduleQuota ?? 0)) {
            // Close popover first
            onClose?.();

            if (planType === 'free') {
              // Free user: show credit insufficient modal
              setCreditInsufficientModalVisible?.(true, undefined, 'schedule');
            } else {
              // Paid user: show schedule limit reached modal
              setScheduleLimitModalVisible?.(true);
            }
            return; // Don't proceed with enabling
          }
        }

        // Proceed with the original enable/disable logic
        onEnabledChange(checked);
      },
      [
        isEnabled,
        totalEnabledSchedules,
        scheduleQuota,
        planType,
        setCreditInsufficientModalVisible,
        setScheduleLimitModalVisible,
        onEnabledChange,
        onClose,
      ],
    );

    return (
      <div className="w-[400px] space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="text-base font-semibold">{t('schedule.title') || 'Schedule'}</div>
            <Tooltip
              title={
                totalEnabledSchedules >= scheduleQuota
                  ? t('schedule.limited') || 'Schedule Limited'
                  : t('schedule.tooltipText') ||
                    'Schedulable timer count, cap rises to 20 after upgrading to Plus'
              }
              placement="bottom"
            >
              <span
                className={`text-xs font-medium cursor-pointer ${
                  totalEnabledSchedules >= scheduleQuota
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
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
            </Tooltip>
            {nextRunTime && (
              <div className="text-xs text-gray-500">
                {t('schedule.nextRun') || 'Next run'}: {nextRunTime}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEnabledLoading && <Spin size="small" />}
            <Switch
              checked={isEnabled}
              loading={isEnabledLoading}
              disabled={isEnabledLoading}
              onChange={handleSwitchChange}
            />
          </div>
        </div>

        {/* Frequency buttons */}
        <div className="flex gap-2">
          {(['hourly', 'daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map((freq) => (
            <Button
              key={freq}
              type="default"
              disabled={isEnabled || isEnabledLoading}
              className={`schedule-frequency-button flex-1 h-11 ${
                frequency === freq
                  ? '!bg-transparent !border-teal-500 !text-teal-600 hover:!border-teal-600 hover:!text-teal-700 hover:!bg-transparent'
                  : '!bg-transparent hover:!bg-transparent hover:border-gray-300 hover:text-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-300'
              } ${isEnabled || isEnabledLoading ? 'disabled:!bg-gray-100 disabled:!border-gray-300 disabled:!text-gray-400 dark:disabled:!bg-gray-800 dark:disabled:!border-gray-600 dark:disabled:!text-gray-500' : ''}`}
              onClick={() => !(isEnabled || isEnabledLoading) && handleFrequencyClick(freq)}
            >
              {freq === 'hourly'
                ? t('schedule.hourly') || 'Hourly'
                : freq === 'daily'
                  ? t('schedule.daily') || 'Daily'
                  : freq === 'weekly'
                    ? t('schedule.weekly') || 'Weekly'
                    : t('schedule.monthly') || 'Monthly'}
            </Button>
          ))}
        </div>

        {/* Time picker and selection container */}
        <div
          className={`flex items-center gap-3 border rounded-lg ${isEnabled || isEnabledLoading ? 'border-refly-Card-Border' : 'border-refly-semi-color-border'}`}
        >
          {/* Hourly selection */}
          {frequency === 'hourly' && (
            <div className="flex-1">
              <Select
                value={hours}
                disabled={isEnabled || isEnabledLoading}
                onChange={(value) => {
                  if (isEnabled || isEnabledLoading) return;
                  onHoursChange(value);
                }}
                options={HOURLY_OPTIONS.map((h) => ({
                  ...h,
                  label: t('schedule.hourlyOptions.interval', { hours: h.label }),
                }))}
                placeholder={t('schedule.selectHours') || 'Select Hours'}
                className="w-[180px] h-full schedule-select"
                size="large"
              />
            </div>
          )}

          {/* Weekly selection */}
          {frequency === 'weekly' && (
            <div className="flex-1">
              <Select
                mode="multiple"
                value={weekdays}
                disabled={isEnabled || isEnabledLoading}
                onChange={(values) => {
                  if (isEnabled || isEnabledLoading) return;
                  // Prevent removing all selections - must keep at least one
                  if (values.length === 0) {
                    console.log('[Schedule Debug] Preventing removal of all weekly selections');
                    return;
                  }
                  onWeekdaysChange(values);
                }}
                options={WEEKDAYS.map((d) => ({
                  ...d,
                  label: t(`schedule.weekday.${d.label.toLowerCase()}`) || d.label,
                }))}
                placeholder="Select Date"
                className="w-full h-full schedule-select"
                size="large"
                maxTagCount={0}
                maxTagPlaceholder={() => formatSelectedWeekdays(weekdays)}
                dropdownClassName="schedule-dropdown"
              />
            </div>
          )}

          {/* Monthly selection */}
          {frequency === 'monthly' && (
            <div className="flex-1">
              <Select
                mode="multiple"
                value={monthDays}
                disabled={isEnabled || isEnabledLoading}
                onChange={(values) => {
                  if (isEnabled || isEnabledLoading) return;
                  // Prevent removing all selections - must keep at least one
                  if (values.length === 0) {
                    console.log('[Schedule Debug] Preventing removal of all monthly selections');
                    return;
                  }
                  onMonthDaysChange(values);
                }}
                options={MONTH_DAYS}
                placeholder="Select Date"
                className="w-full h-full schedule-monthly-select"
                size="large"
                maxTagCount={0}
                maxTagPlaceholder={() => formatSelectedMonthDays(monthDays)}
              />
            </div>
          )}

          {/* Daily selection - time picker only, left aligned */}
          {frequency === 'daily' && (
            <TimePicker
              value={timeValue}
              disabled={isEnabled || isEnabledLoading}
              onChange={(val) => !(isEnabled || isEnabledLoading) && val && onTimeChange(val)}
              format="HH:mm"
              className="h-10 w-[180px]"
              size="large"
              allowClear={false}
              popupClassName="schedule-timepicker-popup"
            />
          )}

          {/* Weekly and Monthly - with divider and time picker */}
          {(frequency === 'weekly' || frequency === 'monthly') && (
            <>
              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
              <TimePicker
                value={timeValue}
                disabled={isEnabled || isEnabledLoading}
                onChange={(val) => !(isEnabled || isEnabledLoading) && val && onTimeChange(val)}
                format="HH:mm"
                className="flex-1 h-10 w-[188px]"
                size="large"
                allowClear={false}
                popupClassName="schedule-timepicker-popup"
              />
            </>
          )}

          {/* Hourly selection - no time picker needed since it runs on the hour */}
        </div>

        {/* Cost info - only show if cost is not 0 */}
        {!isCreditLoading && (creditCost ?? 0) !== 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {t('schedule.cost') || 'Cost'}: {creditCost}~ / {t('schedule.perRun') || 'run'}
            </span>
            {showUpgrade && (
              <Button
                type="text"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpgradeClick?.();
                }}
                className="flex-shrink-0 text-xs md:text-sm !p-1 !h-auto text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
              >
                {t('common.upgrade') || 'Upgrade'} &gt;
              </Button>
            )}
          </div>
        )}

        {/* View History link */}
        <Button
          type="link"
          className="!p-0 !text-teal-600 hover:!text-teal-700 font-medium flex items-center gap-1"
          onClick={handleViewHistory}
        >
          {t('schedule.viewHistory') || 'View History'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  },
);

SchedulePopoverContent.displayName = 'SchedulePopoverContent';
