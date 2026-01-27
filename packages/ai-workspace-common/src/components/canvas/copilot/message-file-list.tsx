import { memo, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { IContextItem } from '@refly/common-types';
import { cn } from '@refly/utils/cn';
import { FileIcon } from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { serverOrigin } from '@refly/ui-kit';
import { Image as ImageIcon } from 'refly-icons';

// ChevronRight icon component
const ChevronRightIcon = ({
  size = 14,
  color = 'currentColor',
}: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.25 3.5L8.75 7L5.25 10.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// File type configurations
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

const getFileTypeConfig = (ext: string) => {
  return FILE_TYPE_CONFIG[ext.toLowerCase()] || FILE_TYPE_CONFIG.default;
};

// Check if file is an image type
const isImageFile = (mimeType?: string, ext?: string): boolean => {
  if (mimeType?.startsWith('image/')) return true;
  if (ext) {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(ext.toLowerCase());
  }
  return false;
};

// Format file size for display
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

interface MessageFileListProps {
  contextItems: IContextItem[];
  className?: string;
}

// Image thumbnail component - 48x48px with loading skeleton
const ImageThumbnail = memo(({ item }: { item: IContextItem }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate URL from fileId if no direct URL is available
  const thumbnailUrl = useMemo(() => {
    // First try existing URLs
    if (item.metadata?.thumbnailUrl) return item.metadata.thumbnailUrl;
    if (item.metadata?.previewUrl) return item.metadata.previewUrl;
    if (item.metadata?.url) return item.metadata.url;

    // Generate URL from fileId (entityId)
    if (item.entityId && !item.entityId.startsWith('pending_')) {
      return `${serverOrigin}/v1/drive/file/content/${item.entityId}`;
    }
    return null;
  }, [item.entityId, item.metadata?.thumbnailUrl, item.metadata?.previewUrl, item.metadata?.url]);

  return (
    <div
      className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-[#D9D9D9]"
      style={{ border: '0.5px solid rgba(28, 31, 35, 0.1)' }}
    >
      {thumbnailUrl && !hasError ? (
        <>
          {/* Loading skeleton animation */}
          {isLoading && (
            <div className="w-full h-full animate-pulse bg-gradient-to-r from-[#E5E5E5] via-[#F0F0F0] to-[#E5E5E5] bg-[length:200%_100%]" />
          )}
          <img
            src={thumbnailUrl}
            alt={item.title}
            className={cn('w-full h-full object-cover', isLoading && 'hidden')}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        </>
      ) : (
        // No URL or load failed - show image icon placeholder
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon size={20} color="rgba(28, 31, 35, 0.35)" />
        </div>
      )}
    </div>
  );
});

ImageThumbnail.displayName = 'ImageThumbnail';

// File card component - matches Figma design
const MessageFileCard = memo(({ item }: { item: IContextItem }) => {
  const extension = item.title?.split('.').pop()?.toLowerCase() || '';
  const fileSize = formatFileSize(item.metadata?.size);
  const fileConfig = getFileTypeConfig(extension);

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg bg-[#F6F6F6] flex-shrink-0"
      style={{ width: '166px', height: '48px' }}
    >
      {/* File icon area - 26x40px */}
      <div className="w-[26px] h-10 flex items-center justify-end flex-shrink-0">
        <FileIcon
          color={fileConfig.color}
          type={fileConfig.type as any}
          fold={true}
          height={32}
          width="20"
          glyphColor="rgba(255,255,255,0.4)"
        />
      </div>

      {/* File info area */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5" style={{ width: '120px' }}>
        {/* File name - 12px, truncate */}
        <div
          className="text-xs font-normal truncate text-[#1C1F23]"
          style={{ lineHeight: '1.5em' }}
        >
          {item.title}
        </div>
        {/* Meta info row - 10px */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span
              className="text-[10px]"
              style={{ color: 'rgba(28, 31, 35, 0.35)', lineHeight: '1.4em' }}
            >
              {extension}
            </span>
            {fileSize && (
              <span
                className="text-[10px]"
                style={{ color: 'rgba(28, 31, 35, 0.35)', lineHeight: '1.4em' }}
              >
                {fileSize}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageFileCard.displayName = 'MessageFileCard';

export const MessageFileList = memo(({ contextItems, className }: MessageFileListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const fileItems = contextItems.filter((item) => item.type === 'file');

  // Check if right arrow should be shown
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
    setShowRightArrow(hasOverflow && notAtEnd);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [fileItems.length, checkScroll]);

  if (fileItems.length === 0) return null;

  const handleScrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      {/* Scrollable container - gap 8px per Figma */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto message-file-list-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{'.message-file-list-scroll::-webkit-scrollbar { display: none; }'}</style>
        {fileItems.map((item) => {
          const extension = item.title?.split('.').pop()?.toLowerCase() || '';
          const isImage = isImageFile(item.metadata?.mimeType, extension);

          return isImage ? (
            <ImageThumbnail key={item.entityId} item={item} />
          ) : (
            <MessageFileCard key={item.entityId} item={item} />
          );
        })}
      </div>

      {/* Right gradient mask + circular arrow button - per Figma specs */}
      {showRightArrow && (
        <div
          className="absolute right-0 top-0 h-full flex items-center justify-end pointer-events-none"
          style={{
            width: '40px',
            background:
              'linear-gradient(270deg, rgba(255, 255, 255, 1) 58%, rgba(255, 255, 255, 0) 100%)',
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center bg-white cursor-pointer pointer-events-auto mr-1"
            style={{
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(28, 31, 35, 0.1)',
            }}
            onClick={handleScrollRight}
          >
            <ChevronRightIcon size={14} color="rgba(28, 31, 35, 0.8)" />
          </div>
        </div>
      )}
    </div>
  );
});

MessageFileList.displayName = 'MessageFileList';
