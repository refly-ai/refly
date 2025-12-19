import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { CodeArtifactNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { NodeHeader } from './shared/node-header';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { IContextItem } from '@refly/common-types';
import { detectActualTypeFromType } from '@refly/utils';
import { useChatStore } from '@refly/stores';
import { CodeArtifact, CodeArtifactType, Skill } from '@refly/openapi-schema';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import { useGetCodeArtifactDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useUserStoreShallow } from '@refly/stores';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { codeArtifactEmitter } from '@refly-packages/ai-workspace-common/events/codeArtifact';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeData,
  useNodeExecutionStatus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { NodeExecutionStatus } from './shared/node-execution-status';

// Fixed node size configuration
const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = {
  width: NODE_WIDTH,
  height: 'auto',
};

interface NodeContentProps {
  status: 'generating' | 'finish' | 'failed' | 'executing';
  entityId: string;
  shareId?: string;
  legacyData?: CodeArtifact;
}

const NodeContent = memo(
  ({ status, entityId, shareId, legacyData }: NodeContentProps) => {
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { data: remoteData } = useGetCodeArtifactDetail(
      {
        query: {
          artifactId: entityId,
        },
      },
      null,
      { enabled: isLogin && !shareId && status === 'finish' },
    );
    const { data: shareData } = useFetchShareData<CodeArtifact>(shareId);
    const artifactData = useMemo(() => {
      const data = shareData || remoteData?.data || legacyData || null;

      return data ? { ...data, type: legacyData?.type || data.type } : null;
    }, [shareData, remoteData, legacyData]);

    return (
      <div className="h-full w-full pointer-events-none">
        <Renderer
          content={artifactData?.content || ''}
          type={artifactData?.type}
          key={artifactData?.artifactId}
          title={artifactData?.title}
          language={artifactData?.language}
          onRequestFix={() => {}}
          showActions={false}
        />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.entityId === nextProps.entityId &&
    prevProps?.status === nextProps?.status &&
    prevProps.legacyData?.content === nextProps.legacyData?.content &&
    prevProps.legacyData?.type === nextProps.legacyData?.type &&
    prevProps.legacyData?.title === nextProps.legacyData?.title &&
    prevProps.legacyData?.language === nextProps.legacyData?.language,
);

export const CodeArtifactNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: CodeArtifactNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { edges } = useCanvasData();
    const { getNode } = useReactFlow();
    const { addNode } = useAddNode();
    const { t } = useTranslation();
    const updateNodeTitle = useUpdateNodeTitle();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { setNodeStyle } = useNodeData();

    const { i18n } = useTranslation();
    const language = i18n.languages?.[0];

    const node = useMemo(() => getNode(id), [id, getNode]);

    const { canvasId, readonly } = useCanvasContext();

    // Listen for statusUpdate events to update node metadata
    useEffect(() => {
      const handleStatusUpdate = (eventData: {
        artifactId: string;
        status: 'finish' | 'generating';
        type: CodeArtifactType;
      }) => {
        if (eventData.artifactId === data?.entityId) {
          // Update node metadata when status changes
          setNodeDataByEntity(
            { type: 'codeArtifact', entityId: eventData.artifactId },
            {
              metadata: {
                status: eventData?.status,
                activeTab: eventData?.status === 'finish' ? 'preview' : 'code',
                type: detectActualTypeFromType(eventData?.type),
              },
            },
          );
        }
      };

      codeArtifactEmitter.on('statusUpdate', handleStatusUpdate);

      return () => {
        codeArtifactEmitter.off('statusUpdate', handleStatusUpdate);
      };
    }, [data?.entityId, setNodeDataByEntity]);

    // Set fixed node style
    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Check if node has any connections
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const handleMouseEnter = useCallback(() => {
      if (!isHovered) {
        setIsHovered(true);
        onHoverStart();
      }
    }, [isHovered, onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      if (isHovered) {
        setIsHovered(false);
        onHoverEnd();
      }
    }, [isHovered, onHoverEnd]);

    // Get node execution status
    const { status: executionStatus } = useNodeExecutionStatus({
      canvasId: canvasId || '',
      nodeId: id,
    });

    const { addToContext } = useAddToContext();

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'codeArtifact',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const { deleteNode } = useDeleteNode();

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'codeArtifact',
        data,
        position: { x: 0, y: 0 },
      } as CanvasNode);
    }, [id, data, deleteNode]);

    // Legacy code artifact data
    const legacyData = useMemo<CodeArtifact | null>(() => {
      return {
        content: data.contentPreview,
        type: data.metadata?.type,
        artifactId: data.entityId,
        title: data.title,
        language: data.metadata?.language,
      };
    }, [data]);

    const insertToDoc = useInsertToDocument(data.entityId);
    const handleInsertToDoc = useCallback(
      async (content: string) => {
        await insertToDoc('insertBelow', content);
      },
      [insertToDoc],
    );

    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        // Get the current model
        const { skillSelectedModel } = useChatStore.getState();

        // Define a default code fix skill
        const defaultCodeFixSkill: Skill = {
          name: 'codeArtifacts',
          icon: {
            type: 'emoji',
            value: '🔧',
          },
          description: t('codeArtifact.fix.title'),
          configSchema: {
            items: [],
          },
        };

        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'codeArtifact' },
          event?.dragCreateInfo,
        );

        addNode(
          {
            type: 'skill',
            data: {
              title: 'Skill',
              entityId: genSkillID(),
              metadata: {
                contextItems: [
                  {
                    type: 'codeArtifact',
                    title: data.title,
                    entityId: data.entityId,
                    metadata: {
                      ...data.metadata,
                      withHistory: true,
                    },
                  },
                ] as IContextItem[],
                query: '',
                selectedSkill: defaultCodeFixSkill,
                modelInfo: skillSelectedModel,
              },
            },
            position,
          },
          connectTo,
          false,
          true,
        );
      },
      [data, addNode, t, getConnectionInfo],
    );

    const updateTitle = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'codeArtifact');
    };

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeInsertToDoc = (event: { content: string }) =>
        handleInsertToDoc(event.content);
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleInsertToDoc, handleAskAI]);

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl relative"
        style={isPreview ? { width: NODE_WIDTH, height: 214 } : NODE_SIDE_CONFIG}
        data-cy="code-artifact-node"
        onClick={onNodeClick}
      >
        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="codeArtifact"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              id={`${id}-target`}
              nodeId={id}
              type="target"
              position={Position.Left}
              isConnected={isTargetConnected}
              isNodeHovered={isHovered}
              nodeType="codeArtifact"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="codeArtifact"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        <div
          className={`h-full flex flex-col relative z-1 p-4 box-border max-h-[800px] ${getNodeCommonStyles({ selected, isHovered })}`}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />

          <NodeHeader
            title={data?.title}
            fixedTitle={t('canvas.nodeTypes.codeArtifact')}
            canEdit={!readonly}
            type="codeArtifact"
            updateTitle={updateTitle}
          />

          <div className={'relative flex-grow overflow-y-auto pr-2 -mr-2'}>
            <NodeContent
              status={data.metadata?.status}
              entityId={data.entityId}
              shareId={data.metadata?.shareId}
              legacyData={legacyData}
            />
          </div>

          <div className="flex justify-end items-center text-[10px] text-gray-400 mt-1 px-1">
            {time(data.createdAt, language as LOCALE)
              ?.utc()
              ?.fromNow()}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Compare style and sizeMode
    const prevStyle = prevProps.data?.metadata?.style;
    const nextStyle = nextProps.data?.metadata?.style;
    const styleEqual = JSON.stringify(prevStyle) === JSON.stringify(nextStyle);

    // Compare activeTab specifically
    const prevActiveTab = prevProps.data?.metadata?.activeTab;
    const nextActiveTab = nextProps.data?.metadata?.activeTab;
    const activeTabEqual = prevActiveTab === nextActiveTab;
    const prevType = prevProps.data?.metadata?.type;
    const nextType = nextProps.data?.metadata?.type;
    const typeEqual = prevType === nextType;

    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideActions === nextProps.hideActions &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data?.title === nextProps.data?.title &&
      prevProps.data?.contentPreview === nextProps.data?.contentPreview &&
      prevProps.data?.createdAt === nextProps.data?.createdAt &&
      prevProps.data?.metadata?.status === nextProps.data?.metadata?.status &&
      prevProps.data?.metadata?.language === nextProps.data?.metadata?.language &&
      activeTabEqual &&
      typeEqual &&
      styleEqual
    );
  },
);
