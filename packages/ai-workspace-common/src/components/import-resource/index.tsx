import { Modal, Button, message } from 'antd';
import { useImportResourceStoreShallow } from '@refly/stores';

import { useTranslation } from 'react-i18next';

import './index.scss';
import { useEffect, memo, useMemo, useState } from 'react';
import { ImportFromFile } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/import-from-file';
import { Close } from 'refly-icons';
import WaitingList from './components/waiting-list';
import { StorageLimit } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/storageLimit';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { UpsertDriveFileRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useListDriveFiles } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';

export const ImportResourceModal = memo(() => {
  const { t } = useTranslation();
  const {
    importResourceModalVisible,
    setImportResourceModalVisible,
    setInsertNodePosition,
    waitingList,
    clearWaitingList,
  } = useImportResourceStoreShallow((state) => ({
    importResourceModalVisible: state.importResourceModalVisible,
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    setInsertNodePosition: state.setInsertNodePosition,
    insertNodePosition: state.insertNodePosition,
    waitingList: state.waitingList,
    clearWaitingList: state.clearWaitingList,
  }));

  const [saveLoading, setSaveLoading] = useState(false);
  const { projectId, canvasId } = useGetProjectCanvasId();
  const { refetchUsage, storageUsage } = useSubscriptionUsage();
  const canImportCount = getAvailableFileCount(storageUsage);
  const { refetch: refetchDriveFiles } = useListDriveFiles({ query: { canvasId } }, [], {
    enabled: false,
  });

  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);

  const disableSave = useMemo(() => {
    const hasUploadingFiles = waitingList.some((item) => item.file?.status === 'uploading');
    return (
      saveLoading ||
      waitingList.length === 0 ||
      waitingList.length > canImportCount ||
      hasUploadingFiles
    );
  }, [waitingList, canImportCount, saveLoading]);

  useEffect(() => {
    return () => {
      setInsertNodePosition(null);
    };
  }, [setInsertNodePosition]);

  const handleImportResources = async () => {
    if (waitingList.length === 0) {
      return;
    }

    logEvent('import_file', Date.now(), {
      canvasId,
      fileCount: waitingList.length,
    });

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
          canvasId,
          files: batchCreateFilesData,
        },
      });

      if (!data?.success) {
        return;
      }

      refetchUsage();
      refetchDriveFiles();

      message.success(t('common.upload.notification.allUploaded'));

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
      maskClosable={true}
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
          <ImportFromFile canvasId={canvasId} />
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
  );
});

ImportResourceModal.displayName = 'ImportResourceModal';
