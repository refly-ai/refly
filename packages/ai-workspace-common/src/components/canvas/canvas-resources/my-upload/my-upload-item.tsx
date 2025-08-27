import { memo } from 'react';
import { Button, Typography } from 'antd';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { ResourceItemAction } from '../share/resource-item-action';
import type { CanvasNode } from '@refly/canvas-common';
import { Refresh, X } from 'refly-icons';

const { Text } = Typography;

interface MyUploadItemProps {
  node: CanvasNode;
  isActive: boolean;
  onSelect: (node: CanvasNode, beforeParsed: boolean) => void;
}

/**
 * Render a single uploaded resource item.
 */
export const MyUploadItem = memo<MyUploadItemProps>(({ node, isActive, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl p-2 flex flex-col gap-1',
        isActive && 'bg-refly-tertiary-hover dark:bg-gray-700',
        '[--border-color:rgba(0,0,0,0.1)] dark:[--border-color:rgba(255,255,255,0.1)]',
      )}
      style={{
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: 'var(--border-color, rgba(0, 0, 0, 0.1))',
        borderRadius: '12px',
      }}
    >
      {/* Top row: Green X icon + doc02 text + refresh button */}
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {/* Green X icon - Figma design: 10x9 pixels */}
          <X size={12} color="#0E9F77" className="flex-shrink-0" />

          {/* doc02 text - Figma design: 12px font, semibold */}
          <Text
            ellipsis={{ tooltip: { placement: 'left' } }}
            className="text-xs font-semibold text-black/60 dark:text-white/60 leading-[1.33] flex-1 min-w-0 truncate"
          >
            doc02
          </Text>
        </div>

        {/* Refresh button - Figma design: 16x16 pixels */}
        <Button
          type="text"
          size="small"
          className="!p-0 !min-w-0 !h-4 !w-4 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            // Add refresh functionality here
          }}
        >
          <Refresh size={16} color="currentColor" className="text-black/60 dark:text-white/60" />
        </Button>
      </div>

      {/* Bottom row: Blue document icon + title text */}
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
        onClick={() => onSelect(node, false)}
      >
        {/* Blue document icon - Figma design: 20x20 pixels */}
        <div className="w-5 h-5 bg-[#0062D6] rounded-md flex items-center justify-center flex-shrink-0">
          {/* Document icon - Figma design: 20x20 container */}
          <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
            <path d="M4 2h8l4 4v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          </svg>
        </div>

        {/* Title text - Figma design: 14px font, normal weight */}
        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn(
            'text-sm leading-[1.43] text-[#1C1F23] dark:text-white flex-1 min-w-0 truncate',
            {
              'font-semibold': isActive,
            },
          )}
        >
          {node?.data?.title ?? t('common.untitled')}
        </Text>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ResourceItemAction node={node} />
        </div>
      </div>
    </div>
  );
});

MyUploadItem.displayName = 'MyUploadItem';
