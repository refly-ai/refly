import { memo, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { IContextItem } from '@refly/common-types';
import type { UploadProgress } from '@refly/stores';
import { ArrowLeft, ArrowRight } from 'refly-icons';
import { FileCard } from './file-card';
import { cn } from '@refly/utils/cn';
import { isImageFile, getFileExtension } from './file-utils';

interface FileListProps {
  contextItems: IContextItem[];
  canvasId: string;
  onRemove: (entityId: string) => void;
  onRetry?: (entityId: string) => void;
  disabled?: boolean;
  className?: string;
  uploads?: UploadProgress[];
}

export const FileList = memo(
  ({
    contextItems,
    canvasId,
    onRemove,
    onRetry,
    disabled,
    className,
    uploads = [],
  }: FileListProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const [showLeftArrow, setShowLeftArrow] = useState(false);

    const fileItems = contextItems.filter((item) => item.type === 'file');

    const isPureImages = useMemo(() => {
      if (fileItems.length === 0) return false;
      return fileItems.every((item) => {
        const ext = getFileExtension(item.title);
        return isImageFile(item.metadata?.mimeType, ext);
      });
    }, [fileItems]);

    const mode = isPureImages ? 'compact' : 'large';

    // Create a map of uploadId -> UploadProgress for quick lookup
    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

    // Check if arrows should be shown
    const checkScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const hasOverflow = el.scrollWidth > el.clientWidth;
      const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
      const notAtStart = el.scrollLeft > 10;
      setShowRightArrow(hasOverflow && notAtEnd);
      setShowLeftArrow(hasOverflow && notAtStart);
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
      scrollRef.current?.scrollBy({ left: 174, behavior: 'smooth' });
    };

    const handleScrollLeft = () => {
      scrollRef.current?.scrollBy({ left: -174, behavior: 'smooth' });
    };

    return (
      <div className={cn('relative', className)}>
        {/* Left gradient mask + circular arrow button */}
        {showLeftArrow && (
          <div
            className="absolute left-[-10px] top-0 h-full w-10 flex items-center justify-start cursor-pointer z-10"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,1) 40%, rgba(255,255,255,0) 100%)',
            }}
            onClick={handleScrollLeft}
          >
            <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center bg-white shadow-sm hover:shadow transition-shadow">
              <ArrowLeft size={16} color="var(--refly-text-1)" />
            </div>
          </div>
        )}

        {/* Scrollable file cards container - pt-2 to prevent close button clipping */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto p-2 -m-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {fileItems
            .slice()
            .reverse()
            .map((item) => (
              <FileCard
                key={item.entityId}
                item={item}
                canvasId={canvasId}
                onRemove={onRemove}
                onRetry={onRetry}
                disabled={disabled}
                mode={mode}
                uploadProgress={
                  item.metadata?.uploadId ? uploadMap.get(item.metadata.uploadId) : undefined
                }
              />
            ))}
        </div>

        {/* Right gradient mask + circular arrow button */}
        {showRightArrow && (
          <div
            className="absolute right-[-10px] top-0 h-full w-10 flex items-center justify-end cursor-pointer z-10"
            style={{
              background:
                'linear-gradient(270deg, rgba(255,255,255,1) 40%, rgba(255,255,255,0) 100%)',
            }}
            onClick={handleScrollRight}
          >
            <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center bg-white shadow-sm hover:shadow transition-shadow">
              <ArrowRight size={16} color="var(--refly-text-1)" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

FileList.displayName = 'FileList';
