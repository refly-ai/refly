import { useEffect, useState } from 'react';
import { Button, message, Upload, UploadProps } from 'antd';
import { TbPhoto } from 'react-icons/tb';
import { RiInboxArchiveLine } from 'react-icons/ri';
import { useImportResourceStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID, genImageID } from '@refly/utils/id';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { ImageItem } from '@refly/stores';

const { Dragger } = Upload;

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];

// Helper function to extract file extension
const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return ''; // No extension or dot at the end
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

export const ImportFromImage = () => {
  const { t } = useTranslation();
  const {
    setImportResourceModalVisible,
    insertNodePosition,
    imageList: storageImageList,
    setImageList: setStorageImageList,
  } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    insertNodePosition: state.insertNodePosition,
    imageList: state.imageList,
    setImageList: state.setImageList,
  }));

  const { isCanvasOpen, canvasId } = useGetProjectCanvasId();

  const { refetchUsage, fileParsingUsage } = useSubscriptionUsage();

  const [saveLoading, setSaveLoading] = useState(false);
  const [imageList, setImageList] = useState<ImageItem[]>(storageImageList);

  const uploadLimit = fileParsingUsage?.fileUploadLimit ?? -1;
  const maxFileSize = `${uploadLimit}MB`;
  const maxFileSizeBytes = uploadLimit * 1024 * 1024;

  const uploadImage = async (file: File, uid: string) => {
    try {
      const { data } = await getClient().upload({
        body: {
          file,
          entityId: canvasId,
          entityType: 'canvas',
        },
      });

      if (data?.success) {
        return { ...(data.data || {}), uid };
      }
      return { url: '', storageKey: '', uid };
    } catch (error) {
      console.error('Upload error:', error);
      return { url: '', storageKey: '', uid };
    }
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    accept: [
      ...ALLOWED_IMAGE_EXTENSIONS,
      ...ALLOWED_VIDEO_EXTENSIONS,
      ...ALLOWED_AUDIO_EXTENSIONS,
    ].join(','),
    fileList: imageList.map((item) => ({
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

      const tempUid = genResourceID();
      setImageList((prev) => [
        ...prev,
        {
          title: file.name,
          uid: tempUid,
          status: 'uploading',
          url: '',
          storageKey: '',
        },
      ]);

      try {
        const uploadResult = await uploadImage(file, tempUid);
        if (uploadResult?.url && uploadResult?.storageKey) {
          setImageList((prev) =>
            prev.map((item) =>
              item.uid === tempUid
                ? {
                    title: file.name,
                    uid: tempUid,
                    status: 'done',
                    url: uploadResult.url,
                    storageKey: uploadResult.storageKey,
                  }
                : item,
            ),
          );
        } else {
          setImageList((prev) => prev.filter((item) => item.uid !== tempUid));
          message.error(`${t('common.uploadFailed')}: ${file.name}`);
        }
      } catch (_) {
        setImageList((prev) => prev.filter((item) => item.uid !== tempUid));
        message.error(`${t('common.uploadFailed')}: ${file.name}`);
      }

      return false;
    },
    onRemove: (file: RcFile) => {
      setImageList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
  };

  const handleSave = async () => {
    if (imageList.length === 0) {
      message.warning(t('resource.import.emptyImage'));
      return;
    }

    setSaveLoading(true);

    try {
      // Add the images directly to the canvas
      if (isCanvasOpen) {
        for (const [index, image] of imageList.entries()) {
          const nodePosition = insertNodePosition
            ? {
                x: insertNodePosition.x + index * 300,
                y: insertNodePosition.y,
              }
            : null;

          const fileExtension = getFileExtension(image.title);
          const fileType = ALLOWED_IMAGE_EXTENSIONS.includes(`.${fileExtension}`)
            ? 'image'
            : ALLOWED_VIDEO_EXTENSIONS.includes(`.${fileExtension}`)
              ? 'video'
              : ALLOWED_AUDIO_EXTENSIONS.includes(`.${fileExtension}`)
                ? 'audio'
                : 'image';

          // Create metadata based on file type
          const metadata: Record<string, any> = {
            storageKey: image.storageKey,
          };

          // Set the appropriate URL field based on file type
          switch (fileType) {
            case 'image':
              metadata.imageUrl = image.url;
              break;
            case 'video':
              metadata.videoUrl = image.url;
              break;
            case 'audio':
              metadata.audioUrl = image.url;
              break;
          }

          nodeOperationsEmitter.emit('addNode', {
            node: {
              type: fileType,
              data: {
                title: image.title,
                entityId: genImageID(),
                metadata,
              },
              position: nodePosition,
            },
          });
        }
      }

      setImageList([]);
      refetchUsage();
      message.success(t('common.addedToCanvas'));
    } catch (error) {
      console.error('Error adding images to canvas:', error);
      message.error(t('common.operationFailed'));
    } finally {
      setSaveLoading(false);
      setImportResourceModalVisible(false);
    }
  };

  const disableSave = imageList.length === 0;

  const genUploadHint = () => {
    let hint = t('resource.import.supportedImages', {
      formats: [
        ...ALLOWED_IMAGE_EXTENSIONS,
        ...ALLOWED_VIDEO_EXTENSIONS,
        ...ALLOWED_AUDIO_EXTENSIONS,
      ]
        .map((ext) => ext.slice(1).toUpperCase())
        .join(', '),
    });
    if (uploadLimit > 0) {
      hint += `. ${t('resource.import.fileUploadLimit', { size: maxFileSize })}`;
    }
    return hint;
  };

  useEffect(() => {
    setStorageImageList(imageList);
  }, [imageList, setStorageImageList]);

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-image">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <TbPhoto className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromImage')}</div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border flex flex-col justify-center">
        <div className="w-full image-upload-container">
          <Dragger {...props}>
            <RiInboxArchiveLine className="text-3xl text-[#0E9F77]" />
            <p className="ant-upload-text mt-4 text-gray-600 dark:text-gray-300">
              {t('resource.import.dragOrClick')}
            </p>
            <p className="ant-upload-hint text-gray-400 dark:text-gray-500 mt-2">
              {genUploadHint()}
            </p>
          </Dragger>
        </div>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] dark:border-[#2f2f2f] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <p className="font-bold whitespace-nowrap text-md text-[#0E9F77]">
            {t('resource.import.imageCount', {
              count: imageList?.length || 0,
            })}
          </p>
        </div>

        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleSave} disabled={disableSave} loading={saveLoading}>
            {isCanvasOpen ? t('workspace.addToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
