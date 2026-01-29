import { memo, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { IContextItem } from '@refly/common-types';
import { cn } from '@refly/utils/cn';
import { FileIcon } from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { serverOrigin } from '@refly/ui-kit';
import { Image as ImageIcon } from 'refly-icons';
import { getFileTypeConfig, isImageFile, formatFileSize, getFileExtension } from './file-utils';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import type { DriveFile } from '@refly/openapi-schema';

// ChevronRight icon component (no equivalent in refly-icons)
const ChevronRightIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M5.25 3.5L8.75 7L5.25 10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface MessageFileListProps {
  contextItems: IContextItem[];
  canvasId: string;
  className?: string;
}

// Image thumbnail component - 48x48px with loading skeleton
const ImageThumbnail = memo(({ item, canvasId }: { item: IContextItem; canvasId: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
    setCurrentFile: state.setCurrentFile,
  }));

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

  const handleClick = useCallback(() => {
    // Convert IContextItem to DriveFile format
    const driveFile: DriveFile = {
      fileId: item.entityId,
      canvasId,
      name: item.title,
      type: item.metadata?.mimeType || 'image/*',
      size: item.metadata?.size,
      category: 'image',
    };
    setCurrentFile(driveFile);
  }, [item, canvasId, setCurrentFile]);

  return (
    <div
      className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gray-300 border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={handleClick}
    >
      {thumbnailUrl && !hasError ? (
        <>
          {/* Loading skeleton animation */}
          {isLoading && (
            <div className="w-full h-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
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
          <ImageIcon size={20} className="text-gray-400" />
        </div>
      )}
    </div>
  );
});

ImageThumbnail.displayName = 'ImageThumbnail';

// File card component - matches Figma design
const MessageFileCard = memo(({ item, canvasId }: { item: IContextItem; canvasId: string }) => {
  const extension = getFileExtension(item.title);
  const fileSize = formatFileSize(item.metadata?.size);
  const fileConfig = getFileTypeConfig(extension);
  const { setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
    setCurrentFile: state.setCurrentFile,
  }));

  const handleClick = useCallback(() => {
    // Convert IContextItem to DriveFile format
    const driveFile: DriveFile = {
      fileId: item.entityId,
      canvasId,
      name: item.title,
      type: item.metadata?.mimeType || 'text/plain',
      size: item.metadata?.size,
      category: 'document',
    };
    setCurrentFile(driveFile);
  }, [item, canvasId, setCurrentFile]);

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 flex-shrink-0 cursor-pointer hover:bg-gray-200 transition-colors"
      style={{ width: '166px', height: '48px' }}
      onClick={handleClick}
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
        <div className="text-xs font-normal truncate text-gray-900 leading-normal">
          {item.title}
        </div>
        {/* Meta info row - 10px */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 leading-tight">{extension}</span>
            {fileSize && (
              <span className="text-[10px] text-gray-400 leading-tight">{fileSize}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageFileCard.displayName = 'MessageFileCard';

export const MessageFileList = memo(
  ({ contextItems, canvasId, className }: MessageFileListProps) => {
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
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide">
          {fileItems.map((item) => {
            const extension = getFileExtension(item.title);
            const isImage = isImageFile(item.metadata?.mimeType, extension);

            return isImage ? (
              <ImageThumbnail key={item.entityId} item={item} canvasId={canvasId} />
            ) : (
              <MessageFileCard key={item.entityId} item={item} canvasId={canvasId} />
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
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white cursor-pointer pointer-events-auto mr-1 shadow-sm border border-gray-200"
              onClick={handleScrollRight}
            >
              <ChevronRightIcon size={14} className="text-gray-700" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

MessageFileList.displayName = 'MessageFileList';
