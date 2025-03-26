import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider, Typography } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import type { MenuProps, DropdownProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconDownloadFile,
  IconProject,
  IconPlus,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuPlus, LuExternalLink } from 'react-icons/lu';

import { useEffect, useState, useMemo, useCallback } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Resource } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/use-download-file';
import { useMatch, useNavigate } from 'react-router-dom';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';

const ActionDropdown = ({
  resource,
  afterDelete,
}: { resource: Resource; afterDelete: () => void }) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const { refetchUsage } = useSubscriptionUsage();
  const { addNode } = useAddNode();
  const { setShowLibraryModal } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
  }));
  const { deleteResource } = useDeleteResource();
  const { downloadFile } = useDownloadFile();
  const isShareCanvas = useMatch('/share/canvas/:canvasId');

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteResource(resource.resourceId).then((success) => {
      if (success) {
        message.success(t('common.putSuccess'));
        setPopupVisible(false);
        refetchUsage();
        afterDelete?.();
      }
    });
  };

  const handleAddToCanvas: MenuProps['onClick'] = ({ domEvent }) => {
    domEvent.stopPropagation();
    addNode(
      {
        type: 'resource',
        data: {
          title: resource.title,
          entityId: resource.resourceId,
          contentPreview: resource.contentPreview,
        },
      },
      [],
      true,
      true,
    );
    setShowLibraryModal(false);
    setPopupVisible(false);
  };

  const handleOpenWebpage: MenuProps['onClick'] = ({ domEvent }) => {
    domEvent.stopPropagation();
    if (resource.data?.url) {
      window.open(resource.data.url, '_blank');
      setPopupVisible(false);
    }
  };

  const handleDownloadFile: MenuProps['onClick'] = ({ domEvent }) => {
    domEvent.stopPropagation();
    downloadFile(resource);
    setPopupVisible(false);
  };

  const items: MenuProps['items'] = [
    !isShareCanvas && {
      label: (
        <div className="flex items-center flex-grow">
          <LuPlus size={16} className="mr-2" />
          {t('workspace.addToCanvas')}
        </div>
      ),
      key: 'addToCanvas',
      onClick: handleAddToCanvas,
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <LuExternalLink size={16} className="mr-2" />
          {t('workspace.openWebpage')}
        </div>
      ),
      key: 'openWebpage',
      onClick: handleOpenWebpage,
      disabled: !resource.data?.url,
    },
    resource.downloadURL &&
      resource.resourceType === 'file' && {
        label: (
          <div className="flex items-center flex-grow">
            <IconDownloadFile size={16} className="mr-2" />
            {t('workspace.downloadFile')}
          </div>
        ),
        key: 'downloadFile',
        onClick: handleDownloadFile,
      },
    {
      label: (
        <Popconfirm
          placement="bottomLeft"
          title={t('canvas.nodeActions.resourceDeleteConfirm', {
            title: resource.title || t('common.untitled'),
          })}
          onConfirm={handleDelete}
          onCancel={(e?: React.MouseEvent) => {
            e?.stopPropagation();
            setPopupVisible(false);
          }}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div
            className="flex items-center text-red-600 flex-grow"
            onClick={(e) => e.stopPropagation()}
          >
            <IconDelete size={16} className="mr-2" />
            {t('workspace.deleteDropdownMenu.delete')}
          </div>
        </Popconfirm>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{ items }}
    >
      <Button
        type="text"
        icon={<IconMoreHorizontal />}
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
    </Dropdown>
  );
};

const ProjectCard = ({ item, onDelete }: { item: Resource; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    console.log('handleCardClick', e);
    navigate('/project/123?canvasId=c-hn0joweqr7zv6mv3jgqz9dwq');
  };

  return (
    <div
      className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200"
      onClick={handleCardClick}
    >
      <div className="h-36 px-4 py-3 overflow-hidden">
        <Markdown
          content={item.contentPreview || t('canvas.nodePreview.resource.noContentPreview')}
          className="text-xs opacity-80"
        />
      </div>
      <Divider className="m-0 text-gray-200" />
      <div className="px-3 pt-2 pb-1 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3 mb-2">
          <IconProject color="#6172F3" size={22} />
          <div className="flex-1 min-w-0">
            <Typography.Text className="text-sm font-medium w-48" ellipsis={{ tooltip: true }}>
              {item.title || t('common.untitled')}
            </Typography.Text>
            <p className="text-xs text-gray-500">
              {time(item.updatedAt, language as LOCALE)
                .utc()
                .fromNow()}
            </p>
          </div>
        </div>
        <ActionDropdown resource={item} afterDelete={onDelete} />
      </div>
    </div>
  );
};

const ProjectList = () => {
  const { t } = useTranslation();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { showLibraryModal } = useSiderStoreShallow((state) => ({
    showLibraryModal: state.showLibraryModal,
  }));

  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listResources({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  const resourceCards = useMemo(() => {
    return dataList?.map((item) => (
      <ProjectCard
        key={item.resourceId}
        item={item}
        onDelete={() => setDataList(dataList.filter((n) => n.resourceId !== item.resourceId))}
      />
    ));
  }, [dataList, setDataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  useEffect(() => {
    if (showLibraryModal) {
      reload();
    } else {
      setDataList([]);
    }
  }, [showLibraryModal]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('common.empty')}>
        <Button
          className="text-[#00968F]"
          icon={<IconPlus className="-mr-1 flex items-center justify-center" />}
          onClick={() => {
            setCreateProjectModalVisible(true);
          }}
        >
          {t('project.create')}
        </Button>
      </Empty>
      <CreateProjectModal
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
      />
    </div>
  );

  return (
    <Spin className="w-full h-full" spinning={isRequesting && dataList.length === 0}>
      <div id="resourceScrollableDiv" className="w-full h-[calc(60vh-60px)] overflow-y-auto">
        {dataList.length > 0 ? (
          <InfiniteScroll
            dataLength={dataList.length}
            next={handleLoadMore}
            hasMore={hasMore}
            loader={<Spinner />}
            endMessage={<EndMessage />}
            scrollableTarget="resourceScrollableDiv"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {resourceCards}
            </div>
          </InfiniteScroll>
        ) : (
          !isRequesting && emptyState
        )}
      </div>
    </Spin>
  );
};

export { ProjectList };
