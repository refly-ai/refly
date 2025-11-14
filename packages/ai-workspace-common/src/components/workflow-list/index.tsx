import { useEffect, useCallback, useMemo, memo, useState } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { Canvas, GenericToolset } from '@refly/openapi-schema';
import { Empty, Typography, Button, Input, Avatar, Tag, Table, Space } from 'antd';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { LOCALE } from '@refly/common-types';
import { Search, Sort, SortAsc } from 'refly-icons';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import './index.scss';
import { WorkflowActionDropdown } from '@refly-packages/ai-workspace-common/components/workflow-list/workflowActionDropdown';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { ListOrder, ShareUser } from '@refly/openapi-schema';
import { UsedToolsets } from '@refly-packages/ai-workspace-common/components/workflow-list/used-toolsets';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';
import { useDebouncedCallback } from 'use-debounce';
import { useSiderStoreShallow } from '@refly/stores';

const WorkflowList = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.languages?.[0];
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');

  const [orderType, setOrderType] = useState<ListOrder>('updationDesc');

  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas({});

  const { setIsManualCollapse } = useSiderStoreShallow((state) => ({
    setIsManualCollapse: state.setIsManualCollapse,
  }));

  const { setDataList, loadMore, reload, dataList, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listCanvases({
        query: {
          ...queryPayload,
          order: orderType,
          keyword: debouncedSearchValue?.trim() || undefined,
        },
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 20,
    dependencies: [orderType, debouncedSearchValue],
  });

  const debouncedSetSearchValue = useDebouncedCallback((value: string) => {
    setDebouncedSearchValue(value);
  }, 300);

  // Debounce search value changes
  useEffect(() => {
    debouncedSetSearchValue(searchValue);
  }, [searchValue]);

  const handleOrderType = useCallback(() => {
    setOrderType(orderType === 'updationAsc' ? 'updationDesc' : 'updationAsc');
  }, [orderType]);

  const afterDelete = useCallback(
    (canvas: Canvas) => {
      setDataList(dataList.filter((n) => n.canvasId !== canvas.canvasId));
    },
    [dataList, setDataList],
  );

  const handleCreateWorkflow = useCallback(() => {
    debouncedCreateCanvas();
  }, [debouncedCreateCanvas]);

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleEdit = useCallback(
    (canvas: Canvas) => {
      setIsManualCollapse(false);
      navigate(`/canvas/${canvas.canvasId}`);
    },
    [navigate, setIsManualCollapse],
  );

  // Auto scroll loading effect
  useEffect(() => {
    const scrollContainer = document.querySelector('.workflow-table .ant-table-body');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

      if (isNearBottom && !isRequesting && hasMore) {
        loadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isRequesting, hasMore, loadMore]);

  // Table columns configuration
  const columns = useMemo(
    () => [
      {
        title: t('workflowList.tableTitle.workflowName'),
        dataIndex: 'title',
        key: 'title',
        width: 336,
        fixed: 'left' as const,
        render: (text: string, record: Canvas) => {
          const isShared = record?.shareRecord?.shareId;
          const isPublished = record?.workflowApp?.shareId;
          return (
            <div className="flex items-center gap-2">
              <Typography.Text
                className="text-base text-refly-text-0 cursor-pointer hover:text-refly-text-1"
                ellipsis={{ tooltip: true }}
              >
                {text || t('common.untitled')}
              </Typography.Text>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isShared && (
                  <Tag color="default" className="text-xs">
                    {t('workflowList.shared')}
                  </Tag>
                )}
                {isPublished && (
                  <Tag color="success" className="text-xs">
                    {t('workflowList.published')}
                  </Tag>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: t('workflowList.tableTitle.tools'),
        dataIndex: 'usedToolsets',
        key: 'usedToolsets',
        width: 140,
        render: (usedToolsets: GenericToolset[]) => {
          return (
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <UsedToolsets toolsets={usedToolsets} />
            </div>
          );
        },
      },
      {
        title: t('workflowList.tableTitle.owner'),
        dataIndex: 'owner',
        key: 'owner',
        width: 150,
        render: (owner: ShareUser) => {
          const ownerName = owner?.name || t('common.untitled');
          const ownerNickname = owner?.nickname;
          const ownerAvatar = owner?.avatar;
          return (
            <Space size="small">
              <Avatar
                size={20}
                className="bg-gray-300 dark:bg-gray-600"
                src={ownerAvatar || defaultAvatar}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {ownerNickname ? ownerNickname : ownerName}
              </span>
            </Space>
          );
        },
      },
      {
        title: t('workflowList.tableTitle.lastModified'),
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 120,
        render: (updatedAt: string) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {time(updatedAt, language as LOCALE)
              .utc()
              .fromNow()}
          </span>
        ),
      },
      {
        title: t('workflowList.tableTitle.actions'),
        key: 'actions',
        width: 106,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_, record: Canvas) => {
          return (
            <div className="flex items-center justify-center flex-shrink-0">
              <Button
                type="text"
                size="small"
                className="!text-refly-primary-default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
              <WorkflowActionDropdown
                workflow={record}
                onDeleteSuccess={afterDelete}
                onRenameSuccess={reload}
              >
                <Button type="text" size="small" className="!text-refly-primary-default">
                  {t('common.more')}
                </Button>
              </WorkflowActionDropdown>
            </div>
          );
        },
      },
    ],
    [t, language, handleEdit, afterDelete, reload],
  );

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty
        description={
          <div className="text-refly-text-2 leading-5 text-sm">
            {searchValue ? t('workflowList.noSearchResults') : t('workflowList.noWorkflows')}
          </div>
        }
        image={EmptyImage}
        imageStyle={{ width: 180, height: 180 }}
      >
        <Button type="primary" onClick={handleCreateWorkflow} loading={createCanvasLoading}>
          {t('workflowList.creatYourWorkflow')}
        </Button>
      </Empty>
    </div>
  );

  return (
    <div className="workflow-list w-full h-full flex flex-col overflow-hidden rounded-xl border border-solid border-refly-Card-Border bg-refly-bg-main-z1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 gap-2">
        <div className="text-[16px] font-semibold">{t('workflowList.title')}</div>

        {/* Search and Actions Bar */}
        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder={t('workflowList.searchWorkflows')}
            suffix={<Search size={16} color="var(--refly-text-2)" />}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
            allowClear
          />
          <Button
            className="flex-shrink-0 w-8 h-8 p-0 flex items-center justify-center"
            onClick={handleOrderType}
          >
            {orderType === 'updationAsc' ? (
              <SortAsc size={20} color="var(--refly-text-0)" />
            ) : (
              <Sort size={20} color="var(--refly-text-0)" />
            )}
          </Button>

          <Button type="primary" onClick={handleCreateWorkflow} loading={createCanvasLoading}>
            {t('workflowList.createWorkflow')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-6">
        {dataList.length > 0 ? (
          <div className="h-full flex flex-col px-4">
            <Table
              columns={columns}
              dataSource={dataList}
              rowKey="canvasId"
              pagination={false}
              scroll={{ y: 'calc(var(--screen-height) - 190px)' }}
              className="workflow-table flex-1"
              size="middle"
              onRow={(record: Canvas) => ({
                className:
                  'cursor-pointer hover:!bg-refly-tertiary-hover transition-colors duration-200',

                onClick: () => {
                  handleEdit(record);
                },
              })}
              style={{
                backgroundColor: 'transparent',
              }}
            />
            {/* Load more indicator */}
            {hasMore ? (
              <div className="flex justify-center py-4 border-t border-refly-Card-Border">
                {isRequesting ? (
                  <div className="flex items-center gap-2 text-sm text-refly-text-2">
                    <Spin size="small" className="!text-refly-text-2" />
                    <span>{t('common.loading')}</span>
                  </div>
                ) : (
                  <Button
                    type="text"
                    className="!text-refly-primary-default"
                    onClick={() => loadMore()}
                  >
                    {t('common.loadMore')}
                  </Button>
                )}
              </div>
            ) : (
              <EndMessage />
            )}
          </div>
        ) : isRequesting ? (
          <div className="h-full w-full flex items-center justify-center">
            <Spin />
          </div>
        ) : (
          emptyState
        )}
      </div>
    </div>
  );
});

WorkflowList.displayName = 'WorkflowList';

export default WorkflowList;
