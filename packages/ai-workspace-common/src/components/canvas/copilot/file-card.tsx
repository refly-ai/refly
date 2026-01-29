import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Close, Refresh } from 'refly-icons';
import type { IContextItem } from '@refly/common-types';
import { cn } from '@refly/utils/cn';
import type { UploadProgress } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { FileIcon } from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { getFileTypeConfig, isImageFile, formatFileSize, getFileExtension } from './file-utils';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import type { DriveFile } from '@refly/openapi-schema';

interface FileCardProps {
  item: IContextItem;
  canvasId: string;
  onRemove: (entityId: string) => void;
  onRetry?: (entityId: string) => void;
  disabled?: boolean;
  uploadProgress?: UploadProgress;
}

export const FileCard = memo(
  ({ item, canvasId, onRemove, onRetry, disabled, uploadProgress }: FileCardProps) => {
    const { t } = useTranslation();
    const [isShaking, setIsShaking] = useState(false);
    const { setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
      setCurrentFile: state.setCurrentFile,
    }));

    const extension = useMemo(() => getFileExtension(item.title), [item.title]);
    const isImage = useMemo(() => isImageFile(extension), [extension]);
    const fileSize = formatFileSize(item.metadata?.size);
    const thumbnailUrl = item.metadata?.thumbnailUrl || item.metadata?.previewUrl;
    const fileConfig = getFileTypeConfig(extension);

    const isUploading = uploadProgress?.status === 'uploading';
    const hasError = uploadProgress?.status === 'error';
    const errorType = item.metadata?.errorType as 'upload' | 'addToFile' | undefined;

    // Shake animation when error occurs
    useEffect(() => {
      if (hasError) {
        setIsShaking(true);
        const timer = setTimeout(() => setIsShaking(false), 500);
        return () => clearTimeout(timer);
      }
    }, [hasError]);

    // Get status text based on upload progress
    const getStatusText = () => {
      if (isUploading) {
        const progress = uploadProgress?.progress ?? 0;
        if (progress < 100) {
          return t('copilot.uploading', { progress });
        }
        return t('copilot.processing');
      }
      if (hasError) {
        if (errorType === 'addToFile') {
          return t('copilot.addToFileFailed');
        }
        return t('copilot.uploadFailed');
      }
      return null;
    };

    const statusText = getStatusText();

    const handleRetryClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRetry?.(item.entityId);
    };

    const handleCardClick = useCallback(() => {
      // Don't open preview if uploading or has error
      if (isUploading || hasError) {
        return;
      }

      // Convert IContextItem to DriveFile format
      const driveFile: DriveFile = {
        fileId: item.entityId,
        canvasId,
        name: item.title,
        type: item.metadata?.mimeType || 'text/plain',
        size: item.metadata?.size,
        category: isImage ? 'image' : 'document',
      };
      setCurrentFile(driveFile);
    }, [item, canvasId, isUploading, hasError, isImage, setCurrentFile]);

    return (
      <div
        className={cn(
          'relative flex items-center gap-2 p-2 rounded-lg bg-gray-100',
          hasError && 'bg-red-50',
          isShaking && 'animate-shake',
          !isUploading && !hasError && 'cursor-pointer hover:bg-gray-200 transition-colors',
        )}
        style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
        onClick={handleCardClick}
      >
        {/* Thumbnail/Icon area - 48x48px */}
        <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden flex items-center justify-center">
          {isImage && thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <FileIcon
              color={fileConfig.color}
              type={fileConfig.type as any}
              fold={true}
              height={36}
              width="28"
              glyphColor="rgba(255,255,255,0.4)"
            />
          )}
        </div>

        {/* File info area */}
        <div className="flex-1 min-w-0 max-w-[120px] flex flex-col gap-0.5">
          {/* File name - 13px, truncate */}
          <div className="text-[13px] font-medium truncate leading-5 text-gray-900">
            {item.title}
          </div>
          {/* Meta info row - 12px */}
          <div className="flex items-center gap-1.5 text-xs">
            {statusText ? (
              <span className={cn(hasError ? 'text-red-500' : 'text-gray-400')}>{statusText}</span>
            ) : (
              <>
                <span className="text-gray-400">{extension}</span>
                {fileSize && <span className="text-gray-400">{fileSize}</span>}
              </>
            )}
            {/* Retry button for error state */}
            {hasError && onRetry && (
              <button
                type="button"
                onClick={handleRetryClick}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors border-none outline-none cursor-pointer bg-transparent"
              >
                <Refresh size={14} className="text-red-500" />
              </button>
            )}
          </div>
        </div>

        {/* Close button - 18x18px, top right corner */}
        {!disabled && !isUploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.entityId);
            }}
            className={cn(
              'absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full',
              'bg-black/40 hover:bg-black/60 flex items-center justify-center',
              'cursor-pointer transition-colors border-none outline-none',
            )}
          >
            <Close size={10} color="#FFFFFF" />
          </button>
        )}
      </div>
    );
  },
);

FileCard.displayName = 'FileCard';
