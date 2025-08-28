import { memo, useMemo, useCallback } from 'react';
import { Typography, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { useActiveNode, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { ResourceItemAction } from '../share/resource-item-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { X, Location, Delete } from 'refly-icons';
import { useReactFlow } from '@xyflow/react';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';

const { Text } = Typography;

export const ResultList = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { canvasId, readonly } = useCanvasContext();
  const { setParentType, searchKeyword } = useCanvasResourcesPanelStoreShallow((state) => ({
    setParentType: state.setParentType,
    searchKeyword: state.searchKeyword,
  }));
  const { activeNode, setActiveNode } = useActiveNode(canvasId);

  // Add hooks for node operations
  const { getNodes, fitView } = useReactFlow();
  const { deleteNode } = useDeleteNode();

  // Filter nodes by the specified types and search keyword
  const resultNodes = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    let filteredNodes = nodes.filter(
      (node) =>
        ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
        (node.type === 'image' && !!node.data?.metadata?.resultId),
    );

    // Apply search keyword filtering if provided
    if (searchKeyword?.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      filteredNodes = filteredNodes.filter((node) => {
        const title = node.data?.title?.toLowerCase() ?? '';
        const contentPreview = node.data?.contentPreview?.toLowerCase() ?? '';
        const metadata = JSON.stringify(node.data?.metadata ?? {}).toLowerCase();

        return (
          title.includes(keyword) || contentPreview.includes(keyword) || metadata.includes(keyword)
        );
      });
    }

    return filteredNodes;
  }, [nodes, searchKeyword]);

  const handleNodeSelect = useCallback(
    (node: CanvasNode) => {
      setParentType('resultsRecord');
      setActiveNode(node);
    },
    [setParentType, setActiveNode],
  );

  // Handle locate node
  const handleLocateNode = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
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
    [getNodes, fitView],
  );

  // Handle delete node
  const handleDeleteNode = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
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
    [readonly, deleteNode, activeNode?.id, setActiveNode],
  );

  if (!resultNodes?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-refly-text-2 text-sm leading-5">
        {searchKeyword?.trim()
          ? t('canvas.resourceLibrary.noSearchResults')
          : t('canvas.resourceLibrary.noResultsRecord')}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="h-full flex flex-col gap-2">
        {resultNodes?.map((node: CanvasNode) => (
          <div
            key={node.id}
            className={cn(
              'bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-xl p-2 flex flex-col gap-1 cursor-pointer',
              activeNode?.id === node.id && 'bg-refly-tertiary-hover dark:bg-gray-700',
              '[--border-color:rgba(0,0,0,0.1)] dark:[--border-color:rgba(255,255,255,0.1)]',
            )}
            style={{
              borderWidth: '0.5px',
              borderStyle: 'solid',
              borderColor: 'var(--border-color, rgba(0, 0, 0, 0.1))',
              borderRadius: '12px',
            }}
            onClick={() => handleNodeSelect(node)}
          >
            {/* Top row: Green X icon + title text + refresh button */}
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {/* Green X icon - Figma design: 10x9 pixels */}
                <div className="text-[#0E9F77] dark:text-[#0E9F77] flex-shrink-0 h-4 w-4">
                  <X size={16} color="currentColor" />
                </div>

                {/* Title text - Figma design: 12px font, semibold */}
                <Text
                  ellipsis={{ tooltip: { placement: 'left' } }}
                  className="text-xs font-semibold text-black/60 dark:text-white/60 leading-[20px] flex-1 min-w-0 truncate h-[20px] flex items-center justify-start"
                >
                  {node.data?.title || t('common.untitled')}
                </Text>
              </div>
            </div>

            {/* Bottom row: Dynamic icon + title text + actions */}
            <div className="flex items-center gap-2 px-2 py-2">
              {/* Dynamic icon based on node type */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <NodeIcon
                  type={node.type as CanvasNodeType}
                  small
                  url={node.data?.metadata?.imageUrl as string}
                />
              </div>

              {/* Title text - Figma design: 14px font, normal weight */}
              <Text
                ellipsis={{ tooltip: { placement: 'left' } }}
                className={cn(
                  'text-sm leading-[1.43] text-[#1C1F23] dark:text-white flex-1 min-w-0 truncate flex items-center',
                  {
                    'font-semibold': activeNode?.id === node.id,
                  },
                )}
              >
                {node.data?.title || t('common.untitled')}
              </Text>

              {/* Actions - Figma design: location + delete icons with 12px gap */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Location icon */}
                <Tooltip title={t('canvas.nodeActions.centerNode')} arrow={false}>
                  <div
                    className="w-5 h-5 text-[#1C1F23]/80 hover:text-[#1C1F23] dark:text-white/80 dark:hover:text-white cursor-pointer"
                    onClick={(e) => handleLocateNode(e, node)}
                  >
                    <Location size={20} color="currentColor" />
                  </div>
                </Tooltip>

                {/* Delete icon */}
                {!readonly && (
                  <Tooltip title={t('common.delete')} arrow={false}>
                    <div
                      className="w-5 h-5 text-[#F93920] hover:text-[#F93920]/80 cursor-pointer"
                      onClick={(e) => handleDeleteNode(e, node)}
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
        ))}
      </div>
    </div>
  );
});

ResultList.displayName = 'ResultList';
