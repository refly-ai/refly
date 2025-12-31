import { useCallback, useMemo, memo, useEffect } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';

import { Empty, Typography, Table, Tooltip } from 'antd';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { SettingItem } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { LOCALE } from '@refly/common-types';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { RunHistoryFilters, RunStatusFilter, RunTypeFilter } from './run-history-filters';
import { UsedTools } from './used-tools';
import { client } from '@refly/openapi-schema';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { useState } from 'react';
import { logEvent } from '@refly/telemetry-web';
import {
  getFailureActionConfig,
  getFailureReasonText,
  FailureActionType,
} from '@refly-packages/ai-workspace-common/hooks/use-schedule-failure-action';
import { useSubscriptionStoreShallow } from '@refly/stores';
import './index.scss';

type ScheduleRecordStatus = 'success' | 'failed';

interface ScheduleRecordItem {
  scheduleRecordId: string;
  scheduleId?: string;
  scheduleName: string;
  workflowTitle?: string;
  status: ScheduleRecordStatus;
  scheduledAt: string;
  triggeredAt?: string;
  completedAt?: string;
  creditUsed: number;
  failureReason?: string;
  usedTools?: string;
  canvasId?: string;
}

interface AvailableTool {
  id: string;
  name: string;
}

// Action cell component for table - handles failure actions per row
const ActionCell = memo(
  ({ record, onViewDetail }: { record: ScheduleRecordItem; onViewDetail: () => void }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { planType, setCreditInsufficientModalVisible } = useSubscriptionStoreShallow(
      (state) => ({
        planType: state.planType,
        setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
      }),
    );

    const actionConfig = useMemo(
      () => getFailureActionConfig(record.failureReason, planType, t),
      [record.failureReason, planType, t],
    );

    const handleActionClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!actionConfig) return;

        switch (actionConfig.actionType as FailureActionType) {
          case 'upgrade':
          case 'buyCredits':
            setCreditInsufficientModalVisible(true);
            break;
          case 'viewSchedule':
            navigate('/workflow');
            break;
          case 'fixWorkflow':
            if (record.canvasId) {
              navigate(`/canvas/${record.canvasId}`);
            }
            break;
        }
      },
      [actionConfig, setCreditInsufficientModalVisible, navigate, record.canvasId],
    );

    if (record.status === 'success') {
      return (
        <div
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail();
          }}
        >
          <span className="text-teal-600 hover:text-teal-700 text-sm">
            {t('runHistory.runDetail')}
          </span>
        </div>
      );
    }

    // Failed status - only show action based on failure reason (no Run Detail link)
    if (actionConfig) {
      return (
        <div
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={handleActionClick}
        >
          <span className="text-teal-600 hover:text-teal-700 text-sm">{actionConfig.label}</span>
        </div>
      );
    }

    return null;
  },
);

ActionCell.displayName = 'ActionCell';

const RunHistoryList = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const language = i18n.languages?.[0];

  // Get filter values from URL params
  const titleFilter = searchParams.get('title') || '';
  const canvasIdFilter = searchParams.get('canvasId') || '';
  const typeFilter = (searchParams.get('type') as RunTypeFilter) || 'all';
  const statusFilter = (searchParams.get('status') as RunStatusFilter) || 'all';
  const toolsParam = searchParams.get('tools') || '';
  const selectedTools = useMemo(() => toolsParam.split(',').filter(Boolean), [toolsParam]);

  // Available tools state
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);

  // Update URL params helper
  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const newParams = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Filter change handlers
  const handleTitleChange = useCallback(
    (value: string) => {
      updateSearchParams({ title: value || undefined });
    },
    [updateSearchParams],
  );

  const handleCanvasIdChange = useCallback(
    (value: string) => {
      updateSearchParams({ canvasId: value || undefined });
    },
    [updateSearchParams],
  );

  const handleTypeChange = useCallback(
    (value: RunTypeFilter) => {
      updateSearchParams({ type: value === 'all' ? undefined : value });
    },
    [updateSearchParams],
  );

  const handleStatusChange = useCallback(
    (value: RunStatusFilter) => {
      updateSearchParams({ status: value === 'all' ? undefined : value });
    },
    [updateSearchParams],
  );

  const handleToolsChange = useCallback(
    (tools: string[]) => {
      updateSearchParams({ tools: tools.length > 0 ? tools.join(',') : undefined });
    },
    [updateSearchParams],
  );

  // Fetch available tools
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await client.post({
          url: '/schedule/records/tools',
          body: {},
        });
        const data = (response.data as any)?.data;
        if (Array.isArray(data)) {
          setAvailableTools(data as AvailableTool[]);
        }
      } catch (error) {
        console.error('Failed to fetch available tools:', error);
      }
    };
    fetchTools();
  }, []);

  // Fetch data using useFetchDataList hook
  const fetchScheduleRecords = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      try {
        const response = await client.post({
          url: '/schedule/records/list',
          body: {
            page,
            pageSize,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            keyword: titleFilter || undefined,
            canvasId: canvasIdFilter || undefined,
            tools: selectedTools.length > 0 ? selectedTools : undefined,
          },
        });

        const responseData = (response.data as any)?.data;
        if (responseData) {
          return {
            success: true,
            data: responseData.items || [],
          };
        }
        return { success: false, data: [] };
      } catch (error) {
        console.error('Failed to fetch schedule records:', error);
        return { success: false, data: [] };
      }
    },
    [statusFilter, titleFilter, canvasIdFilter, selectedTools],
  );

  const { dataList, isRequesting, reload } = useFetchDataList<ScheduleRecordItem>({
    fetchData: fetchScheduleRecords,
    pageSize: 20,
    dependencies: [statusFilter, titleFilter, canvasIdFilter, selectedTools],
  });

  // Initial load
  useEffect(() => {
    reload();
  }, []);

  const handleViewDetail = useCallback(
    (record: ScheduleRecordItem) => {
      // Log run_detail_view event
      logEvent('run_detail_view', Date.now(), {
        type: 'schedule',
        recordId: record.scheduleRecordId,
        canvasId: record.canvasId,
        status: record.status,
      });
      navigate(`/run-history/${record.scheduleRecordId}`);
    },
    [navigate],
  );

  // Get status display config
  const getStatusConfig = useCallback(
    (status: ScheduleRecordStatus) => {
      const configs = {
        success: {
          label: t('runHistory.status.succeeded'),
          color: 'success' as const,
          textClass: 'text-refly-text-2',
        },
        failed: {
          label: t('runHistory.status.failed'),
          color: 'error' as const,
          textClass: 'text-red-600',
        },
      };
      return configs[status] || configs.success;
    },
    [t],
  );

  // Table columns configuration
  const columns = useMemo(
    () => [
      {
        title: t('runHistory.tableTitle.title'),
        dataIndex: 'scheduleName',
        key: 'scheduleName',
        width: 300,
        fixed: 'left' as const,
        render: (_: string, record: ScheduleRecordItem) => (
          <Typography.Text
            className="text-sm text-refly-text-0 cursor-pointer hover:text-refly-text-1"
            onClick={() => handleViewDetail(record)}
            ellipsis={{ tooltip: true }}
          >
            {record.workflowTitle || record.scheduleName || t('common.untitled')}
          </Typography.Text>
        ),
      },
      {
        title: t('runHistory.tableTitle.time'),
        dataIndex: 'scheduledAt',
        key: 'scheduledAt',
        width: 180,
        align: 'center' as const,
        render: (scheduledAt: string) => (
          <span className="text-sm text-gray-500">
            {time(scheduledAt, language as LOCALE).format('YYYY/MM/DD, hh:mm:ss A')}
          </span>
        ),
      },
      {
        title: t('runHistory.tableTitle.tools'),
        dataIndex: 'usedTools',
        key: 'usedTools',
        width: 160,
        render: (usedTools: string) => <UsedTools usedTools={usedTools} />,
      },
      {
        title: t('runHistory.tableTitle.status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        align: 'center' as const,
        render: (status: ScheduleRecordStatus, record: ScheduleRecordItem) => {
          const config = getStatusConfig(status);
          const statusElement = (
            <span className={`text-sm font-medium ${config.textClass}`}>{config.label}</span>
          );

          // Show tooltip with failure reason for failed status
          if (status === 'failed' && record.failureReason) {
            const reasonText = getFailureReasonText(record.failureReason, t);
            return (
              <Tooltip
                title={reasonText}
                placement="bottom"
                autoAdjustOverflow
                arrow={false}
                overlayClassName="failure-reason-tooltip"
                overlayStyle={{
                  maxWidth: 300,
                }}
              >
                <span className={`text-sm font-medium ${config.textClass} cursor-pointer`}>
                  {config.label}
                </span>
              </Tooltip>
            );
          }

          return statusElement;
        },
      },
      {
        title: t('runHistory.tableTitle.cost'),
        dataIndex: 'creditUsed',
        key: 'creditUsed',
        width: 100,
        align: 'center' as const,
        render: (creditUsed: number) => (
          <span className="text-sm text-gray-500">
            {creditUsed ?? 0} {t('runDetail.creditUnit')}
          </span>
        ),
      },
      {
        title: t('runHistory.tableTitle.actions'),
        key: 'actions',
        width: 180,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_: unknown, record: ScheduleRecordItem) => (
          <ActionCell record={record} onViewDetail={() => handleViewDetail(record)} />
        ),
      },
    ],
    [t, language, getStatusConfig, handleViewDetail],
  );

  // Check if any filters are active
  const hasActiveFilters =
    !!titleFilter ||
    !!canvasIdFilter ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    selectedTools.length > 0;

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty
        description={
          <div className="text-gray-400 leading-5 text-sm">
            {hasActiveFilters ? t('runHistory.noSearchResults') : t('runHistory.noRuns')}
          </div>
        }
        image={EmptyImage}
        imageStyle={{ width: 180, height: 180 }}
      />
    </div>
  );

  return (
    <div className="run-history-list w-full h-full flex flex-col overflow-hidden rounded-xl border border-solid border-refly-Card-Border bg-refly-bg-main-z1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 gap-2">
        <div className="text-[16px] font-semibold">{t('runHistory.title')}</div>

        <div className="flex items-center gap-2">
          <div className="group relative">
            <SettingItem showName={false} avatarAlign={'right'} />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className={`px-4 ${hasActiveFilters ? 'pb-6' : 'pb-5'}`}>
        <RunHistoryFilters
          titleFilter={titleFilter}
          onTitleChange={handleTitleChange}
          canvasIdFilter={canvasIdFilter}
          onCanvasIdChange={handleCanvasIdChange}
          typeFilter={typeFilter}
          onTypeChange={handleTypeChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          selectedTools={selectedTools}
          onToolsChange={handleToolsChange}
          availableTools={availableTools}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-6">
        {isRequesting && dataList.length === 0 ? (
          <div className="h-[400px] w-full flex items-center justify-center">
            <Spin />
          </div>
        ) : dataList.length > 0 ? (
          <div className="h-full flex flex-col px-4">
            <Table
              columns={columns}
              dataSource={dataList}
              rowKey="scheduleRecordId"
              pagination={false}
              scroll={{ y: 'calc(var(--screen-height) - 240px)' }}
              className="run-history-table flex-1"
              size="middle"
              loading={isRequesting}
              onRow={(record: ScheduleRecordItem) => ({
                onClick: () => handleViewDetail(record),
                className: 'cursor-pointer hover:!bg-refly-tertiary-hover transition-colors',
              })}
            />
            <EndMessage />
          </div>
        ) : (
          emptyState
        )}
      </div>
    </div>
  );
});

RunHistoryList.displayName = 'RunHistoryList';

export default RunHistoryList;
