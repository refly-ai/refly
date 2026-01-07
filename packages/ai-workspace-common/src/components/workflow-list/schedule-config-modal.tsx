import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Switch, Select, TimePicker, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Close } from 'refly-icons';
import { WorkflowSchedule } from '@refly/openapi-schema';
import { client } from '@refly/openapi-schema';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface ScheduleConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  canvasId: string;
  schedule?: WorkflowSchedule;
}

interface ScheduleConfig {
  type: 'daily' | 'weekly' | 'monthly';
  time: string;
  weekdays?: number[];
  monthDays?: number[];
}

interface ScheduleFormData {
  name: string;
  isEnabled: boolean;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  time: dayjs.Dayjs;
  weekdays: number[];
  monthDays: number[];
  timezone: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
  { value: 'UTC', label: 'UTC' },
];

function parseScheduleConfig(configStr?: string): ScheduleConfig | null {
  if (!configStr) return null;
  try {
    return JSON.parse(configStr) as ScheduleConfig;
  } catch {
    return null;
  }
}

function generateCronExpression(config: ScheduleConfig): string {
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

export const ScheduleConfigModal: React.FC<ScheduleConfigModalProps> = React.memo(
  ({ visible, onCancel, onSuccess, canvasId, schedule }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm<ScheduleFormData>();
    const [submitting, setSubmitting] = useState(false);

    const isEditMode = !!schedule?.scheduleId;

    // Get user's local timezone
    const userTimezone = useMemo(() => {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }, []);

    // Initialize form when modal becomes visible
    useEffect(() => {
      if (visible) {
        if (schedule?.scheduleId) {
          const config = parseScheduleConfig(schedule.scheduleConfig);
          form.setFieldsValue({
            name: schedule.name || '',
            isEnabled: schedule.isEnabled ?? false,
            scheduleType: config?.type || 'daily',
            time: config?.time ? dayjs(config.time, 'HH:mm') : dayjs('08:00', 'HH:mm'),
            weekdays: config?.weekdays || [1],
            monthDays: config?.monthDays || [1],
            timezone: schedule.timezone || userTimezone,
          });
        } else {
          form.setFieldsValue({
            name: '',
            isEnabled: true,
            scheduleType: 'daily',
            time: dayjs('08:00', 'HH:mm'),
            weekdays: [1],
            monthDays: [1],
            timezone: userTimezone,
          });
        }
      }
    }, [visible, schedule, form, userTimezone]);

    const scheduleType = Form.useWatch('scheduleType', form);
    const selectedTime = Form.useWatch('time', form);
    const selectedTimezone = Form.useWatch('timezone', form);
    const selectedWeekdays = Form.useWatch('weekdays', form);
    const selectedMonthDays = Form.useWatch('monthDays', form);

    // Calculate next run time preview
    const nextRunPreview = useMemo(() => {
      if (!selectedTime || !selectedTimezone) return null;

      const timeStr = selectedTime.format('HH:mm');
      const [hour, minute] = timeStr.split(':').map(Number);

      let nextRun = dayjs().tz(selectedTimezone).hour(hour).minute(minute).second(0);

      // If the time has passed today, move to next occurrence
      if (nextRun.isBefore(dayjs())) {
        switch (scheduleType) {
          case 'daily':
            nextRun = nextRun.add(1, 'day');
            break;
          case 'weekly': {
            // Find next matching weekday
            const currentDay = nextRun.day();
            const sortedWeekdays = [...(selectedWeekdays || [1])].sort((a, b) => a - b);
            let nextDay = sortedWeekdays.find((d) => d > currentDay);
            if (!nextDay) {
              nextDay = sortedWeekdays[0];
              nextRun = nextRun.add(1, 'week');
            }
            nextRun = nextRun.day(nextDay);
            break;
          }
          case 'monthly': {
            // Find next matching day of month
            const currentDate = nextRun.date();
            const sortedMonthDays = [...(selectedMonthDays || [1])].sort((a, b) => a - b);
            let nextDate = sortedMonthDays.find((d) => d > currentDate);
            if (!nextDate) {
              nextDate = sortedMonthDays[0];
              nextRun = nextRun.add(1, 'month');
            }
            nextRun = nextRun.date(nextDate);
            break;
          }
        }
      }

      return nextRun.format('YYYY-MM-DD HH:mm');
    }, [selectedTime, selectedTimezone, scheduleType, selectedWeekdays, selectedMonthDays]);

    const handleSubmit = useCallback(async () => {
      setSubmitting(true);
      try {
        const values = await form.validateFields();

        const scheduleConfig: ScheduleConfig = {
          type: values.scheduleType,
          time: values.time.format('HH:mm'),
          ...(values.scheduleType === 'weekly' && { weekdays: values.weekdays }),
          ...(values.scheduleType === 'monthly' && { monthDays: values.monthDays }),
        };

        const cronExpression = generateCronExpression(scheduleConfig);

        const requestBody = {
          canvasId,
          name: values.name,
          cronExpression,
          scheduleConfig: JSON.stringify(scheduleConfig),
          timezone: values.timezone,
          isEnabled: values.isEnabled,
        };

        if (isEditMode && schedule?.scheduleId) {
          // Update existing schedule
          await client.post({
            url: '/schedule/update',
            body: {
              scheduleId: schedule.scheduleId,
              ...requestBody,
            },
          });
          message.success(t('schedule.updateSuccess') || 'Schedule updated successfully');
        } else {
          // Create new schedule
          await client.post({
            url: '/schedule/create',
            body: requestBody,
          });
          message.success(t('schedule.createSuccess') || 'Schedule created successfully');
        }

        onSuccess?.();
        onCancel();
      } catch (error) {
        console.error('Failed to save schedule:', error);
        message.error(t('schedule.saveFailed') || 'Failed to save schedule');
      } finally {
        setSubmitting(false);
      }
    }, [form, canvasId, isEditMode, schedule, onSuccess, onCancel, t]);

    const handleDelete = useCallback(async () => {
      if (!schedule?.scheduleId) return;

      setSubmitting(true);
      try {
        await client.post({
          url: '/schedule/delete',
          body: { scheduleId: schedule.scheduleId },
        });
        message.success(t('schedule.deleteSuccess') || 'Schedule deleted successfully');
        onSuccess?.();
        onCancel();
      } catch (error) {
        console.error('Failed to delete schedule:', error);
        message.error(t('schedule.deleteFailed') || 'Failed to delete schedule');
      } finally {
        setSubmitting(false);
      }
    }, [schedule, onSuccess, onCancel, t]);

    return (
      <Modal
        className="schedule-config-modal"
        centered
        open={visible}
        onCancel={onCancel}
        closable={false}
        title={null}
        footer={null}
        width={480}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-refly-text-0 text-lg font-semibold leading-6">
              {isEditMode
                ? t('schedule.editTitle') || 'Edit Schedule'
                : t('schedule.createTitle') || 'Create Schedule'}
            </div>
            <Button type="text" icon={<Close size={24} />} onClick={onCancel} />
          </div>

          {/* Form */}
          <Form form={form} layout="vertical">
            {/* Name */}
            <Form.Item
              label={t('schedule.name') || 'Name'}
              name="name"
              rules={[
                { required: true, message: t('schedule.nameRequired') || 'Name is required' },
              ]}
            >
              <Input
                variant="filled"
                placeholder={t('schedule.namePlaceholder') || 'Enter schedule name'}
              />
            </Form.Item>

            {/* Enable Switch */}
            <Form.Item
              label={t('schedule.enabled') || 'Enabled'}
              name="isEnabled"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            {/* Schedule Type */}
            <Form.Item label={t('schedule.frequency') || 'Frequency'} name="scheduleType">
              <Select
                options={[
                  { value: 'daily', label: t('schedule.daily') || 'Daily' },
                  { value: 'weekly', label: t('schedule.weekly') || 'Weekly' },
                  { value: 'monthly', label: t('schedule.monthly') || 'Monthly' },
                ]}
              />
            </Form.Item>

            {/* Weekdays (for weekly) */}
            {scheduleType === 'weekly' && (
              <Form.Item
                label={t('schedule.weekdays') || 'Weekdays'}
                name="weekdays"
                rules={[
                  {
                    required: true,
                    message: t('schedule.weekdaysRequired') || 'Select at least one day',
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  options={WEEKDAYS.map((d) => ({
                    ...d,
                    label: t(`schedule.weekday.${d.label.toLowerCase()}`) || d.label,
                  }))}
                  placeholder={t('schedule.selectWeekdays') || 'Select weekdays'}
                />
              </Form.Item>
            )}

            {/* Month Days (for monthly) */}
            {scheduleType === 'monthly' && (
              <Form.Item
                label={t('schedule.monthDays') || 'Days of Month'}
                name="monthDays"
                rules={[
                  {
                    required: true,
                    message: t('schedule.monthDaysRequired') || 'Select at least one day',
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  options={MONTH_DAYS}
                  placeholder={t('schedule.selectMonthDays') || 'Select days'}
                  maxTagCount={5}
                />
              </Form.Item>
            )}

            {/* Time */}
            <Form.Item
              label={t('schedule.time') || 'Time'}
              name="time"
              rules={[
                { required: true, message: t('schedule.timeRequired') || 'Time is required' },
              ]}
            >
              <TimePicker format="HH:mm" className="w-full" />
            </Form.Item>

            {/* Timezone */}
            <Form.Item label={t('schedule.timezone') || 'Timezone'} name="timezone">
              <Select
                showSearch
                options={TIMEZONES}
                placeholder={t('schedule.selectTimezone') || 'Select timezone'}
              />
            </Form.Item>

            {/* Next Run Preview */}
            {nextRunPreview && (
              <div className="p-3 bg-refly-tertiary-hover rounded-lg mb-4">
                <div className="text-sm text-refly-text-2">
                  {t('schedule.nextRun') || 'Next Run'}
                </div>
                <div className="text-base text-refly-text-0 font-medium">{nextRunPreview}</div>
              </div>
            )}
          </Form>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              {isEditMode && (
                <Button danger onClick={handleDelete} disabled={submitting}>
                  {t('common.delete') || 'Delete'}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={onCancel} disabled={submitting}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button type="primary" onClick={handleSubmit} loading={submitting}>
                {t('common.save') || 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  },
);

ScheduleConfigModal.displayName = 'ScheduleConfigModal';
