import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNodeData, SkillNodeMeta } from './types';
import { Node } from '@xyflow/react';
import { CustomHandle } from './custom-handle';
import { useState, useCallback, useEffect, useMemo } from 'react';

import { getNodeCommonStyles } from './index';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { IconAskAI } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ModelInfo, Skill } from '@refly/openapi-schema';
import { useDebouncedCallback } from 'use-debounce';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { convertContextItemsToContext } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { ActionButtons } from '@refly-packages/ai-workspace-common/components/canvas/nodes/action-buttons';
import { cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useSetNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';

type SkillNode = Node<CanvasNodeData<SkillNodeMeta>, 'skill'>;

export const SkillNode = ({ data, selected, id }: NodeProps<SkillNode>) => {
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const setNodeData = useSetNodeData();
  const edgeStyles = useEdgeStyles();
  const { getNode, addEdges, deleteElements } = useReactFlow();
  const handleDeleteNode = useDeleteNode(
    {
      id,
      type: 'skill',
      data,
      position: { x: 0, y: 0 },
    },
    'skill',
  );

  const { query, selectedSkill, modelInfo, contextNodeIds = [] } = data.metadata;

  const [localQuery, setLocalQuery] = useState(query);

  // Check if node has any connections
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  const updateNodeData = useDebouncedCallback((data: Partial<CanvasNodeData<SkillNodeMeta>>) => {
    setNodeData(id, data);
  }, 50);

  const { selectedModel } = useChatStoreShallow((state) => ({
    selectedModel: state.selectedModel,
  }));

  const { invokeAction, abortAction } = useInvokeAction();
  const { canvasId } = useCanvasContext();

  const setQuery = useCallback(
    (query: string) => {
      setLocalQuery(query);
      updateNodeData({ title: query, metadata: { query } });
    },
    [id, updateNodeData],
  );

  const setModelInfo = useCallback(
    (modelInfo: ModelInfo | null) => {
      setNodeData(id, { metadata: { modelInfo } });
    },
    [id, setNodeData],
  );

  const contextItems = useMemo(() => contextNodeIds.map((id) => getNode(id) as NodeItem), [contextNodeIds]);

  const setContextItems = useCallback(
    (items: NodeItem[]) => {
      // Update node data with new context node IDs
      setNodeData(id, { metadata: { contextNodeIds: items.map((item) => item.id) } });

      const { edges = [] } = useCanvasStore.getState().data[canvasId] ?? {};

      // Get existing edges connected to this node
      const existingEdges = edges?.filter((edge) => edge.target === id) ?? [];
      const existingSourceIds = new Set(existingEdges.map((edge) => edge.source));

      // Find items that need new connections
      const newItems = items.filter((item) => !existingSourceIds.has(item.id));

      // Create new edges for unconnected items
      const newEdges = newItems.map((item) => ({
        id: `${item.id}-${id}`,
        source: item.id,
        target: id,
        style: edgeStyles.hover,
        type: 'default',
      }));

      // Find edges that need to be removed
      const edgesToRemove = existingEdges.filter((edge) => !items.some((item) => item.id === edge.source));

      // Apply changes
      if (newEdges?.length > 0) {
        addEdges(newEdges);
      }

      if (edgesToRemove?.length > 0) {
        deleteElements({ edges: edgesToRemove });
      }
    },
    [id, canvasId, setNodeData, addEdges, deleteElements],
  );

  useEffect(() => {
    if (selectedModel && !modelInfo) {
      setModelInfo(selectedModel);
    }
  }, [selectedModel]);

  const setSelectedSkill = useCallback(
    (skill: Skill | null) => {
      setNodeData(id, { metadata: { selectedSkill: skill } });
    },
    [id, updateNodeData],
  );

  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

  // Handle node hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHoverStart();
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverEnd();
  }, [onHoverEnd]);

  const handleSendMessage = useCallback(() => {
    const node = getNode(id);
    const data = node?.data as CanvasNodeData<SkillNodeMeta>;
    const { query, modelInfo, selectedSkill } = data.metadata ?? {};

    deleteElements({ nodes: [node] });

    invokeAction(
      {
        resultId: data.entityId,
        input: {
          query,
        },
        target: {
          entityId: canvasId,
          entityType: 'canvas',
        },
        modelName: modelInfo?.name,
        context: convertContextItemsToContext(contextItems),
        resultHistory: contextItems
          .filter((item) => item.type === 'skillResponse')
          .map((item) => ({
            resultId: item.data?.entityId,
            title: item.data?.title,
          })),
        skillName: selectedSkill?.name,
      },
      node?.position,
    );
  }, [id]);

  useEffect(() => {
    // Create node-specific event handlers
    const handleNodeRun = () => handleSendMessage();
    const handleNodeDelete = () => handleDeleteNode();

    // Register events with node ID
    nodeActionEmitter.on(createNodeEventName(id, 'run'), handleNodeRun);
    nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

    return () => {
      // Cleanup events when component unmounts
      nodeActionEmitter.off(createNodeEventName(id, 'run'), handleNodeRun);
      nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);

      // Clean up all node events
      cleanupNodeEvents(id);
    };
  }, [id, handleSendMessage, handleDeleteNode]);

  return (
    <div className="relative group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div
        className={`
          w-[384px]
          max-h-[400px]
          ${getNodeCommonStyles({ selected, isHovered })}
        `}
      >
        <ActionButtons type="skill" nodeId={id} />

        <CustomHandle
          type="target"
          position={Position.Left}
          isConnected={isTargetConnected}
          isNodeHovered={isHovered}
          nodeType="skill"
        />
        <CustomHandle
          type="source"
          position={Position.Right}
          isConnected={isSourceConnected}
          isNodeHovered={isHovered}
          nodeType="skill"
        />

        <div className="flex flex-col gap-1">
          {/* Header with Icon and Type */}
          <div className="flex items-center gap-2">
            <div
              className="
                w-6 
                h-6 
                rounded 
                bg-[#6172F3]
                shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)]
                flex 
                items-center 
                justify-center
                flex-shrink-0
              "
            >
              <IconAskAI className="w-4 h-4 text-white" />
            </div>

            <span
              className="
                text-[13px]
                font-medium
                leading-normal
                text-[rgba(0,0,0,0.8)]
                font-['PingFang_SC']
                truncate
              "
            >
              {'Prompt'}
            </span>
          </div>

          <ContextManager contextItems={contextItems} setContextItems={setContextItems} />
          <ChatInput
            handleSendMessage={() => handleSendMessage()}
            query={localQuery}
            setQuery={setQuery}
            selectedSkill={selectedSkill}
          />
          <ChatActions
            query={localQuery}
            model={modelInfo}
            setModel={setModelInfo}
            handleSendMessage={handleSendMessage}
            handleAbort={abortAction}
          />
        </div>
      </div>
    </div>
  );
};
