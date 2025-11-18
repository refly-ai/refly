import { Modal, Button, Segmented, message } from 'antd';
import { ImportResourceMenuItem, useImportResourceStoreShallow } from '@refly/stores';

import { useTranslation } from 'react-i18next';

import './index.scss';
import { useEffect, memo, useMemo, useState } from 'react';
import MultilingualSearch from '@refly-packages/ai-workspace-common/modules/multilingual-search';
import { ImportFromWeblink } from './intergrations/import-from-weblink';
import { ImportFromFile } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/import-from-file';
import { ImportFromExtension } from './intergrations/import-from-extension';
import { Close } from 'refly-icons';
import WaitingList from './components/waiting-list';
import { StorageLimit } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/storageLimit';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { UpsertDriveFileRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { getAvailableFileCount } from '@refly/utils/quota';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useListDriveFiles } from '@refly-packages/ai-workspace-common/queries';

export const ImportResourceModal = memo(() => {
  const { t } = useTranslation();
  const {
    extensionModalVisible,
    importResourceModalVisible,
    setImportResourceModalVisible,
    selectedMenuItem,
    setSelectedMenuItem,
    setInsertNodePosition,
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

  const [saveLoading, setSaveLoading] = useState(false);
  const { projectId, canvasId } = useGetProjectCanvasId();
  const { refetchUsage, storageUsage } = useSubscriptionUsage();
  const canImportCount = getAvailableFileCount(storageUsage);
  const { refetch: refetchDriveFiles } = useListDriveFiles({ query: { canvasId } }, [], {
    enabled: false,
  });

  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);

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

  const handleImportResources = async () => {
    if (waitingList.length === 0) {
      return;
    }

    setSaveLoading(true);
    try {
      const batchCreateFilesData: UpsertDriveFileRequest[] = waitingList.map((item) => {
        return {
          canvasId,
          name: item.title ?? '',
          content: item.content,
          storageKey: item.file?.storageKey,
          externalUrl: item.url,
        };
      });

      const { data } = await getClient().batchCreateDriveFiles({
        body: {
          files: batchCreateFilesData,
        },
      });

      if (!data?.success) {
        return;
      }

      refetchUsage();
      refetchDriveFiles();

      message.success(t('common.putSuccess'));

      const mediaFiles = waitingList.filter(
        (item) =>
          item.file?.type === 'image' || item.file?.type === 'video' || item.file?.type === 'audio',
      );
      for (const item of mediaFiles) {
        // Create metadata based on file type
        const metadata: Record<string, any> = {
          storageKey: item.file?.storageKey,
        };

        // Set the appropriate URL field based on file type
        switch (item.file?.type) {
          case 'image':
            metadata.imageUrl = item.file?.url;
            break;
          case 'video':
            metadata.videoUrl = item.file?.url;
            break;
          case 'audio':
            metadata.audioUrl = item.file?.url;
            break;
        }
      }

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
                icon={<Close size={24} color="var(--refly-text-0)" />}
                onClick={() => setImportResourceModalVisible(false)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 p-3 pb-1.5 rounded-xl border-solid border-[1px] border-refly-Card-Border">
            <Segmented
              shape="round"
              className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
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
            {selectedMenuItem === 'import-from-file' && <ImportFromFile canvasId={canvasId} />}
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
                onClick={handleImportResources}
                disabled={disableSave}
                loading={saveLoading}
              >
                {t('common.import')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
});

ImportResourceModal.displayName = 'ImportResourceModal';
