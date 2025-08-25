import { Edge, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, MediaSkillNodeMeta } from '@refly/canvas-common';
import { Node } from '@xyflow/react';
import { Typography } from 'antd';
import { CustomHandle } from '../shared/custom-handle';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { getNodeCommonStyles } from '../shared/styles';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { IContextItem } from '@refly/common-types';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { genUniqueId } from '@refly/utils/id';
import { useContextUpdateByEdges } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useDebouncedCallback } from 'use-debounce';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from '../shared/node-action-buttons';
import { useTranslation } from 'react-i18next';
import { MediaChatInput } from './media-input';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { useChatStoreShallow } from '@refly/stores';
import { NodeIcon } from '../shared/node-icon';

const { Text } = Typography;

const NODE_SIDE_CONFIG = { width: 320, height: 'auto' };

type MediaSkillNode = Node<CanvasNodeData<MediaSkillNodeMeta>, 'mediaSkill'>;

export const MediaSkillNode = memo(
  ({ data, selected, id }: NodeProps<MediaSkillNode>) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    const { edges } = useCanvasData();
    const { setNodeData, setNodeStyle } = useNodeData();
    const edgeStyles = useEdgeStyles();
    const { getNode, getNodes, getEdges, addEdges, deleteElements } = useReactFlow();
    const { deleteNode } = useDeleteNode();
    useSelectedNodeZIndex(id, selected);

    const { readonly } = useCanvasContext();

    // Get mediaSelectedModel from store for fallback
    const { mediaSelectedModel } = useChatStoreShallow((state) => ({
      mediaSelectedModel: state.mediaSelectedModel,
    }));

    const { metadata = {} } = data;
    const { query, contextItems = [], selectedModel } = metadata;

    const [localQuery, setLocalQuery] = useState(query);

    // Initialize local selected model from metadata or fallback to store's mediaSelectedModel
    const [localSelectedModel, setLocalSelectedModel] = useState(() => {
      // If metadata has selectedModel, use it
      if (selectedModel) {
        return selectedModel;
      }
      // Otherwise fallback to store's mediaSelectedModel
      return mediaSelectedModel;
    });

    // Update local selected model when metadata changes
    useEffect(() => {
      if (selectedModel) {
        setLocalSelectedModel(selectedModel);
      }
    }, [selectedModel]);

    // Check if node has any connections
    const isTargetConnected = useMemo(() => edges?.some((edge) => edge.target === id), [edges, id]);
    const isSourceConnected = useMemo(() => edges?.some((edge) => edge.source === id), [edges, id]);

    const updateNodeData = useDebouncedCallback(
      (data: Partial<CanvasNodeData<MediaSkillNodeMeta>>) => {
        setNodeData(id, data);
      },
      50,
    );

    const setQuery = useCallback(
      (query: string) => {
        setLocalQuery(query);
        updateNodeData({ title: query, metadata: { query } });
      },
      [updateNodeData],
    );

    const setContextItems = useCallback(
      (items: IContextItem[]) => {
        setNodeData(id, { metadata: { contextItems: items } });

        const nodes = getNodes() as CanvasNode<any>[];
        const entityNodeMap = new Map(nodes.map((node) => [node.data?.entityId, node]));
        const contextNodes = items.map((item) => entityNodeMap.get(item.entityId)).filter(Boolean);

        const edges = getEdges();
        const existingEdges = edges?.filter((edge) => edge.target === id) ?? [];
        const existingSourceIds = new Set(existingEdges.map((edge) => edge.source));
        const newSourceNodes = contextNodes.filter(
          (node) => !existingSourceIds.has(node?.id ?? ''),
        );

        const newEdges = newSourceNodes.map((node) => ({
          id: `edge-${genUniqueId()}`,
          source: node?.id ?? '',
          target: id,
          style: edgeStyles.hover,
          type: 'default',
        }));

        const contextNodeIds = new Set(contextNodes.map((node) => node?.id));
        const edgesToRemove = existingEdges.filter((edge) => !contextNodeIds.has(edge.source));

        setTimeout(() => {
          if (newEdges?.length > 0) {
            addEdges(newEdges);
          }

          if (edgesToRemove?.length > 0) {
            deleteElements({ edges: edgesToRemove });
          }
        }, 10);
      },
      [id, setNodeData, addEdges, getNodes, getEdges, deleteElements, edgeStyles.hover],
    );

    const setSelectedModel = useCallback(
      (model: any) => {
        setLocalSelectedModel(model);
        updateNodeData({ metadata: { selectedModel: model } });
      },
      [updateNodeData],
    );

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleDelete = useCallback(() => {
      const currentNode = getNode(id);
      deleteNode({
        id,
        type: 'mediaSkill',
        data,
        position: currentNode?.position || { x: 0, y: 0 },
      });
    }, [id, data, getNode, deleteNode]);

    useEffect(() => {
      const handleNodeDelete = () => handleDelete();

      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        cleanupNodeEvents(id);
      };
    }, [id, handleDelete]);

    // Use the new custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByEdges({
      readonly,
      nodeId: id,
      updateNodeData: (data) => updateNodeData(data),
    });

    // listen to edges changes and automatically update contextItems
    useEffect(() => {
      const handleEdgeChange = (data: { newEdges: Edge[] }) => {
        const node = getNode(id) as CanvasNode<MediaSkillNodeMeta>;
        if (!node) return;
        const contextItems = node.data?.metadata?.contextItems ?? [];
        debouncedUpdateContextItems(contextItems, data.newEdges ?? []);
      };

      edgeEventsEmitter.on('edgeChange', handleEdgeChange);

      return () => edgeEventsEmitter.off('edgeChange', handleEdgeChange);
    }, [id, debouncedUpdateContextItems, getNode]);

    // Set node style on mount
    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl relative"
        style={NODE_SIDE_CONFIG}
        data-cy="media-skill-node"
      >
        {!readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="mediaSkill"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        <CustomHandle
          id={`${id}-target`}
          nodeId={id}
          type="target"
          position={Position.Left}
          isConnected={isTargetConnected}
          isNodeHovered={isHovered}
          nodeType="mediaSkill"
        />
        <CustomHandle
          id={`${id}-source`}
          nodeId={id}
          type="source"
          position={Position.Right}
          isConnected={isSourceConnected}
          isNodeHovered={isHovered}
          nodeType="mediaSkill"
        />

        <div
          className={`h-full flex flex-col relative z-1 p-4 box-border ${getNodeCommonStyles({ selected, isHovered })}`}
        >
          {/* Node Type Header */}
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700 mb-3">
            <NodeIcon type="mediaSkill" />
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('canvas.nodes.mediaSkill.mediaGenerate', 'Media Generator')}
            </Text>
          </div>

          {/* TODO: add context manager */}
          {false && (
            <ContextManager contextItems={contextItems} setContextItems={setContextItems} />
          )}

          <div className="flex-grow">
            <MediaChatInput
              readonly={readonly}
              query={localQuery || ''}
              setQuery={setQuery}
              nodeId={id}
              size="small"
              defaultModel={localSelectedModel}
              onModelChange={setSelectedModel}
            />
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders by comparing only necessary props
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.data?.title === nextProps.data?.title &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata)
    );
  },
);

MediaSkillNode.displayName = 'MediaSkillNode';
