import { Position, useReactFlow } from '@xyflow/react';
import { DocumentNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { getNodeCommonStyles } from './index';
import { useTranslation } from 'react-i18next';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import classNames from 'classnames';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import {
  useNodeSize,
  MAX_HEIGHT_CLASS,
} from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import { NodeHeader } from './shared/node-header';
import { ContentPreview } from './shared/content-preview';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from './shared/node-action-buttons';
import { message } from 'antd';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useAddNodeToSlide } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node-to-slide';

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
    const { i18n, t } = useTranslation();
    const language = i18n.languages?.[0];
    const updateNodeTitle = useUpdateNodeTitle();

    // Setup add to slide functionality
    const { addNodesToSlide } = useAddNodeToSlide({
      canvasId,
      nodes: [{ id, type: 'document', data, position: { x: 0, y: 0 } } as any],
    });

    const targetRef = useRef<HTMLDivElement>(null);
    const { getNode, screenToFlowPosition } = useReactFlow();
    useSelectedNodeZIndex(id, selected);

    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));

    const isOperating = operatingNodeId === id;
    const sizeMode = data?.metadata?.sizeMode || 'adaptive';
    const node = useMemo(() => getNode(id), [id, getNode]);

    const { containerStyle, handleResize } = useNodeSize({
      id,
      node,
      sizeMode,
      readonly,
      isOperating,
      minWidth: 100,
      maxWidth: 800,
      minHeight: 80,
      defaultWidth: 288,
      defaultHeight: 384,
    });

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
      [data, addNode, screenToFlowPosition],
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
      [data, duplicateDocument, id, t],
    );

    const updateTitle = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'document');
    };

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

    // Listen for action completion events
    useEffect(() => {
      const handleActionCompleted = (event: { resultId: string }) => {
        const metadata = data?.metadata as any;
        const { addToSlideshow, relatedResultId } = metadata || {};

        // Check if this node should be added to slideshow
        if (addToSlideshow === true && relatedResultId === event.resultId) {
          addNodesToSlide();
        }
      };

      actionEmitter.on('invokeActionEnd', handleActionCompleted);

      return () => {
        actionEmitter.off('invokeActionEnd', handleActionCompleted);
      };
    }, [data?.metadata, addNodesToSlide]);

    return (
      <div className={classNames({ nowheel: isOperating && isHovered })}>
        <div
          ref={targetRef}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          className={classNames({
            'relative nodrag nopan select-text': isOperating,
          })}
          onClick={onNodeClick}
          style={isPreview ? { width: 288, height: 200 } : containerStyle}
        >
          <div
            className={`
            h-full
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
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

            {!isPreview && !readonly && (
              <NodeActionButtons
                nodeId={id}
                nodeType="document"
                isNodeHovered={isHovered}
                isSelected={selected}
              />
            )}

            <div className={cn('flex flex-col h-full p-3 box-border', MAX_HEIGHT_CLASS)}>
              <NodeHeader
                title={data.title || t('common.untitled')}
                fixedTitle={t('canvas.nodeTypes.document')}
                Icon={HiOutlineDocumentText}
                iconBgColor="#00968F"
                canEdit={!readonly}
                updateTitle={updateTitle}
              />

              <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                <ContentPreview
                  content={data.contentPreview || t('canvas.nodePreview.document.noContentPreview')}
                  sizeMode={isPreview ? 'adaptive' : sizeMode}
                  isOperating={isOperating}
                  className="min-h-8"
                />
              </div>

              <div className="flex justify-end items-center flex-shrink-0 mt-2 text-[10px] text-gray-400 z-20">
                {time(data.createdAt, language as LOCALE)
                  ?.utc()
                  ?.fromNow()}
              </div>
            </div>
          </div>
        </div>

        {!readonly && (
          <NodeResizerComponent
            targetRef={targetRef}
            isSelected={selected}
            isHovered={isHovered}
            isPreview={isPreview}
            sizeMode={sizeMode}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    const prevStyle = prevProps.data?.metadata?.style;
    const nextStyle = nextProps.data?.metadata?.style;
    const styleEqual = JSON.stringify(prevStyle) === JSON.stringify(nextStyle);

    const prevSizeMode = prevProps.data?.metadata?.sizeMode;
    const nextSizeMode = nextProps.data?.metadata?.sizeMode;
    const sizeModeEqual = prevSizeMode === nextSizeMode;

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
      styleEqual &&
      sizeModeEqual
    );
  },
);

DocumentNode.displayName = 'DocumentNode';
