import { memo, useMemo, useState, useEffect } from 'react';
import { Close, Refresh } from 'refly-icons';
import type { IContextItem } from '@refly/common-types';
import { cn } from '@refly/utils/cn';
import type { UploadProgress } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { FileIcon } from '@refly-packages/ai-workspace-common/components/common/resource-icon';

// File type configurations matching Figma design
const FILE_TYPE_CONFIG: Record<string, { color: string; type?: string }> = {
  // Documents - Blue
  txt: { color: '#0062D6', type: 'document' },
  doc: { color: '#2C5898', type: 'document' },
  docx: { color: '#2C5898', type: 'document' },
  pdf: { color: '#D93831', type: 'acrobat' },
  // Markdown - Green
  md: { color: '#00A870', type: 'document' },
  // Spreadsheets - Green
  csv: { color: '#00A870', type: 'spreadsheet' },
  xls: { color: '#207245', type: 'spreadsheet' },
  xlsx: { color: '#207245', type: 'spreadsheet' },
  // Video - Red/Coral
  mp4: { color: '#F04438', type: 'video' },
  mov: { color: '#F04438', type: 'video' },
  avi: { color: '#F04438', type: 'video' },
  mkv: { color: '#F04438', type: 'video' },
  webm: { color: '#F04438', type: 'video' },
  // Audio - Orange
  mp3: { color: '#F79009', type: 'audio' },
  wav: { color: '#F79009', type: 'audio' },
  // Code - Purple
  js: { color: '#7C3AED', type: 'code' },
  ts: { color: '#7C3AED', type: 'code' },
  tsx: { color: '#7C3AED', type: 'code' },
  jsx: { color: '#7C3AED', type: 'code' },
  py: { color: '#7C3AED', type: 'code' },
  json: { color: '#7C3AED', type: 'code' },
  // Default
  default: { color: '#0062D6', type: 'document' },
};

// Get file type config based on extension
const getFileTypeConfig = (ext: string) => {
  return FILE_TYPE_CONFIG[ext.toLowerCase()] || FILE_TYPE_CONFIG.default;
};

// Check if file is an image type
const isImageFile = (ext: string): boolean => {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(ext.toLowerCase());
};

// Format file size for display
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

interface FileCardProps {
  item: IContextItem;
  onRemove: (entityId: string) => void;
  onRetry?: (entityId: string) => void;
  disabled?: boolean;
  uploadProgress?: UploadProgress;
}

export const FileCard = memo(
  ({ item, onRemove, onRetry, disabled, uploadProgress }: FileCardProps) => {
    const { t } = useTranslation();
    const [isShaking, setIsShaking] = useState(false);
    const extension = useMemo(
      () => item.title?.split('.').pop()?.toLowerCase() || '',
      [item.title],
    );
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

    return (
      <div
        className={cn(
          'relative flex items-center gap-2 p-2 rounded-lg bg-[#F6F6F6] flex-shrink-0',
          hasError && 'bg-[#FEF3F2]',
          isShaking && 'animate-shake',
        )}
        style={{ minWidth: '160px', maxWidth: '200px' }}
      >
        {/* Shake animation styles */}
        <style>
          {`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
            20%, 40%, 60%, 80% { transform: translateX(2px); }
          }
          .animate-shake {
            animation: shake 0.5s ease-in-out;
          }
        `}
        </style>

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
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* File name - 13px, truncate */}
          <div className="text-[13px] font-medium truncate leading-5 text-[#1C1F23]">
            {item.title}
          </div>
          {/* Meta info row - 12px */}
          <div className="flex items-center gap-1.5 text-xs">
            {statusText ? (
              <span className={cn(hasError ? 'text-[#F04438]' : 'text-black/35')}>
                {statusText}
              </span>
            ) : (
              <>
                <span className="text-black/35">{extension}</span>
                {fileSize && <span className="text-black/35">{fileSize}</span>}
              </>
            )}
            {/* Retry button for error state */}
            {hasError && onRetry && (
              <button
                type="button"
                onClick={handleRetryClick}
                className="p-0.5 hover:bg-black/5 rounded transition-colors border-none outline-none cursor-pointer bg-transparent"
              >
                <Refresh size={14} color="#F04438" />
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
