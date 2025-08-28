import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button, Typography, Input, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { ResourceItemAction } from '../share/resource-item-action';
import type { CanvasNode } from '@refly/canvas-common';
import { Refresh, X, Delete, Location, Doc1 } from 'refly-icons';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

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
  const { readonly } = useCanvasContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);
  const updateNodeTitle = useUpdateNodeTitle();

  // Update editing title when node changes
  useEffect(() => {
    if (node?.data?.title) {
      setEditingTitle(node.data.title);
    }
  }, [node?.data?.title]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (!node?.data?.entityId || !node?.type || readonly) return;

    setIsEditingTitle(true);
    setEditingTitle(node.data.title || '');

    // Focus the input after a short delay to ensure DOM is ready
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 100);
  }, [node?.data?.entityId, node?.type, node?.data?.title, readonly]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!node?.data?.entityId || !node?.type) return;

    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== node.data.title) {
      updateNodeTitle(newTitle, node.data.entityId, node.id, node.type as CanvasNodeType);
    }

    setIsEditingTitle(false);
  }, [node, editingTitle, updateNodeTitle]);

  // Handle title cancel
  const handleTitleCancel = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle(node?.data?.title || '');
  }, [node?.data?.title]);

  // Handle key press in title input
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        handleTitleCancel();
      }
    },
    [handleTitleSave, handleTitleCancel],
  );

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
          <div className="text-[#0E9F77] dark:text-[#0E9F77] flex-shrink-0 h-4 w-4">
            <X size={16} color="currentColor" />
          </div>

          {/* doc02 text - Figma design: 12px font, semibold */}
          {isEditingTitle && !readonly ? (
            <Input
              ref={titleInputRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyPress}
              className="min-w-0 flex-1 !max-w-[200px] h-[20px] text-xs rounded-lg shadow-sm px-2 leading-[1.33]"
              style={{
                borderRadius: '8px',
                border: '1px solid var(--refly-primary-default, #0E9F77)',
                background: 'var(--refly-bg-control-z0, #F6F6F6)',
                color: 'var(--refly-text-0, #1C1F23)',
              }}
              size="small"
              autoFocus
            />
          ) : (
            <Text
              ellipsis={{ tooltip: { placement: 'left' } }}
              className={cn(
                'text-xs font-semibold text-black/60 dark:text-white/60 leading-[20px] flex-1 min-w-0 truncate h-[20px] flex items-center justify-start',
                !readonly && 'cursor-pointer hover:text-black/80 dark:hover:text-white/80',
              )}
              onClick={!readonly ? handleTitleClick : undefined}
            >
              {node?.data?.title || t('common.untitled')}
            </Text>
          )}
        </div>

        {/* Refresh button - Figma design: 16x16 pixels */}
        <Tooltip title={t('common.replaceResource')}>
          <Button
            type="text"
            size="small"
            className="!p-0 !min-w-0 !h-4 !w-4 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              // Add refresh functionality here
            }}
          >
            <Refresh
              size={20}
              color="currentColor"
              className="text-[var(--text-icon-refly-text-2,rgba(28,31,35,0.60))] dark:text-white/60"
            />
          </Button>
        </Tooltip>
      </div>

      {/* Bottom row: Blue document icon + title text */}
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-[var(--tertiary---refly-tertiary-hover,rgba(0,0,0,0.08))] dark:hover:bg-[var(--tertiary---refly-tertiary-hover,rgba(255,255,255,0.08))] rounded-lg"
        onClick={() => onSelect(node, false)}
      >
        {/* Blue document icon - Figma design: 24x24 pixels */}
        <div className="w-6 h-6 bg-[#0064FA] rounded-md flex items-center justify-center flex-shrink-0">
          {/* Document icon - Figma design: 24x24 container */}
          <Doc1 size={24} color="white" />
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

        {/* Actions - Figma design: location + delete icons with 12px gap */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Location icon */}
          <div className="w-5 h-5 text-[#1C1F23]/80 hover:text-[#1C1F23] dark:text-white/80 dark:hover:text-white cursor-pointer">
            <Location size={20} color="currentColor" />
          </div>

          {/* Delete icon */}
          <div className="w-5 h-5 text-[#F93920] hover:text-[#F93920]/80 cursor-pointer">
            <Delete size={20} color="currentColor" />
          </div>

          {/* Original ResourceItemAction */}
          <ResourceItemAction node={node} />
        </div>
      </div>
    </div>
  );
});

MyUploadItem.displayName = 'MyUploadItem';
