import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button, Typography, Input, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { ResourceItemAction } from '../share/resource-item-action';
import type { CanvasNode } from '@refly/canvas-common';
import { Refresh, X } from 'refly-icons';
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
          <X size={12} color="#0E9F77" className="flex-shrink-0" />

          {/* doc02 text - Figma design: 12px font, semibold */}
          {isEditingTitle && !readonly ? (
            <Input
              ref={titleInputRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyPress}
              className="min-w-0 flex-1 !max-w-[200px] h-[20px] text-xs !bg-gray-100 rounded-lg !border-0 shadow-sm px-2 leading-[1.33]"
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
              size={16}
              color="rgba(28, 31, 35, 0.60)"
              className="text-[var(--text-icon-refly-text-2,rgba(28,31,35,0.60))]"
            />
          </Button>
        </Tooltip>
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
