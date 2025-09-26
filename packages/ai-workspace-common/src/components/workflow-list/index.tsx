import { useEffect, useCallback, useMemo, memo, useState } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { Canvas } from '@refly/openapi-schema';
import { Empty, Typography, Button, Input, Avatar, Tag, Table, Space } from 'antd';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { LOCALE } from '@refly/common-types';
import { Search } from 'refly-icons';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import './index.scss';
import { WorkflowActionDropdown } from '@refly-packages/ai-workspace-common/components/workflow-list/workflowActionDropdown';

// Helper function to get mock data for demonstration
const getMockData = () => {
  const isShared = Math.random() > 0.5;
  const ownerName = 'Tylor swift';
  const tags = ['+5'];
  return { isShared, ownerName, tags };
};

const WorkflowList = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const language = i18n.languages?.[0];

  const { setDataList, loadMore, reload, dataList, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listCanvases({
        query: queryPayload,
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 20,
  });

  useEffect(() => {
    reload();
  }, []);

  const afterDelete = useCallback(
    (canvas: Canvas) => {
      setDataList(dataList.filter((n) => n.canvasId !== canvas.canvasId));
    },
    [dataList, setDataList],
  );

  const handleCreateWorkflow = useCallback(() => {
    // Handle create workflow
    console.log('Create workflow clicked');
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    // Implement search logic here
  }, []);

  const handleEdit = useCallback(
    (canvas: Canvas) => {
      navigate(`/canvas/${canvas.canvasId}`);
    },
    [navigate],
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
        title: t('workflowList.workflowName'),
        dataIndex: 'title',
        key: 'title',
        width: 376,
        fixed: 'left' as const,
        render: (text: string, _record: Canvas) => (
          <Typography.Text
            className="ml-4 text-base text-refly-text-0 cursor-pointer hover:text-refly-text-1"
            ellipsis={{ tooltip: true }}
          >
            {text || t('common.untitled')}
          </Typography.Text>
        ),
      },
      {
        title: t('workflowList.status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: () => {
          const { isShared } = getMockData();
          return (
            <Tag color={isShared ? 'default' : 'default'} className="text-xs">
              {isShared ? t('workflowList.shared') : t('workflowList.personal')}
            </Tag>
          );
        },
      },
      {
        title: t('workflowList.tools'),
        dataIndex: 'tools',
        key: 'tools',
        width: 120,
        render: () => {
          const { tags } = getMockData();
          return (
            <Space size="small">
              <div className="w-6 h-6 bg-gradient-to-r from-red-400 to-green-400 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">W</span>
              </div>
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">N</span>
              </div>
              <Tag className="text-xs">{tags[0]}</Tag>
            </Space>
          );
        },
      },
      {
        title: t('workflowList.owner'),
        dataIndex: 'owner',
        key: 'owner',
        width: 150,
        render: () => {
          const { ownerName } = getMockData();
          return (
            <Space size="small">
              <Avatar size={20} className="bg-gray-300 dark:bg-gray-600">
                {ownerName.charAt(0).toUpperCase()}
              </Avatar>
              <span className="text-sm text-gray-600 dark:text-gray-400">{ownerName}</span>
            </Space>
          );
        },
      },
      {
        title: t('workflowList.lastModified'),
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 120,
        render: (updatedAt: string) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {time(updatedAt, language as LOCALE)
              .utc()
              .format('YYYY-MM-DD')}
          </span>
        ),
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 106,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_, record: Canvas) => {
          return (
            <div className="flex items-center flex-shrink-0">
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
          <div className="text-refly-text-2 leading-5 text-sm">{t('workflowList.noWorkflows')}</div>
        }
        image={EmptyImage}
        imageStyle={{ width: 180, height: 180 }}
      >
        <Button type="primary" onClick={handleCreateWorkflow}>
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

          <Button type="primary" onClick={handleCreateWorkflow}>
            {t('workflowList.createWorkflow')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-6">
        {dataList.length > 0 ? (
          <div className="h-full flex flex-col">
            <Table
              columns={columns}
              dataSource={dataList}
              rowKey="canvasId"
              pagination={false}
              scroll={{ y: 'calc(100vh - 144px)' }}
              className="workflow-table flex-1"
              size="middle"
              showHeader={true}
              onRow={() => ({
                className:
                  'cursor-pointer hover:!bg-refly-tertiary-hover transition-colors duration-200',
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
