import { useEffect, useState } from 'react';
import { Button, message, Upload, UploadProps } from 'antd';
import { HiLink } from 'react-icons/hi';
import { RiInboxArchiveLine } from 'react-icons/ri';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { Resource } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from './storageLimit';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID } from '@refly-packages/utils/id';

const { Dragger } = Upload;

interface FileItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.rtf', '.txt', '.md', '.html', '.epub'];

export const ImportFromFile = () => {
  const { t } = useTranslation();
  const {
    setImportResourceModalVisible,
    insertNodePosition,
    fileList: storageFileList,
    setFileList: setStorageFileList,
  } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    insertNodePosition: state.insertNodePosition,
    setFileList: state.setFileList,
    fileList: state.fileList,
  }));

  const { addNode } = useAddNode();
  const { refetchUsage, storageUsage } = useSubscriptionUsage();

  const [saveLoading, setSaveLoading] = useState(false);
  const [fileList, setFileList] = useState<FileItem[]>(storageFileList);

  const uploadFile = async (file: File, uid: string) => {
    const { data } = await getClient().upload({
      body: {
        file,
      },
    });
    if (data.success) {
      return { ...data.data, uid };
    }
    return { url: '', storageKey: '', uid };
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    accept: ALLOWED_FILE_EXTENSIONS.join(','),
    fileList: fileList.map((item) => ({
      uid: item.uid,
      name: item.title,
      status: item.status,
      url: item.url,
    })),
    beforeUpload: async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        message.error(t('resource.import.fileTooLarge', { size: '5MB' }));
        return Upload.LIST_IGNORE;
      }

      const tempUid = genResourceID();
      setFileList((prev) => [
        ...prev,
        {
          title: file.name,
          url: '',
          storageKey: '',
          uid: tempUid,
          status: 'uploading',
        },
      ]);

      const data = await uploadFile(file, tempUid);
      if (data?.url && data?.storageKey) {
        setFileList((prev) =>
          prev.map((item) =>
            item.uid === tempUid
              ? {
                  title: file.name,
                  url: data.url,
                  storageKey: data.storageKey,
                  uid: data.uid,
                  status: 'done',
                }
              : item,
          ),
        );
      } else {
        setFileList((prev) => prev.filter((item) => item.uid !== tempUid));
        message.error(`${t('common.uploadFailed')}: ${file.name}`);
      }

      return false;
    },
    onRemove: (file: RcFile) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
  };

  const handleSave = async () => {
    if (fileList.length === 0) {
      message.warning(t('resource.import.emptyFile'));
      return;
    }

    setSaveLoading(true);

    const { data } = await getClient().batchCreateResource({
      body: fileList.map((file) => ({
        resourceType: 'file',
        title: file.title,
        storageKey: file.storageKey,
      })),
    });

    setSaveLoading(false);
    if (!data?.success) {
      message.error(t('common.putFailed'));
      return;
    }

    setFileList([]);
    refetchUsage();
    message.success(t('common.putSuccess'));
    setImportResourceModalVisible(false);

    const resources = Array.isArray(data.data)
      ? (data.data as Resource[]).map((resource) => ({
          id: resource.resourceId,
          title: resource.title,
          domain: 'resource',
          contentPreview: resource.contentPreview,
        }))
      : [];

    for (const [index, resource] of resources.entries()) {
      const nodePosition = insertNodePosition
        ? {
            x: insertNodePosition.x + index * 300,
            y: insertNodePosition.y,
          }
        : null;
      addNode({
        type: 'resource',
        data: {
          title: resource.title,
          entityId: resource.id,
          contentPreview: resource.contentPreview,
          metadata: {
            resourceType: 'file',
          },
        },
        position: nodePosition,
      });
    }
  };

  const canImportCount = storageUsage?.fileCountQuota - (storageUsage?.fileCountUsed ?? 0);
  const disableSave = fileList.length === 0 || fileList.length > canImportCount;

  useEffect(() => {
    setStorageFileList(fileList);
  }, [fileList, setStorageFileList]);

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <HiLink className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromFile')}</div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border flex flex-col justify-center">
        <div className="w-full file-upload-container">
          <Dragger {...props}>
            <RiInboxArchiveLine className="text-3xl text-[#00968f]" />
            <p className="ant-upload-text mt-4 text-gray-600">{t('resource.import.dragOrClick')}</p>
            <p className="ant-upload-hint text-gray-400 mt-2">
              {t('resource.import.supportedFiles', {
                formats: ALLOWED_FILE_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(
                  ', ',
                ),
              })}
            </p>
          </Dragger>
        </div>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <p className="font-bold whitespace-nowrap text-md text-[#00968f]">
            {t('resource.import.fileCount', { count: fileList?.length || 0 })}
          </p>
          <StorageLimit resourceCount={fileList?.length || 0} />
        </div>

        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleSave} disabled={disableSave} loading={saveLoading}>
            {t('common.saveToCanvas')}
          </Button>
        </div>
      </div>
    </div>
  );
};
