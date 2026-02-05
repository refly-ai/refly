import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Close, Refresh, Resource } from 'refly-icons';
import { LoadingOutlined } from '@ant-design/icons';
import type { IContextItem } from '@refly/common-types';
import { cn } from '@refly/utils/cn';
import type { UploadProgress } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { isImageFile, formatFileSize, getFileExtension } from './file-utils';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import type { DriveFile } from '@refly/openapi-schema';
import { Progress } from 'antd';

interface FileCardProps {
  item: IContextItem;
  canvasId: string;
  onRemove: (entityId: string) => void;
  onRetry?: (entityId: string) => void;
  disabled?: boolean;
  uploadProgress?: UploadProgress;
  mode?: 'large' | 'compact';
}

export const FileCard = memo(
  ({
    item,
    canvasId,
    onRemove,
    onRetry,
    disabled,
    uploadProgress,
    mode = 'large',
  }: FileCardProps) => {
    const { t } = useTranslation();
    const [isShaking, setIsShaking] = useState(false);
    const { setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
      setCurrentFile: state.setCurrentFile,
    }));

    const extension = useMemo(() => getFileExtension(item.title), [item.title]);
    const isImage = useMemo(
      () => isImageFile(item.metadata?.mimeType, extension),
      [extension, item.metadata?.mimeType],
    );
    const fileSize = formatFileSize(item.metadata?.size);
    const thumbnailUrl = item.metadata?.thumbnailUrl || item.metadata?.previewUrl;

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
    const isSuccess = !isUploading && !hasError;

    // Determine phase for UI display
    const isUploadPhase = isUploading && !item.metadata?.storageKey;
    const isProcessingPhase = isUploading && !!item.metadata?.storageKey;

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

    if (mode === 'compact') {
      return (
        <div
          className={cn(
            'relative group rounded-lg overflow-hidden bg-[#F6F6F6]',
            hasError && 'bg-red-50 ring-1 ring-red-200',
            isShaking && 'animate-shake',
            isSuccess && 'cursor-pointer',
          )}
          style={{ width: '48px', minWidth: '48px', maxWidth: '48px', height: '48px' }}
          onClick={handleCardClick}
        >
          {/* Thumbnail: image full-bleed or file-type icon */}
          <div className="w-full h-full flex items-center justify-center bg-white">
            {isImage && thumbnailUrl ? (
              <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <NodeIcon
                type="file"
                filename={item.title}
                fileType={item.metadata?.mimeType}
                filled={false}
                small={false}
                iconSize={32}
                className="!w-full !h-full"
              />
            )}
          </div>

          {/* Uploading Stage - Dark overlay + Centered Progress Ring (对应截图1: 上传 loading) */}
          {isUploadPhase && (
            <>
              <div className="absolute inset-0 bg-[#1C1F23]/60 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Progress
                  type="circle"
                  percent={progress}
                  width={20}
                  strokeWidth={15}
                  showInfo={false}
                  strokeColor="white"
                  trailColor="rgba(255,255,255,0.2)"
                />
              </div>
            </>
          )}

          {/* Processing or Success Phase - Bottom right 16x16 indicator (对应截图2: 入库进度/成功) */}
          {isProcessingPhase && (
            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#1C1F23]/80 flex items-center justify-center">
              <LoadingOutlined className="text-white text-[10px]" />
            </div>
          )}

          {/* Success Phase - Bottom right 16x16 indicator with icon only */}
          {isSuccess && (
            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#1C1F23]/80 flex items-center justify-center">
              <Resource size={10} className="!text-white" />
            </div>
          )}

          {/* Close button - Only show on hover for compact mode */}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.entityId);
              }}
              className={cn(
                'absolute top-0.5 right-0.5 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity',
                'bg-black/40 hover:bg-black/60 flex items-center justify-center',
                'cursor-pointer border-none outline-none',
              )}
            >
              <Close size={8} color="#FFFFFF" />
            </button>
          )}

          {/* Error Retry - Show on top of thumbnail if error */}
          {hasError && (
            <div className="absolute inset-0 bg-red-50/80 flex items-center justify-center">
              <button
                type="button"
                onClick={handleRetryClick}
                className="p-1 rounded-full bg-white shadow-sm hover:bg-gray-100 transition-colors border-none outline-none cursor-pointer"
              >
                <Refresh size={14} className="text-[#D52515]" />
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={cn(
          'relative group flex items-center gap-2 p-1 rounded-lg bg-[#F6F6F6]',
          hasError && 'bg-red-50',
          isShaking && 'animate-shake',
          isSuccess && 'cursor-pointer hover:bg-gray-200 transition-colors',
        )}
        style={{ width: '166px', minWidth: '166px', maxWidth: '166px', height: '48px' }}
        onClick={handleCardClick}
      >
        {/* Thumbnail/Icon area */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          <NodeIcon
            type="file"
            filename={item.title}
            url={isImage ? thumbnailUrl : undefined}
            small={false}
            className="!w-9 !h-9"
            iconSize={24}
            filled={false}
          />
        </div>

        {/* File info area */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* File name - 12px, truncate, fixed height */}
          <div className="text-[12px] font-medium truncate leading-[16px] h-4 text-[#1C1F23]">
            {item.title}
          </div>

          {/* Meta info row - fixed height */}
          <div className="flex items-center justify-between min-w-0 h-[14px]">
            {/* Left: Type/Size or Status */}
            <div className="flex items-center gap-1.5 text-[10px] text-[rgba(28,31,35,0.35)] truncate flex-1">
              {isUploadPhase ? (
                // Upload phase: "Uploading X%..."
                <span className="truncate">{t('copilot.uploading', { progress })}</span>
              ) : isProcessingPhase ? (
                // Library entry phase: "Processing..."
                <span className="truncate">{t('copilot.processing')}</span>
              ) : hasError && errorType === 'upload' ? (
                // Upload failed: "Failed" in red
                <span className="text-[#D52515] font-medium">
                  {t('copilot.uploadFailed') ?? 'Failed'}
                </span>
              ) : (
                // Default success state: Extension + Size
                <div className="flex items-center gap-1 truncate leading-none">
                  <span className="truncate">{extension}</span>
                  {fileSize && <span>{fileSize}</span>}
                </div>
              )}
            </div>

            {/* Right: Action button (Retry/Sync) or Resource Icon */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasError ? (
                <button
                  type="button"
                  onClick={handleRetryClick}
                  className={cn(
                    'flex items-center gap-0.5 p-0 hover:bg-black/5 rounded transition-colors border-none outline-none cursor-pointer bg-transparent text-[10px] font-medium',
                    errorType === 'addToFile' ? 'text-[#1C1F23]' : 'text-[#D52515]',
                  )}
                >
                  <Refresh size={10} />
                  <span>
                    {errorType === 'addToFile'
                      ? t('common.sync') || 'Sync'
                      : t('common.retry') || 'Retry'}
                  </span>
                </button>
              ) : (
                // Resource icon shown during processing or success
                (isProcessingPhase || isSuccess) && (
                  <Resource size={10} className="!text-[rgba(28,31,35,0.35)]" />
                )
              )}
            </div>
          </div>
        </div>

        {/* Close button - 16x16px, top right corner */}
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.entityId);
            }}
            className={cn(
              'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity',
              'bg-black/40 hover:bg-black/60 flex items-center justify-center',
              'cursor-pointer border-none outline-none',
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
