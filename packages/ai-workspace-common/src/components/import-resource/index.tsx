import { Divider, Modal, Button, Segmented, message } from 'antd';
import { ImportResourceMenuItem, useImportResourceStoreShallow } from '@refly/stores';

import { useTranslation } from 'react-i18next';

import './index.scss';
import { useEffect, memo, useMemo, useState, useCallback } from 'react';
// import { getRuntime } from '@refly/utils/env';
import MultilingualSearch from '@refly-packages/ai-workspace-common/modules/multilingual-search';
import { ImportFromWeblink } from './intergrations/import-from-weblink';
import { ImportFromFile } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/import-from-file';
import { ImportFromExtension } from './intergrations/import-from-extension';
import { Close, Cuttools } from 'refly-icons';
import WaitingList from './components/waiting-list';
import { StorageLimit } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/storageLimit';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { getAvailableFileCount } from '@refly/utils/quota';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

export const ImportResourceModal = memo(() => {
  const { t } = useTranslation();
  const {
    extensionModalVisible,
    importResourceModalVisible,
    setImportResourceModalVisible,
    selectedMenuItem,
    setSelectedMenuItem,
    setInsertNodePosition,
    insertNodePosition,
    waitingList,
    clearWaitingList,
    setExtensionModalVisible,
  } = useImportResourceStoreShallow((state) => ({
    extensionModalVisible: state.extensionModalVisible,
    importResourceModalVisible: state.importResourceModalVisible,
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    selectedMenuItem: state.selectedMenuItem,
    setSelectedMenuItem: state.setSelectedMenuItem,
    setInsertNodePosition: state.setInsertNodePosition,
    insertNodePosition: state.insertNodePosition,
    waitingList: state.waitingList,
    clearWaitingList: state.clearWaitingList,
    setExtensionModalVisible: state.setExtensionModalVisible,
  }));
  const [showSearchResults, setShowSearchResults] = useState(false);
  const handleExtensionClick = useCallback(() => {
    setExtensionModalVisible(true);
  }, []);

  const [saveLoading, setSaveLoading] = useState(false);
  const { projectId } = useGetProjectCanvasId();
  const { refetchUsage, storageUsage } = useSubscriptionUsage();
  const canImportCount = getAvailableFileCount(storageUsage);
  const { updateSourceList } = useUpdateSourceList();

  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);

  // TODO: 移动端支持 , 之前用了isWeb来判断是否展示菜单选项
  // const runtime = getRuntime();
  // const isWeb = runtime === 'web';

  // TODO: 计算文件数量时需要去除上传的图片吗？需要测试一下文件余额不足的情况不能上传
  const disableSave = useMemo(() => {
    return saveLoading || waitingList.length === 0 || waitingList.length > canImportCount;
  }, [waitingList, canImportCount, saveLoading]);

  const importResourceOptions = useMemo(() => {
    return [
      {
        label: t('resource.import.fromWebSearch'),
        value: 'import-from-web-search',
      },
      {
        label: t('resource.import.fromFile'),
        value: 'import-from-file',
      },
      {
        label: t('resource.import.fromWeblink'),
        value: 'import-from-weblink',
      },
    ];
  }, [t]);

  useEffect(() => {
    return () => {
      setInsertNodePosition(null);
    };
  }, [setInsertNodePosition]);

  const handleSaveToCanvas = async () => {
    if (waitingList.length === 0) {
      return;
    }

    setSaveLoading(true);
    try {
      const batchCreateResourceData: UpsertResourceRequest[] = waitingList
        .filter((item) => item.file?.type !== 'image')
        .map((item) => {
          // For weblink items, use the link data if available
          if (item.type === 'weblink' && item.link) {
            return {
              projectId: currentProjectId,
              resourceType: 'weblink',
              title: item.link.title || item.title || item.url || '',
              data: {
                url: item.url,
                title: item.link.title || item.title || '',
                description: item.link.description || '',
                image: item.link.image || '',
              },
            };
          }

          // For other types, use the basic item data
          return {
            projectId: currentProjectId,
            resourceType: item.type,
            title: item.title ?? '',
            storageKey: item.file?.storageKey,
            data: {
              url: item.url,
              title: item.title,
              content: item.content,
            },
          };
        });

      const { data } = await getClient().batchCreateResource({
        body: batchCreateResourceData,
      });

      if (!data?.success) {
        return;
      }

      refetchUsage();
      message.success(t('common.putSuccess'));

      const resources = data && Array.isArray(data.data) ? data.data : [];
      resources.forEach((resource, index) => {
        const nodePosition = insertNodePosition
          ? {
              x: insertNodePosition?.x + index * 300,
              y: insertNodePosition?.y,
            }
          : undefined;

        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: 'resource',
            data: {
              title: resource.title,
              entityId: resource.resourceId,
              contentPreview: resource.contentPreview,
              metadata: {
                resourceType: resource.resourceType,
                resourceMeta: resource.data,
              },
            },
            position: nodePosition,
          },
        });
      });

      const images = waitingList.filter((item) => item.file?.type === 'image');
      for (const item of images) {
        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: 'image',
            data: {
              title: item.title,
              entityId: item.file?.storageKey,
              metadata: {
                imageUrl: item.file?.url,
                storageKey: item.file?.storageKey,
              },
            },
          },
        });
      }

      // Update source list and clear waiting list after successful save
      updateSourceList(data && Array.isArray(data.data) ? data.data : [], currentProjectId);
      clearWaitingList();
      setImportResourceModalVisible(false);
    } catch (error) {
      console.error('Error saving to canvas:', error);
      message.error(t('common.saveFailed'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    setImportResourceModalVisible(false);
  };

  return (
    <>
      <Modal
        width={740}
        height={800}
        className="extension-modal"
        open={extensionModalVisible}
        onCancel={() => setExtensionModalVisible(false)}
        footer={null}
        title={null}
        closable={false}
        centered
      >
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between py-5 px-6">
            <Logo />
            <Button
              type="text"
              icon={<Close size={24} color="var(--refly-text-0)" />}
              onClick={() => setExtensionModalVisible(false)}
            />
          </div>
          <ImportFromExtension />
        </div>
      </Modal>
      <Modal
        open={importResourceModalVisible}
        centered
        title={null}
        footer={null}
        closable={false}
        onCancel={() => {
          setImportResourceModalVisible(false);
        }}
        className="import-resource-modal"
        height={'80%'}
        width={'65%'}
        maskClosable={!showSearchResults}
        style={{
          minWidth: '600px',
          maxWidth: '720px',
          maxHeight: '720px',
        }}
      >
        <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center">
            <div className="text-refly-text-0 text-lg font-semibold leading-6">
              {t('resource.import.title')}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="text"
                icon={<Cuttools size={16} color="var(--refly-text-0)" />}
                onClick={handleExtensionClick}
              >
                <span className="text-refly-primary-default text-sm font-semibold leading-5">
                  {t('resource.import.fromExtension')}
                </span>
              </Button>
              <Divider type="vertical" className="m-0 h-6 bg-refly-Card-Border" />
              <Button
                type="text"
                icon={<Close size={24} color="var(--refly-text-0)" />}
                onClick={() => setImportResourceModalVisible(false)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 p-3 pb-1.5 rounded-xl border-solid border-[1px] border-refly-Card-Border">
            <Segmented
              shape="round"
              className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center "
              options={importResourceOptions}
              value={selectedMenuItem}
              onChange={(value) => {
                setSelectedMenuItem(value as ImportResourceMenuItem);
              }}
            />
            {selectedMenuItem === 'import-from-web-search' && (
              <MultilingualSearch
                showResults={showSearchResults}
                setShowResults={setShowSearchResults}
              />
            )}
            {selectedMenuItem === 'import-from-weblink' && <ImportFromWeblink />}
            {selectedMenuItem === 'import-from-file' && <ImportFromFile />}
          </div>

          <div className="flex-grow min-h-0 overflow-hidden rounded-xl border-solid border-[1px] border-refly-Card-Border flex flex-col">
            <div className="px-4 py-2 bg-refly-bg-control-z0 text-refly-text-1 text-xs font-semibold leading-4 border-solid border-[1px] border-t-0 border-x-0 border-refly-Card-Border rounded-t-xl">
              {t('resource.import.waitingList')}{' '}
              {waitingList.length > 0 ? `${waitingList.length} 个` : ''}
            </div>

            <div className="flex-grow overflow-y-auto">
              <WaitingList />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-x-[8px]">
              <StorageLimit
                showProjectSelect={false}
                resourceCount={waitingList?.length || 0}
                projectId={currentProjectId}
                onSelectProject={setCurrentProjectId}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="default" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button
                type="primary"
                onClick={handleSaveToCanvas}
                disabled={disableSave}
                loading={saveLoading}
              >
                {t('common.saveToCanvas')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
});

ImportResourceModal.displayName = 'ImportResourceModal';
