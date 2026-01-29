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
    const progress = uploadProgress?.progress ?? 0;

    // Shake animation when error occurs
    useEffect(() => {
      if (hasError) {
        setIsShaking(true);
        const timer = setTimeout(() => setIsShaking(false), 500);
        return () => clearTimeout(timer);
      }
    }, [hasError]);

    // Phase determination
    const isUploadPhase = isUploading && progress < 100;
    const isSuccess = !isUploading && !hasError;

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
          'relative flex items-center gap-2 p-1 rounded-lg bg-[#F6F6F6]',
          hasError && 'bg-red-50',
          isShaking && 'animate-shake',
          isSuccess && 'cursor-pointer hover:bg-gray-200 transition-colors',
        )}
        style={{ width: '166px', minWidth: '166px', maxWidth: '166px', height: '48px' }}
        onClick={handleCardClick}
      >
        {/* Thumbnail/Icon area */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {isImage && thumbnailUrl ? (
            <div className="w-10 h-10 rounded overflow-hidden bg-white">
              <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <FileIcon
              color={fileConfig.color}
              type={fileConfig.type as any}
              fold={false}
              height={40}
              width="26"
              glyphColor="white"
            />
          )}
        </div>

        {/* File info area */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* File name - 12px, truncate */}
          <div className="text-[12px] font-medium truncate leading-tight text-[#1C1F23]">
            {item.title}
          </div>

          {/* Meta info row */}
          <div className="flex items-center justify-between min-w-0">
            {/* Left: Type/Size or Status */}
            <div className="flex items-center gap-1.5 text-[10px] text-[rgba(28,31,35,0.35)] truncate">
              {isUploadPhase ? (
                <span className="text-[rgba(28,31,35,0.35)]">
                  {t('copilot.uploading', { progress })}
                </span>
              ) : hasError && errorType === 'upload' ? (
                <span className="text-[#D52515]">{t('copilot.uploadFailed')}</span>
              ) : (
                <div className="flex items-center gap-1 truncate leading-none">
                  <span className="truncate">{extension}</span>
                  {fileSize && <span>{fileSize}</span>}
                </div>
              )}
            </div>

            {/* Right: Retry only */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasError && (
                <button
                  type="button"
                  onClick={handleRetryClick}
                  className="flex items-center gap-0.5 p-0 hover:bg-black/5 rounded transition-colors border-none outline-none cursor-pointer bg-transparent text-[10px]"
                >
                  <Refresh
                    size={10}
                    className={cn(errorType === 'addToFile' ? 'text-[#1C1F23]' : 'text-[#D52515]')}
                  />
                  <span
                    className={cn(
                      'font-medium',
                      errorType === 'addToFile' ? 'text-[#1C1F23]' : 'text-[#D52515]',
                    )}
                  >
                    {errorType === 'addToFile'
                      ? t('common.sync') || 'Sync'
                      : t('common.retry') || 'Retry'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Close button - 16x16px, top right corner */}
        {!disabled && !isUploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.entityId);
            }}
            className={cn(
              'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full',
              'bg-black/40 hover:bg-black/60 flex items-center justify-center',
              'cursor-pointer transition-colors border-none outline-none',
            )}
          >
            <Close size={8} color="#FFFFFF" />
          </button>
        )}
      </div>
    );
  },
);

FileCard.displayName = 'FileCard';
