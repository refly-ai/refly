import { Position, useReactFlow } from '@xyflow/react';
import { DocumentNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { getNodeCommonStyles } from './shared/styles';
import { useTranslation } from 'react-i18next';
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
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { NodeHeader } from './shared/node-header';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeActionButtons } from './shared/node-action-buttons';
import { message } from 'antd';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeData,
  useNodeExecutionStatus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { NodeExecutionStatus } from './shared/node-execution-status';
import { editorEmitter } from '@refly/utils/event-emitter/editor';

const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto', maxHeight: 214 };

export const DocumentNode = memo(
  ({
    data = { title: '', entityId: '' },
    selected,
    id,
    isPreview = false,
    hideHandles = false,
    onNodeClick,
  }: DocumentNodeProps) => {
    const { readonly, canvasId } = useCanvasContext();
    const [isHovered, setIsHovered] = useState(false);
    const { edges } = useCanvasData();
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];
    const updateNodeTitle = useUpdateNodeTitle();
    const { setNodeStyle } = useNodeData();

    const { getNode } = useReactFlow();

    const node = useMemo(() => getNode(id), [id, getNode]);

    // Check if node has any connections
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

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

    // Get node execution status
    const { status: executionStatus } = useNodeExecutionStatus({
      canvasId: canvasId || '',
      nodeId: id,
    });

    const { addToContext } = useAddToContext();

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'document',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const { deleteNode } = useDeleteNode();

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'document',
        data,
        position: { x: 0, y: 0 },
      });
    }, [id, data, deleteNode]);

    const { deleteDocument } = useDeleteDocument();

    const handleDeleteFile = useCallback(() => {
      deleteDocument(data.entityId);
      handleDelete();
    }, [data.entityId, deleteDocument, handleDelete]);

    const { addNode } = useAddNode();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'document' },
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
                    type: 'document',
                    title: data.title,
                    entityId: data.entityId,
                    metadata: data.metadata,
                  },
                ],
              },
            },
            position,
          },
          connectTo,
          false,
          true,
        );
      },
      [data, addNode, getConnectionInfo],
    );

    const { duplicateDocument } = useCreateDocument();

    const handleDuplicateDocument = useCallback(
      (event: {
        content?: string;
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const onDuplicationSuccess = () => {
          closeLoading();
        };

        const closeLoading = message.loading(t('canvas.nodeStatus.isCreatingDocument'));
        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'document' },
          event?.dragCreateInfo,
        );

        duplicateDocument(
          data.title,
          event?.content ?? data?.contentPreview ?? '',
          data.metadata,
          { position, connectTo },
          onDuplicationSuccess,
        );
      },
      [data, duplicateDocument, t, getConnectionInfo],
    );

    const updateTitle = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'document');
    };

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    useEffect(() => {
      editorEmitter.emit('syncDocumentTitle', { docId: data.entityId, title: data.title });
    }, [data?.entityId, data?.title]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeDeleteFile = () => handleDeleteFile();
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);
      const handleNodeDuplicateDocument = (event: {
        content?: string;
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleDuplicateDocument(event);

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'deleteFile'), handleNodeDeleteFile);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(
        createNodeEventName(id, 'duplicateDocument'),
        handleNodeDuplicateDocument,
      );

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'deleteFile'), handleNodeDeleteFile);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(
          createNodeEventName(id, 'duplicateDocument'),
          handleNodeDuplicateDocument,
        );

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [
      id,
      handleAddToContext,
      handleDelete,
      handleDeleteFile,
      handleAskAI,
      handleDuplicateDocument,
    ]);

    return (
      <div
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        onClick={onNodeClick}
      >
        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              id={`${id}-target`}
              nodeId={id}
              type="target"
              position={Position.Left}
              isConnected={isTargetConnected}
              isNodeHovered={isHovered}
              nodeType="document"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="document"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="document"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        <div
          style={NODE_SIDE_CONFIG}
          className={`
            h-full
            flex flex-col
            relative p-4 box-border
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />

          <NodeHeader
            title={data.title || t('common.untitled')}
            fixedTitle={t('canvas.nodeTypes.document')}
            type="document"
            canEdit={!readonly}
            updateTitle={updateTitle}
          />
          <div className="flex justify-end items-center flex-shrink-0 mt-1 text-[10px] text-gray-400 z-20">
            {time(data.createdAt, language as LOCALE)
              ?.utc()
              ?.fromNow()}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const prevStyle = prevProps.data?.metadata?.style;
    const nextStyle = nextProps.data?.metadata?.style;
    const styleEqual = JSON.stringify(prevStyle) === JSON.stringify(nextStyle);

    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideActions === nextProps.hideActions &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data?.title === nextProps.data?.title &&
      prevProps.data?.contentPreview === nextProps.data?.contentPreview &&
      prevProps.data?.createdAt === nextProps.data?.createdAt &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata) &&
      styleEqual
    );
  },
);

DocumentNode.displayName = 'DocumentNode';
