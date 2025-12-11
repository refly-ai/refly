import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';

interface UseDragDropPasteOptions {
  canvasId: string;
  readonly?: boolean;
}

export const useDragDropPaste = ({ canvasId, readonly }: UseDragDropPasteOptions) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (!readonly) {
        setIsDragging(true);
      }
    },
    [readonly],
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      if (readonly) return;

      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files;

      if (imageFiles.length > 0) {
        try {
          if (imageFiles.length === 1) {
            await handleUploadImage(imageFiles[0], canvasId);
          } else {
            await handleUploadMultipleImages(imageFiles, canvasId);
          }
        } catch (error) {
          console.error('Failed to upload images:', error);
          message.error(t('common.uploadFailed'));
        }
      }
    },
    [canvasId, handleUploadImage, handleUploadMultipleImages, readonly, t],
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      if (readonly) return;

      const items = event.clipboardData?.items;
      if (!items?.length) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        try {
          if (imageFiles.length === 1) {
            await handleUploadImage(imageFiles[0], canvasId);
          } else {
            await handleUploadMultipleImages(imageFiles, canvasId);
          }
        } catch (error) {
          console.error('Failed to upload pasted images:', error);
          message.error(t('common.uploadFailed'));
        }
      }
    },
    [canvasId, handleUploadImage, handleUploadMultipleImages, readonly, t],
  );

  const DropOverlay = useCallback(() => {
    if (!isDragging || readonly) return null;

    return (
      <div className="absolute inset-0 z-50 bg-green-50/30 pointer-events-none flex items-center justify-center border-2 border-green-500/30 rounded-lg">
        <div className="bg-white px-4 py-2 rounded-lg shadow-refly-m hover:shadow-lg transition-shadow duration-200">
          <span className="text-green-600 font-medium hover:text-green-700 transition-colors duration-200">
            {t('common.dropImageHere')}
          </span>
        </div>
      </div>
    );
  }, [isDragging, readonly, t]);

  return {
    handlers: {
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handlePaste,
    },
    isDragging,
    DropOverlay,
  };
};
