import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button, Typography, Input, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { ResourceItemAction } from '../share/resource-item-action';
import type { CanvasNode } from '@refly/canvas-common';
import { Refresh, X, Delete, Location, Doc1, Pdf, Doc, Data, Markdown } from 'refly-icons';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useActiveNode } from '@refly/stores';

const { Text } = Typography;

interface MyUploadItemProps {
  node: CanvasNode;
  isActive: boolean;
  onSelect: (node: CanvasNode, beforeParsed: boolean) => void;
}

/**
 * Get appropriate icon and styling based on node type
 */
const getNodeTypeIcon = (node: CanvasNode) => {
  const nodeType = node?.type;
  const metadata = node?.data?.metadata;

  // Helper function to safely check contentType
  const getContentType = () => {
    if (
      metadata?.resourceMeta &&
      typeof metadata.resourceMeta === 'object' &&
      'contentType' in metadata.resourceMeta &&
      typeof metadata.resourceMeta.contentType === 'string'
    ) {
      return metadata.resourceMeta.contentType;
    }
    return null;
  };

  const contentType = getContentType();

  // Image type - show thumbnail (both direct image type and resource with image content type)
  if (
    (nodeType === 'image' && metadata?.imageUrl && typeof metadata.imageUrl === 'string') ||
    (nodeType === 'resource' && contentType && contentType.startsWith('image/'))
  ) {
    // Get image URL from either direct imageUrl or construct from entityId for resource type
    let imageUrl: string | null = null;

    if (metadata?.imageUrl && typeof metadata.imageUrl === 'string') {
      // Use existing imageUrl if available
      imageUrl = metadata.imageUrl;
    } else if (
      nodeType === 'resource' &&
      contentType?.startsWith('image/') &&
      node?.data?.entityId
    ) {
      // For resource type, try to construct URL from existing imageUrl pattern
      // First try to find any existing imageUrl in metadata to extract base URL
      const existingImageUrl = Object.values(metadata || {}).find(
        (value) => typeof value === 'string' && value.includes('/v1/misc/'),
      ) as string | undefined;

      if (existingImageUrl) {
        // Extract base URL from existing imageUrl and construct new one
        const baseUrl = existingImageUrl.split('/v1/misc/')[0];
        imageUrl = `${baseUrl}/v1/misc/${node.data.entityId}`;
      }
    }

    if (imageUrl) {
      return {
        type: 'image',
        content: (
          <img
            src={imageUrl}
            alt={node?.data?.title || 'Image'}
            className="w-6 h-6 object-cover rounded-md flex-shrink-0"
            onError={(e) => {
              // Fallback to default icon if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ),
        fallback: (
          <div className="w-6 h-6 bg-[#0064FA] rounded-md flex items-center justify-center flex-shrink-0">
            <Doc1 size={24} color="white" />
          </div>
        ),
      };
    }
  }

  // PDF type - check both direct type and resource with PDF content type
  if (
    nodeType === 'pdf' ||
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      metadata.storageKey.toLowerCase().endsWith('.pdf')) ||
    (nodeType === 'resource' && contentType === 'application/pdf')
  ) {
    return {
      type: 'pdf',
      content: (
        <div className="w-6 h-6 bg-[#F04438] rounded-md flex items-center justify-center flex-shrink-0">
          <Pdf size={24} color="white" />
        </div>
      ),
    };
  }

  // PPT type - check both direct type and resource with PPT content type
  if (
    nodeType === 'ppt' ||
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      (metadata.storageKey.toLowerCase().endsWith('.ppt') ||
        metadata.storageKey.toLowerCase().endsWith('.pptx'))) ||
    (nodeType === 'resource' &&
      contentType &&
      (contentType.includes('powerpoint') || contentType.includes('presentation')))
  ) {
    return {
      type: 'ppt',
      content: (
        <div className="w-6 h-6 bg-[#9C27B0] rounded-md flex items-center justify-center flex-shrink-0">
          <Doc size={24} color="white" />
        </div>
      ),
    };
  }

  // Word document type - check both direct type and resource with Word content type
  if (
    nodeType === 'doc' ||
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      (metadata.storageKey.toLowerCase().endsWith('.doc') ||
        metadata.storageKey.toLowerCase().endsWith('.docx'))) ||
    (nodeType === 'resource' && contentType && contentType.includes('word'))
  ) {
    return {
      type: 'doc',
      content: (
        <div className="w-6 h-6 bg-[#0064FA] rounded-md flex items-center justify-center flex-shrink-0">
          <Doc1 size={24} color="white" />
        </div>
      ),
    };
  }

  // Excel type - check both direct type and resource with Excel content type
  if (
    nodeType === 'excel' ||
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      (metadata.storageKey.toLowerCase().endsWith('.xls') ||
        metadata.storageKey.toLowerCase().endsWith('.xlsx'))) ||
    (nodeType === 'resource' &&
      contentType &&
      (contentType.includes('spreadsheet') || contentType.includes('excel')))
  ) {
    return {
      type: 'excel',
      content: (
        <div className="w-6 h-6 bg-[#12B76A] rounded-md flex items-center justify-center flex-shrink-0">
          <Data size={24} color="white" />
        </div>
      ),
    };
  }

  // Text file type - check both direct type and resource with text content type
  if (
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      (metadata.storageKey.toLowerCase().endsWith('.txt') ||
        metadata.storageKey.toLowerCase().endsWith('.md'))) ||
    (nodeType === 'resource' && contentType && contentType.startsWith('text/'))
  ) {
    const isMarkdown =
      (metadata?.storageKey &&
        typeof metadata.storageKey === 'string' &&
        metadata.storageKey.toLowerCase().endsWith('.md')) ||
      (nodeType === 'resource' && contentType === 'text/markdown');

    return {
      type: 'text',
      content: (
        <div className="w-6 h-6 bg-[#667085] rounded-md flex items-center justify-center flex-shrink-0">
          {isMarkdown ? <Markdown size={24} color="white" /> : <Doc size={24} color="white" />}
        </div>
      ),
    };
  }

  // Code file type - check both direct type and resource with code content type
  if (
    (metadata?.storageKey &&
      typeof metadata.storageKey === 'string' &&
      (metadata.storageKey.toLowerCase().endsWith('.js') ||
        metadata.storageKey.toLowerCase().endsWith('.ts') ||
        metadata.storageKey.toLowerCase().endsWith('.py') ||
        metadata.storageKey.toLowerCase().endsWith('.java') ||
        metadata.storageKey.toLowerCase().endsWith('.cpp') ||
        metadata.storageKey.toLowerCase().endsWith('.html') ||
        metadata.storageKey.toLowerCase().endsWith('.css'))) ||
    (nodeType === 'resource' &&
      contentType &&
      (contentType.includes('javascript') ||
        contentType.includes('typescript') ||
        contentType.includes('python') ||
        contentType.includes('java') ||
        contentType.includes('html') ||
        contentType.includes('css')))
  ) {
    return {
      type: 'code',
      content: (
        <div className="w-6 h-6 bg-[#7C3AED] rounded-md flex items-center justify-center flex-shrink-0">
          <Data size={24} color="white" />
        </div>
      ),
    };
  }

  // Default to document icon
  return {
    type: 'doc',
    content: (
      <div className="w-6 h-6 bg-[#0064FA] rounded-md flex items-center justify-center flex-shrink-0">
        <Doc1 size={24} color="white" />
      </div>
    ),
  };
};

/**
 * Render a single uploaded resource item.
 */
export const MyUploadItem = memo<MyUploadItemProps>(({ node, isActive, onSelect }) => {
  const { t } = useTranslation();
  const { readonly, canvasId } = useCanvasContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);
  const updateNodeTitle = useUpdateNodeTitle();

  // Add hooks for node operations
  const { getNodes, fitView } = useReactFlow();
  const { deleteNode } = useDeleteNode();
  const { activeNode, setActiveNode } = useActiveNode(canvasId);

  // Get icon based on node type
  const nodeIcon = getNodeTypeIcon(node);

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

  // Handle locate node
  const handleLocateNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node?.type === 'group') {
        return;
      }
      const nodes = getNodes();
      const foundNode = nodes.find((n) => n.data?.entityId === node.data?.entityId);
      if (foundNode) {
        // Use fitView to center and zoom to the node
        fitView({
          nodes: [foundNode],
          padding: 0.2,
          duration: 300,
          minZoom: 0.6,
          maxZoom: 1.2,
        });
      }
    },
    [node, getNodes, fitView],
  );

  // Handle delete node
  const handleDeleteNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!node?.id || readonly) {
        return;
      }
      deleteNode({
        id: node.id,
        type: node.type,
        data: node.data,
        position: node.position ?? { x: 0, y: 0 },
      } as CanvasNode);
      if (activeNode?.id === node.id) {
        setActiveNode(null);
      }
    },
    [node, readonly, deleteNode, activeNode?.id, setActiveNode],
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

      {/* Bottom row: Dynamic icon + title text */}
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-[var(--tertiary---refly-tertiary-hover,rgba(0,0,0,0.08))] dark:hover:bg-[var(--tertiary---refly-tertiary-hover,rgba(255,255,255,0.08))] rounded-lg"
        onClick={() => onSelect(node, false)}
      >
        {/* Dynamic icon based on node type */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {nodeIcon.type === 'image' ? (
            <>
              {nodeIcon.content}
              {nodeIcon.fallback && (
                <div className="absolute inset-0 hidden">{nodeIcon.fallback}</div>
              )}
            </>
          ) : (
            nodeIcon.content
          )}
        </div>

        {/* Title text - Figma design: 14px font, normal weight */}
        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn(
            'text-sm leading-[1.43] text-[#1C1F23] dark:text-white flex-1 min-w-0 truncate flex items-center',
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
          <Tooltip title={t('canvas.nodeActions.centerNode')} arrow={false}>
            <div
              className="w-5 h-5 text-[#1C1F23]/80 hover:text-[#1C1F23] dark:text-white/80 dark:hover:text-white cursor-pointer"
              onClick={handleLocateNode}
            >
              <Location size={20} color="currentColor" />
            </div>
          </Tooltip>

          {/* Delete icon */}
          {!readonly && (
            <Tooltip title={t('common.delete')} arrow={false}>
              <div
                className="w-5 h-5 text-[#F93920] hover:text-[#F93920]/80 cursor-pointer"
                onClick={handleDeleteNode}
              >
                <Delete size={20} color="currentColor" />
              </div>
            </Tooltip>
          )}

          {/* Original ResourceItemAction */}
          <ResourceItemAction node={node} />
        </div>
      </div>
    </div>
  );
});

MyUploadItem.displayName = 'MyUploadItem';
