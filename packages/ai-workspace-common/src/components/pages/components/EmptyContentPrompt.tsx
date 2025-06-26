import { FC, useCallback, useState, useMemo, useEffect, useRef, CSSProperties } from 'react';
import { Button, Input, message, Checkbox } from 'antd';
import { PlusOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetCanvasData,
  useAddNodesToCanvasPage,
} from '@refly-packages/ai-workspace-common/queries/queries';
import classNames from 'classnames';
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/pages/components/NodeRenderer';
import { type NodeRelation } from './ArtifactRenderer';

// Spinner component
const Spinner: FC<{ size?: 'small' | 'default' | 'large' }> = ({ size = 'default' }) => (
  <div
    className={`animate-spin rounded-full border-t-2 border-blue-500 ${size === 'small' ? 'h-3 w-3' : 'h-5 w-5'}`}
  />
);

interface EmptyContentPromptProps {
  pageId?: string;
  canvasId?: string;
  onNodeAdded?: () => void;
  height?: string;
  excludeNodeIds?: string[];
}

/**
 * A component that displays available nodes when there is no content
 * and provides a way to add content by selecting from available nodes
 */
const EmptyContentPrompt: FC<EmptyContentPromptProps> = ({
  pageId,
  canvasId,
  onNodeAdded,
  height = '400px',
  excludeNodeIds = [],
}) => {
  const { t } = useTranslation();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get canvas data to find available nodes
  const { data: canvasData, isLoading: isLoadingCanvas } = useGetCanvasData(
    {
      query: {
        canvasId: canvasId || '',
      },
    },
    undefined,
    { enabled: !!canvasId },
  );

  // Add nodes to page mutation
  const { mutate: addNodesToPage, isPending: isAddingNodes } = useAddNodesToCanvasPage();

  // Get available nodes from canvas data
  const availableNodes = canvasData?.data?.nodes || [];

  // Filter out already existing nodes
  const filteredAvailableNodes = useMemo(() => {
    if (!excludeNodeIds.length) return availableNodes;
    return availableNodes.filter(
      (node) =>
        !excludeNodeIds.includes(node.data?.entityId) && !['skill', 'group'].includes(node?.type),
    );
  }, [availableNodes, excludeNodeIds]);

  // Filtered nodes based on search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return filteredAvailableNodes;

    return filteredAvailableNodes.filter((node) => {
      const nodeTitle = (node.data?.title || '').toLowerCase();
      const nodeId = (node.id || '').toLowerCase();
      const entityId = (node.data?.entityId || '').toLowerCase();
      const nodeType = (node.type || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      return (
        nodeTitle.includes(searchLower) ||
        entityId.includes(searchLower) ||
        nodeId.includes(searchLower) ||
        nodeType.includes(searchLower)
      );
    });
  }, [filteredAvailableNodes, searchTerm]);

  // Reset active index when filtered nodes change
  useEffect(() => {
    setActiveIndex(filteredNodes.length > 0 ? 0 : -1);
  }, [filteredNodes.length]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle node selection
  const handleNodeToggle = useCallback((nodeId: string) => {
    setSelectedNodeIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, []);

  // Handle select all nodes
  const handleSelectAll = useCallback(() => {
    if (selectedNodeIds.length === filteredNodes.length) {
      // If all nodes are selected, deselect all
      setSelectedNodeIds([]);
    } else {
      // Otherwise, select all filtered nodes
      const allEntityIds = filteredNodes
        .map((node) => node.data?.entityId)
        .filter(Boolean) as string[];
      setSelectedNodeIds(allEntityIds);
    }
  }, [filteredNodes, selectedNodeIds]);

  // Handle adding selected nodes to the page
  const handleAddNodes = useCallback(() => {
    if (!pageId || selectedNodeIds.length === 0) return;

    const targetCanvasId = canvasId || pageId;

    if (!targetCanvasId) {
      message.error(t('common.canvasIdMissing', 'Canvas ID is missing'));
      return;
    }

    addNodesToPage(
      {
        path: {
          canvasId: targetCanvasId,
        },
        body: {
          nodeIds: selectedNodeIds,
        },
      },
      {
        onSuccess: () => {
          message.success(t('common.nodesAddedSuccess', 'Nodes added successfully'));
          setSelectedNodeIds([]);
          if (onNodeAdded) {
            onNodeAdded();
          }
        },
        onError: (error) => {
          console.error('Failed to add nodes:', error);
          message.error(t('common.nodesAddedFailed', 'Failed to add nodes'));
        },
      },
    );
  }, [pageId, canvasId, selectedNodeIds, addNodesToPage, onNodeAdded, t]);

  // Clear all selections
  const handleClearAll = useCallback(() => {
    setSelectedNodeIds([]);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isComposing) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < filteredNodes.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filteredNodes.length) {
            const node = filteredNodes[activeIndex];
            handleNodeToggle(node.data?.entityId);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSearchTerm('');
          break;
      }
    },
    [filteredNodes, activeIndex, handleNodeToggle, isComposing],
  );

  // Cache thumbnail card style
  const thumbnailCardStyle: CSSProperties = useMemo(
    () => ({
      pointerEvents: 'none',
      transform: 'scale(0.4)',
      transformOrigin: 'top left',
      width: '250%',
      height: '250%',
      overflow: 'hidden',
    }),
    [],
  );

  // Convert Canvas node data to NodeRelation format
  const convertToNodeRelation = useCallback((node: any): NodeRelation => {
    return {
      relationId: node.id || '',
      nodeId: node.id || '',
      nodeType: node.type || 'document',
      entityId: node.data?.entityId || '',
      orderIndex: 0,
      nodeData: {
        title: node.data?.title || '',
        entityId: node.data?.entityId || '',
        metadata: {
          content: node.data?.content || '',
          status: 'finished',
          type: node.type === 'codeArtifact' ? 'text/javascript' : 'text/markdown',
        },
      },
    };
  }, []);

  return (
    <div
      className="refly-node-selector bg-white dark:bg-gray-900 rounded-lg flex flex-col"
      style={{ width: '100%', height, maxHeight: '80vh', maxWidth: '100%' }}
    >
      {/* Search bar */}
      <div className="p-4 border-b border-gray-200 flex items-center bg-white dark:bg-gray-900 gap-2 sticky top-0 z-10">
        <Input
          ref={inputRef}
          placeholder={t('common.searchNodes', 'Search nodes')}
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          className="w-full"
          allowClear
          size="large"
        />
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-gray-900" ref={listRef}>
        {isLoadingCanvas ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="large" />
            <span className="ml-2 text-gray-500">{t('common.loading', 'Loading...')}</span>
          </div>
        ) : filteredNodes.length > 0 ? (
          <div className="p-4 grid grid-cols-1 gap-4 pb-20">
            {filteredNodes.map((node, index) => (
              <div
                key={node.id}
                data-index={index}
                className={classNames(
                  'relative rounded-lg transition overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-gray-600 bg-white dark:bg-gray-700 ring-1',
                  'cursor-pointer',
                  selectedNodeIds.includes(node.data?.entityId)
                    ? 'ring-green-600'
                    : 'ring-transparent dark:ring-gray-700',
                )}
                onClick={() => handleNodeToggle(node.data?.entityId)}
              >
                {/* Card title */}
                <div
                  className={classNames(
                    'py-2 px-3 z-10 relative flex items-center justify-between',
                    selectedNodeIds.includes(node.data?.entityId)
                      ? 'border-b border-blue-100 dark:border-blue-800'
                      : 'border-b border-gray-100 dark:border-gray-800',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={classNames(
                        'flex items-center justify-center w-5 h-5 rounded-full text-xs',
                        selectedNodeIds.includes(node.data?.entityId)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                      {node.data?.title || t('common.untitled', 'Untitled')}
                    </span>
                  </div>
                  <Checkbox
                    checked={selectedNodeIds.includes(node.data?.entityId)}
                    onChange={() => handleNodeToggle(node.data?.entityId)}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1"
                  />
                </div>

                {/* Content preview area */}
                <div className="h-24 overflow-hidden relative bg-gray-50 dark:bg-gray-950">
                  <div style={thumbnailCardStyle}>
                    <NodeRenderer node={convertToNodeRelation(node)} isMinimap={true} />
                  </div>

                  {/* Gradient mask */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-gray-950 dark:to-transparent" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-gray-400 h-full flex items-center justify-center">
            <div className="text-sm">{t('common.noMatchingNodes', 'No matching nodes')}</div>
          </div>
        )}
      </div>

      {/* Action bar - fixed at bottom */}
      <div className="p-4 border-t border-solid border-1 border-x-0 border-b-0 border-transparent dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900 sticky bottom-0 left-0 right-0 z-10">
        <div className="text-sm text-gray-500">
          {selectedNodeIds.length > 0
            ? t('common.selectedItems', `Selected ${selectedNodeIds.length} items`, {
                count: selectedNodeIds.length,
              })
            : t('common.noItemsSelected', 'No items selected')}
        </div>
        <div className="flex gap-3">
          <Button size="middle" onClick={handleSelectAll}>
            {selectedNodeIds.length === filteredNodes.length && filteredNodes.length > 0
              ? t('common.deselectAll', 'Deselect All')
              : t('common.selectAll', 'Select All')}
          </Button>
          <Button
            size="middle"
            icon={<ClearOutlined />}
            onClick={handleClearAll}
            disabled={selectedNodeIds.length === 0}
          >
            {t('common.clear', 'Clear')}
          </Button>
          <Button
            type="primary"
            size="middle"
            icon={<PlusOutlined />}
            onClick={handleAddNodes}
            disabled={selectedNodeIds.length === 0}
            loading={isAddingNodes}
          >
            {t('common.add', 'Add')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmptyContentPrompt;
