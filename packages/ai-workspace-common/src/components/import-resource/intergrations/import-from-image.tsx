import { useEffect, useState, useCallback } from 'react';
import { Button, message, Upload, UploadProps } from 'antd';
import { TbPhoto } from 'react-icons/tb';
import { RiInboxArchiveLine } from 'react-icons/ri';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID, genImageID } from '@refly/utils/id';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { cn } from '@refly/utils/cn';
import { ImageItem } from '@refly-packages/ai-workspace-common/stores/import-resource';

const { Dragger } = Upload;

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp'];

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
  const [isDragging, setIsDragging] = useState(false);

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
    accept: ALLOWED_IMAGE_EXTENSIONS.join(','),
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

          nodeOperationsEmitter.emit('addNode', {
            node: {
              type: 'image',
              data: {
                title: image.title,
                entityId: genImageID(),
                metadata: {
                  imageUrl: image.url,
                  storageKey: image.storageKey,
                },
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

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) =>
        ALLOWED_IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
      );

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          props.beforeUpload?.(
            file as RcFile,
            [
              ...imageList.map((item) => ({ ...item, originFileObj: new File([], item.title) })),
            ] as any,
          );
        }
      }
    },
    [imageList, props],
  );

  const disableSave = imageList.length === 0;

  const genUploadHint = () => {
    let hint = t('resource.import.supportedImages', {
      formats: ALLOWED_IMAGE_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(', '),
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
    <div
      className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-image"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <TbPhoto className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromImage')}</div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border flex flex-col justify-center">
        <div
          className={cn(
            'w-full image-upload-container',
            isDragging && 'border-2 border-green-500 border-dashed rounded-lg',
          )}
        >
          <Dragger {...props}>
            <RiInboxArchiveLine className="text-3xl text-[#00968f]" />
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
          <p className="font-bold whitespace-nowrap text-md text-[#00968f]">
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
