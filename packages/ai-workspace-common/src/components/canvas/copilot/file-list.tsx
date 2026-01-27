import { memo, useRef, useState, useEffect, useCallback } from 'react';
import type { IContextItem } from '@refly/common-types';
import type { UploadProgress } from '@refly/stores';
import { FileCard } from './file-card';
import { cn } from '@refly/utils/cn';

// ChevronRight icon component (inline SVG to avoid external dependency)
const ChevronRightIcon = ({
  size = 16,
  color = 'currentColor',
}: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 18L15 12L9 6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface FileListProps {
  contextItems: IContextItem[];
  onRemove: (entityId: string) => void;
  onRetry?: (entityId: string) => void;
  disabled?: boolean;
  className?: string;
  uploads?: UploadProgress[];
}

export const FileList = memo(
  ({ contextItems, onRemove, onRetry, disabled, className, uploads = [] }: FileListProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const fileItems = contextItems.filter((item) => item.type === 'file');

    // Create a map of uploadId -> UploadProgress for quick lookup
    const uploadMap = new Map(uploads.map((u) => [u.id, u]));

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
        {/* Scrollable file cards container - pt-2 to prevent close button clipping */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pt-2 pb-1 file-list-scroll"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{'.file-list-scroll::-webkit-scrollbar { display: none; }'}</style>
          {fileItems.map((item) => (
            <FileCard
              key={item.entityId}
              item={item}
              onRemove={onRemove}
              onRetry={onRetry}
              disabled={disabled}
              uploadProgress={
                item.metadata?.uploadId ? uploadMap.get(item.metadata.uploadId) : undefined
              }
            />
          ))}
        </div>

        {/* Right gradient mask + circular arrow button */}
        {showRightArrow && (
          <div
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-end cursor-pointer"
            style={{
              background:
                'linear-gradient(270deg, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 100%)',
            }}
            onClick={handleScrollRight}
          >
            <div className="w-7 h-7 rounded-full border border-[rgba(28,31,35,0.1)] flex items-center justify-center bg-white shadow-sm hover:shadow transition-shadow mr-1">
              <ChevronRightIcon size={16} color="rgba(28,31,35,0.8)" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

FileList.displayName = 'FileList';
