import { Edge, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, SkillNodeMeta } from '@refly/canvas-common';
import { Node } from '@xyflow/react';
import { Form } from 'antd';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';

import { getNodeCommonStyles } from './shared/styles';
import {
  ModelCapabilities,
  ModelInfo,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  WorkflowVariable,
} from '@refly/openapi-schema';

// Use union type from launchpad/types for mention-capable variables
import type { MentionVariable } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/types';
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
import { genActionResultID, genUniqueId } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { convertContextItemsToNodeFilters } from '@refly/canvas-common';
import { useContextUpdateByEdges } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { ChatPanel } from '@refly-packages/ai-workspace-common/components/canvas/node-chat-panel';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
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

const NODE_WIDTH = 480;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto' };

type SkillNode = Node<CanvasNodeData<SkillNodeMeta>, 'skill'>;

export const SkillNode = memo(
  ({ data, selected, id }: NodeProps<SkillNode>) => {
    const [isHovered, setIsHovered] = useState(false);
    const { edges, nodes } = useCanvasData();
    const { setNodeData, setNodeStyle } = useNodeData();
    const edgeStyles = useEdgeStyles();
    const { getNode, getNodes, getEdges, addEdges, deleteElements } = useReactFlow();
    const { addNode } = useAddNode();
    const { deleteNode } = useDeleteNode();
    const [form] = Form.useForm();
    useSelectedNodeZIndex(id, selected);

    const { canvasId, readonly } = useCanvasContext();

    const { projectId, handleProjectChange, getFinalProjectId } = useAskProject();

    const { entityId, metadata = {} } = data;
    const {
      query,
      selectedSkill,
      modelInfo,
      contextItems = [],
      tplConfig,
      runtimeConfig,
      selectedToolsets: metadataSelectedToolsets,
    } = metadata;
    const skill = useFindSkill(selectedSkill?.name);

    const { selectedToolsets: selectedToolsetsFromStore } = useLaunchpadStoreShallow((state) => ({
      selectedToolsets: state.selectedToolsets,
    }));

    const [localQuery, setLocalQuery] = useState(query);
    const [extractionResult, setExtractionResult] = useState<VariableExtractionResult | null>(null);
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

    // Generate variables including canvas nodes
    const variables: MentionVariable[] = useMemo(() => {
      const baseVariables: MentionVariable[] = (workflowVariables?.data ?? []) as MentionVariable[];
      // Add step record variables from skillResponse nodes
      const stepRecordVariables: MentionVariable[] =
        nodes
          ?.filter((node) => node.type === 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? '未命名步骤',
            description: '步骤记录',
            source: 'stepRecord',
            variableType: 'step',
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      // Add result record variables from non-skill nodes
      const resultRecordVariables: MentionVariable[] =
        nodes
          ?.filter((node) => node.type !== 'skill' && node.type !== 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? '未命名结果',
            description: '结果记录',
            source: 'resultRecord',
            variableType: 'result',
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      return [...baseVariables, ...stepRecordVariables, ...resultRecordVariables];
    }, [nodes, workflowVariables?.data]);

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
      (items: IContextItem[]) => {
        setNodeData(id, { metadata: { contextItems: items } });

        const nodes = getNodes() as CanvasNode<any>[];
        const entityNodeMap = new Map(nodes.map((node) => [node.data?.entityId, node]));
        const contextNodes = items.map((item) => entityNodeMap.get(item.entityId)).filter(Boolean);

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

    const setRuntimeConfig = useCallback(
      (runtimeConfig: SkillRuntimeConfig) => {
        setNodeData(id, { metadata: { runtimeConfig } });
      },
      [id, setNodeData],
    );

    const setSelectedToolsets = useCallback(
      (toolsets: GenericToolset[]) => {
        setLocalSelectedToolsets(toolsets);
        updateNodeData({ metadata: { selectedToolsets: toolsets } });
      },
      [updateNodeData],
    );

    const setNodeDataByEntity = useSetNodeDataByEntity();
    const setTplConfig = useCallback(
      (config: SkillTemplateConfig) => {
        setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { tplConfig: config } });
      },
      [id],
    );

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    useEffect(() => {
      if (skillSelectedModel && !modelInfo) {
        setModelInfo(skillSelectedModel);
      }
    }, [skillSelectedModel, modelInfo, setModelInfo]);

    const setSelectedSkill = useCallback(
      (newSelectedSkill: Skill | null) => {
        const selectedSkill = newSelectedSkill;

        // Reset form when skill changes
        if (selectedSkill?.configSchema?.items?.length) {
          const defaultConfig = {};
          for (const item of selectedSkill.configSchema.items) {
            if (item.defaultValue !== undefined) {
              defaultConfig[item.key] = {
                value: item.defaultValue,
                label: item.labelDict?.en ?? item.key,
                displayValue: String(item.defaultValue),
              };
            }
          }
          form.setFieldValue('tplConfig', defaultConfig);
        } else {
          form.setFieldValue('tplConfig', undefined);
        }

        setNodeData(id, { metadata: { selectedSkill } });
      },
      [id, form, setNodeData],
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

    const handleSendMessage = useCallback(() => {
      const node = getNode(id);
      const data = node?.data as CanvasNodeData<SkillNodeMeta>;
      const {
        query = '',
        contextItems = [],
        selectedSkill,
        modelInfo,
        runtimeConfig = {},
        tplConfig,
        projectId,
      } = data?.metadata ?? {};
      const { runtimeConfig: contextRuntimeConfig } = useContextPanelStore.getState();
      const finalProjectId = getFinalProjectId(projectId);

      // Check if this is a media generation model
      const isMediaGeneration = modelInfo?.category === 'mediaGeneration';

      if (isMediaGeneration) {
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

      // Original skill execution logic for non-media models
      // If we have extraction result with sessionId, use it directly
      if (extractionResult?.sessionId) {
        const resultId = genActionResultID();
        invokeAction(
          {
            resultId,
            ...data?.metadata,
            tplConfig,
            runtimeConfig: {
              ...contextRuntimeConfig,
              ...runtimeConfig,
            },
            projectId: finalProjectId,
            selectedToolsets,
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
              title: query,
              entityId: resultId,
              metadata: {
                ...data?.metadata,
                status: 'executing',
                contextItems,
                tplConfig,
                selectedToolsets,
                selectedSkill,
                modelInfo,
                runtimeConfig: {
                  ...contextRuntimeConfig,
                  ...runtimeConfig,
                },
                structuredData: {
                  query,
                },
                projectId: finalProjectId,
              },
            },
            position: node.position,
          },
          convertContextItemsToNodeFilters(contextItems),
        );
        deleteElements({ nodes: [node] });
        return;
      }

      // If no sessionId, extract variables first then send
      const extractAndSend = async () => {
        const prompt = query || localQuery;
        if (!canvasId || !prompt) {
          return;
        }

        const payload: ExtractVariablesRequest = {
          prompt,
          canvasId,
          mode: 'direct', // Use direct mode to apply variables immediately
        };

        try {
          setIsExtracting(true);
          const result = await extractVariablesMutation.mutateAsync({ body: payload });
          const extractionData = result?.data;

          // Update local state and editor content using processed prompt when available
          const nextPrompt = extractionData?.processedPrompt ?? prompt;
          setExtractionResult(extractionData ?? null);
          setQuery(nextPrompt);
          setLocalQuery(nextPrompt);
          updateNodeData({
            title: nextPrompt,
            metadata: {
              ...data?.metadata,
              query: nextPrompt,
            },
          });
          await refetchWorkflowVariables();

          // Now send (with or without sessionId)
          const resultId = genActionResultID();
          invokeAction(
            {
              resultId,
              ...data?.metadata,
              tplConfig,
              runtimeConfig: {
                ...contextRuntimeConfig,
                ...runtimeConfig,
              },
              projectId: finalProjectId,
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
                title: nextPrompt,
                entityId: resultId,
                metadata: {
                  ...data?.metadata,
                  status: 'executing',
                  contextItems,
                  tplConfig,
                  selectedSkill,
                  modelInfo,
                  runtimeConfig: {
                    ...contextRuntimeConfig,
                    ...runtimeConfig,
                  },
                  structuredData: {
                    query: nextPrompt,
                  },
                  projectId: finalProjectId,
                },
              },
              position: node.position,
            },
            convertContextItemsToNodeFilters(contextItems),
          );
          deleteElements({ nodes: [node] });
        } catch (error) {
          console.error('Failed to extract variables:', error);
        } finally {
          setIsExtracting(false);
        }
      };

      extractAndSend();
    }, [
      id,
      getNode,
      deleteElements,
      invokeAction,
      canvasId,
      addNode,
      form,
      extractionResult,
      localQuery,
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
          const result = await extractVariablesMutation.mutateAsync({ body: payload });
          const extractionData = result?.data;

          if (extractionData) {
            setExtractionResult(extractionData);
            // Update the query with processed prompt
            setQuery(extractionData.processedPrompt);
            setLocalQuery(extractionData.processedPrompt);
            updateNodeData({
              title: extractionData.processedPrompt,
              metadata: {
                ...data?.metadata,
                query: extractionData.processedPrompt,
              },
            });
          }
          // Refresh workflow variables so RichChatInput can render latest variables
          await refetchWorkflowVariables();
        } catch {
          // No-op: UI toasts can be added by caller if needed
        } finally {
          setIsExtracting(false);
        }
      };
      const handleNodeDelete = () => handleDelete();

      nodeActionEmitter.on(createNodeEventName(id, 'run'), handleNodeRun);
      nodeActionEmitter.on(createNodeEventName(id, 'extractVariables'), handleExtractVariables);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'run'), handleNodeRun);
        nodeActionEmitter.off(createNodeEventName(id, 'extractVariables'), handleExtractVariables);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
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
          <ChatPanel
            mode="node"
            readonly={readonly}
            query={localQuery}
            setQuery={setQuery}
            selectedSkill={skill}
            setSelectedSkill={setSelectedSkill}
            contextItems={contextItems}
            setContextItems={setContextItems}
            modelInfo={modelInfo}
            setModelInfo={setModelInfo}
            runtimeConfig={runtimeConfig || {}}
            setRuntimeConfig={setRuntimeConfig}
            tplConfig={tplConfig}
            setTplConfig={setTplConfig}
            handleSendMessage={handleSendMessage}
            handleAbortAction={abortAction}
            projectId={projectId}
            handleProjectChange={(projectId) => {
              handleProjectChange(projectId);
              updateNodeData({ metadata: { projectId } });
            }}
            workflowVariables={variables
              .filter((v): v is WorkflowVariable => {
                // Guard to narrow union to WorkflowVariable only
                const src = (v as any)?.source;
                return (src === 'startNode' || src === 'resourceLibrary') && 'value' in (v as any);
              })
              .map((v) => ({
                variableId: v.variableId,
                name: v.name,
                value: v.value,
                description: v.description,
                source: v.source,
                variableType: v.variableType,
              }))}
            extendedWorkflowVariables={variables.filter(
              (v) => v.source === 'stepRecord' || v.source === 'resultRecord',
            )}
            enableRichInput={true}
            selectedToolsets={selectedToolsets}
            onSelectedToolsetsChange={setSelectedToolsets}
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
