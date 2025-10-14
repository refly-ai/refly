import { Edge, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, purgeToolsets, SkillNodeMeta } from '@refly/canvas-common';
import { Node } from '@xyflow/react';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';

import { getNodeCommonStyles } from './shared/styles';
import { ModelCapabilities, ModelInfo, SkillRuntimeConfig } from '@refly/openapi-schema';

import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow, useLaunchpadStoreShallow } from '@refly/stores';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { IContextItem } from '@refly/common-types';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { genActionResultID, genUniqueId, processQueryWithMentions } from '@refly/utils';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { convertContextItemsToNodeFilters } from '@refly/canvas-common';
import { useContextUpdateByEdges } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import {
  ChatComposer,
  type ChatComposerRef,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useDebouncedCallback } from 'use-debounce';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useContextPanelStore } from '@refly/stores';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { GenericToolset } from '@refly/openapi-schema';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useExtractVariables } from '@refly-packages/ai-workspace-common/queries';
import type { ExtractVariablesRequest, VariableExtractionResult } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';

const NODE_WIDTH = 480;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto' };

type SkillNode = Node<CanvasNodeData<SkillNodeMeta>, 'skill'>;

export const SkillNode = memo(
  ({ data, selected, id }: NodeProps<SkillNode>) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isMediaGenerating, setIsMediaGenerating] = useState(false);
    const chatComposerRef = useRef<ChatComposerRef>(null);
    const { edges } = useCanvasData();
    const { setNodeData, setNodeStyle } = useNodeData();
    const edgeStyles = useEdgeStyles();
    const { getNode, getNodes, getEdges, setEdges, deleteElements } = useReactFlow();
    const { addNode } = useAddNode();
    const { deleteNode } = useDeleteNode();
    useSelectedNodeZIndex(id, selected);

    const { canvasId, readonly } = useCanvasContext();
    const { t } = useTranslation();

    const { getFinalProjectId } = useAskProject();

    const { metadata = {} } = data;
    const {
      query,
      modelInfo,
      contextItems = [],
      runtimeConfig,
      selectedToolsets: metadataSelectedToolsets,
    } = metadata;

    const { selectedToolsets: selectedToolsetsFromStore } = useLaunchpadStoreShallow((state) => ({
      selectedToolsets: state.selectedToolsets,
    }));

    const [localQuery, setLocalQuery] = useState(query);
    const [_extractionResult, _setExtractionResult] = useState<VariableExtractionResult | null>(
      null,
    );
    const [isExtracting, setIsExtracting] = useState(false);
    const [selectedToolsets, setLocalSelectedToolsets] = useState<GenericToolset[]>(
      metadataSelectedToolsets ?? selectedToolsetsFromStore ?? [],
    );

    const { data: workflowVariables, refetch: refetchWorkflowVariables } = useGetWorkflowVariables({
      query: {
        canvasId,
      },
    });
    const extractVariablesMutation = useExtractVariables();

    // Check if node has any connections
    const isTargetConnected = useMemo(() => edges?.some((edge) => edge.target === id), [edges, id]);
    const isSourceConnected = useMemo(() => edges?.some((edge) => edge.source === id), [edges, id]);

    const updateNodeData = useDebouncedCallback((data: Partial<CanvasNodeData<SkillNodeMeta>>) => {
      setNodeData(id, data);
    }, 50);

    const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
      skillSelectedModel: state.skillSelectedModel,
      setSkillSelectedModel: state.setSkillSelectedModel,
    }));

    const { invokeAction, abortAction } = useInvokeAction({ source: 'skill-node' });

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
        setSkillSelectedModel(modelInfo);
      },
      [id, setNodeData, setSkillSelectedModel],
    );

    const setContextItems = useCallback(
      (items: IContextItem[] | ((prevItems: IContextItem[]) => IContextItem[])) => {
        const currentNode = getNode(id);
        const currentContextItems = ((currentNode?.data as CanvasNodeData<SkillNodeMeta>)?.metadata
          ?.contextItems ?? []) as IContextItem[];

        // Resolve the new items (handle both direct array and function updates)
        const newItems = typeof items === 'function' ? items(currentContextItems) : items;

        setNodeData(id, { metadata: { contextItems: newItems } });

        const nodes = getNodes() as CanvasNode<any>[];
        const entityNodeMap = new Map(nodes.map((node) => [node.data?.entityId, node]));

        // Filter items that have corresponding nodes (exclude uploaded images without nodes)
        const contextNodes = newItems
          .map((item) => entityNodeMap.get(item.entityId))
          .filter(Boolean);

        const edges = getEdges();
        const existingEdges = edges?.filter((edge) => edge.target === id) ?? [];
        const existingSourceIds = new Set(existingEdges.map((edge) => edge.source));
        const newSourceNodes = contextNodes.filter((node) => !existingSourceIds.has(node?.id));

        const newEdges = newSourceNodes.map((node) => ({
          id: `edge-${genUniqueId()}`,
          source: node.id,
          target: id,
          style: edgeStyles.hover,
          type: 'default',
        }));

        const contextNodeIds = new Set(contextNodes.map((node) => node?.id));
        const edgesToRemove = existingEdges.filter((edge) => !contextNodeIds.has(edge.source));

        setTimeout(() => {
          setEdges((currentEdges) => {
            let updatedEdges = [...currentEdges];

            // Add new edges
            if (newEdges?.length > 0) {
              updatedEdges = [...updatedEdges, ...newEdges];
            }

            // Remove edges that are no longer needed
            if (edgesToRemove?.length > 0) {
              const edgesToRemoveIds = new Set(edgesToRemove.map((edge) => edge.id));
              updatedEdges = updatedEdges.filter((edge) => !edgesToRemoveIds.has(edge.id));
            }

            return updatedEdges;
          });
        }, 10);
      },
      [id, setNodeData, setEdges, getNodes, getEdges, edgeStyles.hover],
    );

    const setRuntimeConfig = useCallback(
      (runtimeConfig: SkillRuntimeConfig) => {
        setNodeData(id, { metadata: { runtimeConfig } });
      },
      [id, setNodeData],
    );

    const setSelectedToolsets = useCallback(
      (toolsets: GenericToolset[]) => {
        const purgedToolsets = purgeToolsets(toolsets);
        setLocalSelectedToolsets(purgedToolsets);
        updateNodeData({ metadata: { selectedToolsets: purgedToolsets } });
      },
      [updateNodeData],
    );

    useEffect(() => {
      if (!metadataSelectedToolsets) {
        setSelectedToolsets(selectedToolsetsFromStore ?? []);
      }
    }, [selectedToolsetsFromStore, metadataSelectedToolsets]);

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Auto-focus input when node is selected
    useEffect(() => {
      if (selected && !readonly) {
        // Use a small delay to ensure the component is fully rendered
        const timer = setTimeout(() => {
          chatComposerRef.current?.focus();
        }, 100);

        return () => clearTimeout(timer);
      }
    }, [selected, readonly]);

    useEffect(() => {
      if (skillSelectedModel && !modelInfo) {
        setModelInfo(skillSelectedModel);
      }
    }, [skillSelectedModel, modelInfo, setModelInfo]);

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

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
      const {
        query = '',
        contextItems = [],
        modelInfo,
        runtimeConfig = {},
        projectId,
      } = data?.metadata ?? {};
      const { runtimeConfig: contextRuntimeConfig } = useContextPanelStore.getState();
      const finalProjectId = getFinalProjectId(projectId);

      // Check if this is a media generation model
      const isMediaGeneration = modelInfo?.category === 'mediaGeneration';

      if (isMediaGeneration) {
        // Prevent multiple clicks during media generation
        if (isMediaGenerating) {
          return;
        }

        setIsMediaGenerating(true);
        logEvent('run_ask_ai', null, {
          model: modelInfo?.name,
          canvasId,
        });

        // Handle media generation using existing media generation flow
        // Parse capabilities from modelInfo
        const capabilities = modelInfo?.capabilities as ModelCapabilities;
        const mediaType = capabilities?.image
          ? 'image'
          : capabilities?.video
            ? 'video'
            : capabilities?.audio
              ? 'audio'
              : 'image'; // Default fallback

        // Emit media generation event
        nodeOperationsEmitter.emit('generateMedia', {
          providerItemId: modelInfo?.providerItemId ?? '',
          targetType: 'canvas',
          targetId: canvasId ?? '',
          mediaType,
          query,
          modelInfo,
          nodeId: id,
          contextItems,
        });

        return;
      }

      // Direct skill execution without automatic variable extraction
      // Only use extraction result if it was manually triggered via button
      const originalQuery = query || localQuery;
      if (!canvasId || !originalQuery) {
        return;
      }

      logEvent('run_ask_ai', null, {
        model: modelInfo?.name,
        canvasId,
      });

      // Process query with workflow variables
      const variables = workflowVariables?.data ?? [];
      const { processedQuery } = processQueryWithMentions(originalQuery, {
        replaceVars: true,
        variables,
      });

      const resultId = genActionResultID();
      invokeAction(
        {
          resultId,
          query: processedQuery, // Use processed query for skill execution
          modelInfo,
          contextItems,
          version: data?.metadata.version,
          runtimeConfig: {
            ...contextRuntimeConfig,
            ...runtimeConfig,
          },
          projectId: finalProjectId,
          selectedToolsets,
          structuredData: {
            query: originalQuery,
          },
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      addNode(
        {
          type: 'skillResponse',
          data: {
            title: processedQuery, // Use processed query for title
            entityId: resultId,
            metadata: {
              ...data?.metadata,
              status: 'executing',
              contextItems,
              selectedToolsets,
              modelInfo,
              runtimeConfig: {
                ...contextRuntimeConfig,
                ...runtimeConfig,
              },
              structuredData: {
                query: originalQuery, // Store original query in structuredData
              },
              projectId: finalProjectId,
            },
          },
          position: node.position,
        },
        convertContextItemsToNodeFilters(contextItems),
      );
      deleteElements({ nodes: [node] });
    }, [
      id,
      getNode,
      deleteElements,
      invokeAction,
      canvasId,
      addNode,
      localQuery,
      selectedToolsets,
      contextItems,
      modelInfo,
      runtimeConfig,
      getFinalProjectId,
    ]);

    const handleDelete = useCallback(() => {
      const currentNode = getNode(id);
      deleteNode({
        id,
        type: 'skill',
        data,
        position: currentNode?.position || { x: 0, y: 0 },
      });
    }, [id, data, getNode, deleteNode]);

    useEffect(() => {
      const handleNodeRun = () => handleSendMessage();
      const handleExtractVariables = async () => {
        const node = getNode(id);
        const data = (node?.data ?? {}) as CanvasNodeData<SkillNodeMeta>;
        const prompt = (data?.metadata?.query ?? '').toString();

        // Guard: require non-empty canvasId and prompt
        if (!canvasId || !prompt) {
          return;
        }

        setIsExtracting(true);
        const payload: ExtractVariablesRequest = {
          prompt,
          canvasId,
          mode: 'candidate',
        };

        try {
          const _result = await extractVariablesMutation.mutateAsync({ body: payload });
          console.log('🚀 ~ handleExtractVariables ~ _result:', _result);
          // const extractionData = result?.data;

          // if (extractionData) {
          //   setExtractionResult(extractionData);
          //   // Update the query with processed prompt
          //   setQuery(extractionData.processedPrompt);
          //   setLocalQuery(extractionData.processedPrompt);
          //   updateNodeData({
          //     title: extractionData.processedPrompt,
          //     metadata: {
          //       ...data?.metadata,
          //       query: extractionData.processedPrompt,
          //     },
          //   });
          // }
          // Refresh workflow variables so RichChatInput can render latest variables
          // await refetchWorkflowVariables();
        } catch {
          // No-op: UI toasts can be added by caller if needed
        } finally {
          setIsExtracting(false);
        }
      };
      const handleNodeDelete = () => handleDelete();

      // Handle media generation completion events
      const handleMediaGenerationComplete = ({
        nodeId: completedNodeId,
        success,
        error,
      }: { nodeId: string; success: boolean; error?: string }) => {
        // Reset loading state if this is the node we're waiting for
        if (completedNodeId === id) {
          setIsMediaGenerating(false);

          // Show error message if generation failed
          if (!success && error) {
            console.error('Media generation failed:', error);
          }
        }
      };

      nodeActionEmitter.on(createNodeEventName(id, 'run'), handleNodeRun);
      nodeActionEmitter.on(createNodeEventName(id, 'extractVariables'), handleExtractVariables);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeOperationsEmitter.on('mediaGenerationComplete', handleMediaGenerationComplete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'run'), handleNodeRun);
        nodeActionEmitter.off(createNodeEventName(id, 'extractVariables'), handleExtractVariables);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeOperationsEmitter.off('mediaGenerationComplete', handleMediaGenerationComplete);
        cleanupNodeEvents(id);
      };
    }, [
      id,
      handleSendMessage,
      handleDelete,
      canvasId,
      getNode,
      extractVariablesMutation,
      refetchWorkflowVariables,
      updateNodeData,
      setQuery,
      setLocalQuery,
    ]);

    // Use the new custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByEdges({
      readonly,
      nodeId: id,
      updateNodeData: (data) => updateNodeData(data),
    });

    // listen to edges changes and automatically update contextItems
    useEffect(() => {
      const handleEdgeChange = (data: { newEdges: Edge[] }) => {
        const node = getNode(id) as CanvasNode<SkillNodeMeta>;
        if (!node) return;
        const contextItems = node.data?.metadata?.contextItems ?? [];
        debouncedUpdateContextItems(contextItems, data.newEdges ?? []);
      };

      edgeEventsEmitter.on('edgeChange', handleEdgeChange);

      return () => edgeEventsEmitter.off('edgeChange', handleEdgeChange);
    }, [id, debouncedUpdateContextItems]);

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl relative"
        style={NODE_SIDE_CONFIG}
        data-cy="skill-node"
      >
        {!readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="skill"
            isNodeHovered={isHovered}
            isSelected={selected}
            isExtracting={isExtracting}
          />
        )}

        <CustomHandle
          id={`${id}-target`}
          nodeId={id}
          type="target"
          position={Position.Left}
          isConnected={isTargetConnected}
          isNodeHovered={isHovered}
          nodeType="skill"
        />
        <CustomHandle
          id={`${id}-source`}
          nodeId={id}
          type="source"
          position={Position.Right}
          isConnected={isSourceConnected}
          isNodeHovered={isHovered}
          nodeType="skill"
        />

        <div
          className={`h-full flex flex-col relative z-1 px-4 py-3 box-border ${getNodeCommonStyles({ selected, isHovered })}`}
        >
          <ChatComposer
            ref={chatComposerRef}
            query={localQuery}
            setQuery={setQuery}
            handleSendMessage={handleSendMessage}
            handleAbort={abortAction}
            contextItems={contextItems}
            setContextItems={setContextItems}
            modelInfo={modelInfo}
            setModelInfo={setModelInfo}
            runtimeConfig={runtimeConfig || {}}
            setRuntimeConfig={setRuntimeConfig}
            placeholder={t('canvas.launchpad.commonChatInputPlaceholder')}
            inputClassName="px-1 py-0"
            maxRows={6}
            onFocus={() => {}}
            enableRichInput={true}
            selectedToolsets={selectedToolsets}
            onSelectedToolsetsChange={setSelectedToolsets}
            isExecuting={isMediaGenerating}
          />
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

SkillNode.displayName = 'SkillNode';
