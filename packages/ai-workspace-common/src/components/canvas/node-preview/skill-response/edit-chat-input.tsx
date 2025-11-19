import { useTranslation } from 'react-i18next';
import { useMemo, memo, useCallback, useEffect, useRef, forwardRef } from 'react';
import {
  ChatComposer,
  ChatComposerRef,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { CustomAction } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { convertContextItemsToEdges } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';
import { processQueryWithMentions } from '@refly/utils';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useActionResultStoreShallow, useActiveNode } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Undo } from 'refly-icons';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { type MentionPosition } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input/mention-extension';
import { useAgentNodeManagement } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-node-management';

interface EditChatInputProps {
  enabled: boolean;
  resultId: string;
  nodeId: string;
  version?: number;
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
  mentionPosition?: MentionPosition;
}

const EditChatInputComponent = forwardRef<ChatComposerRef, EditChatInputProps>((props, ref) => {
  const { enabled, resultId, nodeId, version, setEditMode, mentionPosition } = props;

  const { getEdges, getNodes, deleteElements, addEdges } = useReactFlow();

  const editAreaRef = useRef<HTMLDivElement | null>(null);

  const { t } = useTranslation();

  const { getFinalProjectId } = useAskProject();

  // Get action result from store to access original input.query
  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));
  const { addNode } = useAddNode();

  const {
    query,
    modelInfo,
    contextItems,
    selectedToolsets,
    upstreamResultIds,
    setQuery,
    setContextItems,
    setModelInfo,
  } = useAgentNodeManagement(nodeId);

  console.log('query', query);

  // Function to get original query from action result
  const getOriginalQuery = useCallback(async (): Promise<string> => {
    // First try to get from store
    const actionResult = resultMap[resultId];
    if (actionResult?.input?.originalQuery) {
      return actionResult.input.originalQuery;
    }

    // Fallback to API call if not in store
    try {
      const { data, error } = await getClient().getActionResult({
        query: { resultId },
      });

      if (!error && data?.success && data?.data?.input?.originalQuery) {
        return data.data.input.originalQuery;
      }
    } catch (error) {
      console.error('Failed to fetch action result:', error);
    }

    // Final fallback to current query prop
    return query;
  }, [resultMap, resultId, query]);

  const { canvasId } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'edit-chat-input' });

  const { activeNode, setActiveNode } = useActiveNode(canvasId);

  // Close edit mode on any outside interaction when editMode is enabled
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleOutsideInteraction = (event: Event) => {
      const targetNode = (event?.target as Node) ?? null;
      const targetEl = (targetNode as Element) ?? null;
      const withinEditArea = editAreaRef.current?.contains(targetNode ?? (null as unknown as Node));

      // Ignore interactions inside model selector dropdown or tool selector popover
      const inModelSelectorOverlay = !!targetEl?.closest?.('.model-selector-overlay');
      const inToolSelectorPopover = !!targetEl?.closest?.('.tool-selector-popover');
      const inContextSelectorPopover = !!targetEl?.closest?.('.context-select-popover');
      const inMentionList = !!targetEl?.closest?.('.mention-list-popover');
      const inContextPreviewPopover = !!targetEl?.closest?.('.context-preview-popover');

      if (
        !withinEditArea &&
        !inModelSelectorOverlay &&
        !inToolSelectorPopover &&
        !inContextSelectorPopover &&
        !inMentionList &&
        !inContextPreviewPopover
      ) {
        setEditMode(false);
      }
    };

    // Use capture phase to ensure we get the event even if propagation is stopped in children
    const options: AddEventListenerOptions | boolean = true;
    document.addEventListener('pointerdown', handleOutsideInteraction, options);
    document.addEventListener('keydown', handleOutsideInteraction, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, options);
      document.removeEventListener('keydown', handleOutsideInteraction, true);
    };
  }, [enabled, setEditMode]);

  const handleSendMessage = useCallback(() => {
    const finalProjectId = getFinalProjectId();

    // Synchronize edges with latest context items
    const nodes = getNodes();
    let currentNode = nodes.find((node) => node.data?.entityId === resultId);

    // Check if this is a media generation model
    const isMediaGeneration = modelInfo?.category === 'mediaGeneration';

    // If not found by entityId and is media generation, try to find by metadata.resultId
    if (!currentNode && isMediaGeneration) {
      currentNode = nodes.find((node) => (node.data?.metadata as any)?.resultId === resultId);
    }

    if (!currentNode) {
      return;
    }

    if (isMediaGeneration) {
      // Handle media generation using existing media generation flow
      // Parse capabilities from modelInfo
      const capabilities = modelInfo?.capabilities as any;
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
        nodeId: currentNode.id,
        contextItems,
      });

      setEditMode(false);
      return;
    }

    const edges = getEdges();
    const { edgesToAdd, edgesToDelete } = convertContextItemsToEdges(
      resultId,
      contextItems,
      nodes,
      edges,
    );
    addEdges(edgesToAdd);
    deleteElements({ edges: edgesToDelete });

    // Process query with workflow variables
    const variables = workflowVariables;
    const { llmInputQuery } = processQueryWithMentions(query, {
      replaceVars: true,
      variables,
    });

    invokeAction(
      {
        resultId,
        version: (version ?? 0) + 1,
        query: llmInputQuery,
        contextItems,
        modelInfo,
        projectId: finalProjectId,
        selectedToolsets,
        upstreamResultIds,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );

    if (activeNode?.id === currentNode.id) {
      setActiveNode({
        ...activeNode,
        data: {
          ...activeNode.data,
          metadata: {
            ...activeNode.data?.metadata,
            query,
            selectedToolsets,
            contextItems,
          },
        },
      });
    }

    setEditMode(false);
  }, [
    resultId,
    query,
    modelInfo,
    contextItems,
    version,
    canvasId,
    upstreamResultIds,
    getNodes,
    getEdges,
    addEdges,
    deleteElements,
    invokeAction,
    setEditMode,
    getFinalProjectId,
    selectedToolsets,
    addNode,
    activeNode,
    setActiveNode,
  ]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: <Undo className="flex items-center w-5 h-5" />,
        title: t('copilot.chatActions.discard'),
        onClick: async () => {
          setEditMode(false);

          // Get original query from action result
          const originalQuery = await getOriginalQuery();
          setQuery(originalQuery);

          setContextItems(contextItems);
          setModelInfo(modelInfo);
        },
      },
    ],
    [
      t,
      setEditMode,
      contextItems,
      modelInfo,
      getOriginalQuery,
      setQuery,
      setContextItems,
      setModelInfo,
    ],
  );

  // Fetch workflow variables for mentions (startNode/resourceLibrary)
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="h-full overflow-hidden"
      onClick={(e) => {
        e.stopPropagation();
      }}
      ref={editAreaRef}
    >
      <ChatComposer
        ref={ref}
        nodeId={nodeId}
        handleSendMessage={handleSendMessage}
        mentionPosition={mentionPosition}
        resultId={resultId}
        enableRichInput={true}
        customActions={customActions}
        showActions={false}
        className="overflow-hidden"
      />
    </div>
  );
});

export const EditChatInput = memo(EditChatInputComponent);
