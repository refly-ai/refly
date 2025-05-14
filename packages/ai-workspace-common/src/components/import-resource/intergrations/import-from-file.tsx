import { useEffect, useState } from 'react';
import { Button, message, Upload, UploadProps, List, Avatar, Spin } from 'antd';
import { TbFile } from 'react-icons/tb';
import { RiInboxArchiveLine } from 'react-icons/ri';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { Resource } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from './storageLimit';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID } from '@refly/utils/id';
import { LuInfo } from 'react-icons/lu';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { GrUnlock } from 'react-icons/gr';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { MediaPreview } from './media-preview';
import { HiLink, HiOutlineXMark } from 'react-icons/hi2';

const { Dragger } = Upload;

interface FileItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
  isHandled?: boolean;
  isError?: boolean;
  key?: string;
  image?: string;
  description?: string;
}

const ALLOWED_FILE_EXTENSIONS = [
  // Document Type
  '.pdf', '.docx', '.rtf', '.txt', '.md', '.html', '.epub',
  // media type
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  // audio type
  '.mp3', '.wav', '.ogg', '.m4a', '.aac'
];

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
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const { projectId, isCanvasOpen } = useGetProjectCanvasId();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();

  const { refetchUsage, storageUsage, fileParsingUsage } = useSubscriptionUsage();

  const [saveLoading, setSaveLoading] = useState(false);
  const [fileList, setFileList] = useState<FileItem[]>(storageFileList);

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const planType = userProfile?.subscription?.planType || 'free';
  const uploadLimit = fileParsingUsage?.fileUploadLimit ?? -1;
  const maxFileSize = `${uploadLimit}MB`;
  const maxFileSizeBytes = uploadLimit * 1024 * 1024;

  const uploadFile = async (file: File, uid: string) => {
    const { data } = await getClient().upload({
      body: {
        file,
      },
    });
    if (data?.success) {
      return { ...(data.data || {}), uid };
    }
    return { url: '', storageKey: '', uid };
  };

  const validateMediaFile = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isVideo && !isAudio) {
      return true; // No media file, just return true
    }
    
    // limit video file size to 100MB
    if (isVideo && file.size / 1024 / 1024 > 100) {
      message.error(t('resource.import.videoTooLarge', { size: '100MB' }));
      return false;
    }
    
    // limit audio file size to 50MB
    if (isAudio && file.size / 1024 / 1024 > 50) {
      message.error(t('resource.import.audioTooLarge', { size: '50MB' }));
      return false;
    }
    
    return true;
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    accept: ALLOWED_FILE_EXTENSIONS.join(','),
    fileList: fileList.map((item) => ({
      uid: item.uid,
      name: item.title,
      status: item?.status,
      url: item.url,
    })),
    beforeUpload: async (file: File) => {
      if (uploadLimit > 0 && file.size > maxFileSizeBytes) {
        message.error(t('resource.import.fileTooLarge', { size: maxFileSize }));
        return Upload.LIST_IGNORE;
      }

      if (!validateMediaFile(file)) {
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
        projectId: currentProjectId,
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

    if (isCanvasOpen) {
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

        nodeOperationsEmitter.emit('addNode', {
          node: {
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
          },
        });
      }
    }

    updateSourceList(Array.isArray(data.data) ? (data.data as Resource[]) : [], currentProjectId);
  };

  const canImportCount = getAvailableFileCount(storageUsage);
  const disableSave = fileList.length === 0 || fileList.length > canImportCount;

  const genUploadHint = () => {
    let hint = t('resource.import.supportedFiles', {
      formats: ALLOWED_FILE_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(', '),
    });
    if (uploadLimit > 0) {
      hint += `. ${t('resource.import.fileUploadLimit', { size: maxFileSize })}`;
    }
    return hint;
  };

  useEffect(() => {
    setStorageFileList(fileList);
  }, [fileList, setStorageFileList]);

  const RenderItem = (props: { item: FileItem }) => {
    const importResourceStore = useImportResourceStoreShallow((state) => ({
      fileList: state.fileList,
      setFileList: state.setFileList,
    }));
    const { item } = props;
    const { t } = useTranslation();

    const isMediaFile = (url: string) => {
      const mediaExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg', '.m4a', '.aac'];
      return mediaExtensions.some(ext => url.toLowerCase().endsWith(ext));
    };

    const getMediaType = (url: string): 'video' | 'audio' => {
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
      return videoExtensions.some(ext => url.toLowerCase().endsWith(ext)) ? 'video' : 'audio';
    };

    return (
      <Spin spinning={!item.isHandled && !item.isError} style={{ width: '100%', minHeight: 80 }}>
        <List.Item
          actions={[
            <Button
              key={item.key}
              type="text"
              className="assist-action-item"
              onClick={() => {
                window.open(item?.url, '_blank');
              }}
            >
              <HiLink />
            </Button>,
            <Button
              key={item.key}
              type="text"
              className="assist-action-item"
              onClick={() => {
                const newLinks = importResourceStore?.fileList?.filter((link) => {
                  return link?.key !== item?.key;
                });
                importResourceStore.setFileList(newLinks);
              }}
            >
              <HiOutlineXMark strokeWidth={2} />
            </Button>,
          ]}
          className="intergation-result-list-item"
        >
          {isMediaFile(item.url) ? (
            <MediaPreview
              url={item.url}
              type={getMediaType(item.url)}
              title={item.title}
            />
          ) : (
            <List.Item.Meta
              avatar={<Avatar src={item.image} />}
              title={
                <div className="intergation-result-intro">
                  <p>
                    <span
                      className="intergation-result-url"
                      onClick={() => window.open(item?.url, '_blank')}
                    >
                      {item?.url}
                    </span>
                  </p>
                  <p>
                    {item?.isError ? (
                      <span className="text-red-500">{t('resource.import.scrapeError')}</span>
                    ) : (
                      item?.title
                    )}
                  </p>
                </div>
              }
              description={item.description}
            />
          )}
        </List.Item>
      </Spin>
    );
  };

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <TbFile className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromFile')}</div>
        {subscriptionEnabled && planType === 'free' && (
          <Button
            type="text"
            icon={<GrUnlock className="flex items-center justify-center" />}
            onClick={() => setSubscribeModalVisible(true)}
            className="text-green-600 font-medium"
          >
            {t('resource.import.unlockUploadLimit')}
          </Button>
        )}
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border flex flex-col justify-center">
        <div className="w-full file-upload-container">
          <Dragger {...props}>
            <RiInboxArchiveLine className="text-3xl text-[#00968f]" />
            <p className="ant-upload-text mt-4 text-gray-600 dark:text-gray-300">
              {t('resource.import.dragOrClick')}
            </p>
            <p className="ant-upload-hint text-gray-400 mt-2">{genUploadHint()}</p>
            {fileParsingUsage?.pagesLimit >= 0 && (
              <div className="text-green-500 mt-2 text-xs font-medium flex items-center justify-center gap-1">
                <LuInfo />
                {t('resource.import.fileParsingUsage', {
                  used: fileParsingUsage?.pagesParsed,
                  limit: fileParsingUsage?.pagesLimit,
                })}
              </div>
            )}
          </Dragger>
          {fileList?.length > 0 && (
            <List
              className="mt-4"
              dataSource={fileList}
              renderItem={(item) => <RenderItem item={item} />}
            />
          )}
        </div>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <p className="font-bold whitespace-nowrap text-md text-[#00968f]">
            {t('resource.import.fileCount', { count: fileList?.length || 0 })}
          </p>
          <StorageLimit
            resourceCount={fileList?.length || 0}
            projectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
          />
        </div>

        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleSave} disabled={disableSave} loading={saveLoading}>
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
