import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider } from 'antd';
import type { MenuProps, DropdownProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconImportResource,
  IconDownloadFile,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuPlus, LuExternalLink } from 'react-icons/lu';

import { useEffect, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Resource } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';
import { getClientOrigin } from '@refly-packages/utils/url';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/use-download-file';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';

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
    addNode({
      type: 'resource',
      data: {
        title: resource.title,
        entityId: resource.resourceId,
        contentPreview: resource.contentPreview,
      },
    });
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
    downloadFile(resource.rawFileKey);
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center">
          <LuPlus size={16} className="mr-2" />
          {t('workspace.addToCanvas')}
        </div>
      ),
      key: 'addToCanvas',
      onClick: handleAddToCanvas,
    },
    {
      label: (
        <div className="flex items-center">
          <LuExternalLink size={16} className="mr-2" />
          {t('workspace.openWebpage')}
        </div>
      ),
      key: 'openWebpage',
      onClick: handleOpenWebpage,
      disabled: !resource.data?.url,
    },
    resource.rawFileKey &&
      resource.resourceType === 'file' && {
        label: (
          <div className="flex items-center">
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
          <div className="flex items-center text-red-600" onClick={(e) => e.stopPropagation()}>
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

const ResourceCard = ({ item, onDelete }: { item: Resource; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  const handleCardClick = (e: React.MouseEvent) => {
    // Only open URL if click target is the card itself or its direct children
    // (excluding the dropdown menu and its children)
    const target = e.target as HTMLElement;
    const isMenuClick = target.closest('.ant-dropdown') || target.closest('.ant-btn');

    if (!isMenuClick && item.data?.url) {
      window.open(item.data.url, '_blank');
    }
  };

  let url = '';
  try {
    url = new URL(item?.data?.url || getClientOrigin()).hostname;
  } catch (error) {
    console.warn(`invalid url: ${item?.data?.url}, error: ${error}`);
  }

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
          <ResourceIcon
            url={url}
            resourceType={item?.resourceType}
            extension={item?.rawFileKey?.split('.').pop()}
            size={24}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium max-w-48 truncate">
              {item.title || t('common.untitled')}
            </h3>
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

export const ResourceList = () => {
  const { t } = useTranslation();
  const { showLibraryModal, setShowLibraryModal } = useSiderStoreShallow((state) => ({
    showLibraryModal: state.showLibraryModal,
    setShowLibraryModal: state.setShowLibraryModal,
  }));
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
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

  useEffect(() => {
    if (showLibraryModal) {
      reload();
    }
  }, [showLibraryModal]);

  return (
    <Spin className="w-full h-full" spinning={isRequesting}>
      <div className="w-full h-[calc(50vh-60px)] overflow-y-auto">
        {isRequesting || dataList.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {dataList.map((item) => (
                <ResourceCard
                  key={item.resourceId}
                  item={item}
                  onDelete={() =>
                    setDataList(dataList.filter((n) => n.resourceId !== item.resourceId))
                  }
                />
              ))}
            </div>
            <ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <Empty description={t('common.empty')}>
              <Button
                className="text-[#00968F]"
                icon={<IconImportResource className="-mr-1 flex items-center justify-center" />}
                onClick={() => {
                  setShowLibraryModal(false);
                  setImportResourceModalVisible(true);
                }}
              >
                {t('canvas.toolbar.importResource')}
              </Button>
            </Empty>
          </div>
        )}
      </div>
    </Spin>
  );
};
