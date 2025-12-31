import { memo, useCallback, useMemo } from 'react';
import { Button, Switch, TimePicker, Select, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import type { WorkflowSchedule } from '@refly/openapi-schema';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ArrowRight } from 'lucide-react';

dayjs.extend(utc);
dayjs.extend(timezone);

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface ScheduleConfig {
  type: ScheduleFrequency;
  time: string;
  weekdays?: number[];
  monthDays?: number[];
}

export interface SchedulePopoverContentProps {
  canvasId: string;
  schedule?: WorkflowSchedule | null;
  isEnabled: boolean;
  frequency: ScheduleFrequency;
  timeValue: dayjs.Dayjs;
  weekdays: number[];
  monthDays: number[];
  onEnabledChange: (enabled: boolean) => void;
  onFrequencyChange: (frequency: ScheduleFrequency) => void;
  onTimeChange: (time: dayjs.Dayjs) => void;
  onWeekdaysChange: (weekdays: number[]) => void;
  onMonthDaysChange: (monthDays: number[]) => void;
  onClose?: () => void;
  creditCost?: number | string;
  isCreditLoading?: boolean;
  showUpgrade?: boolean;
  onUpgradeClick?: () => void;
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
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const weekdays = config.weekdays?.join(',') || '1';
      return `${minute} ${hour} * * ${weekdays}`;
    }
    case 'monthly': {
      const monthDays = config.monthDays?.join(',') || '1';
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
    frequency,
    timeValue,
    weekdays,
    monthDays,
    onEnabledChange,
    onFrequencyChange,
    onTimeChange,
    onWeekdaysChange,
    onMonthDaysChange,
    onClose,
    creditCost,
    isCreditLoading,
    showUpgrade,
    onUpgradeClick,
  }: SchedulePopoverContentProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Calculate next run time
    const nextRunTime = useMemo(() => {
      if (!isEnabled || !timeValue) return null;

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hour = timeValue.hour();
      const minute = timeValue.minute();

      let nextRun = dayjs().tz(userTimezone).hour(hour).minute(minute).second(0);

      if (nextRun.isBefore(dayjs())) {
        nextRun = nextRun.add(1, 'day');
      }

      return nextRun.format('YYYY/MM/DD hh:mm A');
    }, [isEnabled, timeValue]);

    // Handle view history navigation
    const handleViewHistory = useCallback(() => {
      onClose?.();
      navigate(`/run-history?canvasId=${canvasId}`);
    }, [navigate, canvasId, onClose]);

    const handleFrequencyClick = useCallback(
      (freq: ScheduleFrequency) => {
        onFrequencyChange(freq);
        if (freq === 'weekly' && weekdays.length === 0) {
          onWeekdaysChange([1]); // Default to Monday
        }
        if (freq === 'monthly' && monthDays.length === 0) {
          onMonthDaysChange([1]); // Default to 1st
        }
      },
      [weekdays, monthDays, onFrequencyChange, onWeekdaysChange, onMonthDaysChange],
    );

    return (
      <div className="w-[400px] space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="text-base font-semibold">{t('schedule.title') || 'Schedule'}</div>
            {nextRunTime && (
              <div className="text-xs text-gray-500">
                {t('schedule.nextRun') || 'Next run'}: {nextRunTime}
              </div>
            )}
          </div>
          <Switch checked={isEnabled} onChange={onEnabledChange} />
        </div>

        {/* Frequency buttons */}
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map((freq) => (
            <Button
              key={freq}
              type="default"
              className={`flex-1 h-11 ${
                frequency === freq
                  ? '!bg-transparent !border-teal-500 !text-teal-600 hover:!border-teal-600 hover:!text-teal-700 hover:!bg-transparent'
                  : '!bg-transparent hover:!bg-transparent hover:border-gray-300 hover:text-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={() => handleFrequencyClick(freq)}
            >
              {freq === 'daily'
                ? t('schedule.daily') || 'Daily'
                : freq === 'weekly'
                  ? t('schedule.weekly') || 'Weekly'
                  : t('schedule.monthly') || 'Monthly'}
            </Button>
          ))}
        </div>

        {/* Time picker and selection container */}
        <div className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Weekly selection */}
          {frequency === 'weekly' && (
            <div className="flex-1">
              <Select
                mode="multiple"
                value={weekdays}
                onChange={onWeekdaysChange}
                options={WEEKDAYS.map((d) => ({
                  ...d,
                  label: t(`schedule.weekday.${d.label.toLowerCase()}`) || d.label,
                }))}
                placeholder="Select Date"
                className="w-full h-full schedule-select"
                size="large"
                maxTagCount={0}
                maxTagPlaceholder={() =>
                  weekdays.length === 0
                    ? 'Select Date'
                    : `Select ${weekdays.length} day${weekdays.length !== 1 ? 's' : ''}`
                }
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
                onChange={onMonthDaysChange}
                options={MONTH_DAYS}
                placeholder="Select Date"
                className="w-full h-full schedule-monthly-select"
                size="large"
                maxTagCount={0}
                maxTagPlaceholder={() =>
                  monthDays.length === 0
                    ? 'Select Date'
                    : `Select ${monthDays.length} day${monthDays.length !== 1 ? 's' : ''}`
                }
              />
            </div>
          )}

          {/* Daily selection - time picker only, left aligned */}
          {frequency === 'daily' && (
            <TimePicker
              value={timeValue}
              onChange={(val) => val && onTimeChange(val)}
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
                onChange={(val) => val && onTimeChange(val)}
                format="HH:mm"
                className="flex-1 h-10 w-[188px]"
                size="large"
                allowClear={false}
                popupClassName="schedule-timepicker-popup"
              />
            </>
          )}
        </div>

        {/* Cost info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('schedule.cost') || 'Cost'}: {isCreditLoading ? '...' : (creditCost ?? 0)} /{' '}
            {t('schedule.perRun') || 'run'}
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
