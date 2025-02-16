import { Position, useReactFlow } from '@xyflow/react';
import { DocumentNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './shared/action-buttons';
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
import { genSkillID } from '@refly-packages/utils/id';
import { useNodeSize } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import { NodeHeader } from './shared/node-header';
import { ContentPreview } from './shared/content-preview';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';

export const DocumentNode = memo(
  ({
    data = { title: '', entityId: '' },
    selected,
    id,
    isPreview = false,
    hideActions = false,
    hideHandles = false,
    onNodeClick,
  }: DocumentNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { edges } = useCanvasData();
    const { i18n, t } = useTranslation();
    const language = i18n.languages?.[0];

    const targetRef = useRef<HTMLDivElement>(null);
    const { getNode } = useReactFlow();

    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));

    const { draggingNodeId } = useEditorPerformance();
    const isOperating = operatingNodeId === id;
    const isDragging = draggingNodeId === id;
    const sizeMode = data?.metadata?.sizeMode || 'adaptive';
    const node = useMemo(() => getNode(id), [id, getNode]);

    const { containerStyle, handleResize } = useNodeSize({
      id,
      node,
      sizeMode,
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

    const handleAskAI = useCallback(() => {
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
        },
        [{ type: 'document', entityId: data.entityId }],
        false,
        true,
      );
    }, [data, addNode]);

    const { duplicateDocument } = useCreateDocument();

    const handleDuplicateDocument = useCallback(() => {
      duplicateDocument(data.title, data.contentPreview || '', data.entityId, data.metadata);
    }, [data, duplicateDocument]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeDeleteFile = () => handleDeleteFile();
      const handleNodeAskAI = () => handleAskAI();
      const handleNodeDuplicateDocument = () => handleDuplicateDocument();

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
      <div className={classNames({ nowheel: isOperating })}>
        <div
          ref={targetRef}
          className={classNames({
            'relative nodrag nopan select-text': isOperating,
          })}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          onClick={onNodeClick}
          style={isPreview ? { width: 288, height: 200 } : containerStyle}
        >
          {!isPreview && !hideActions && !isDragging && (
            <ActionButtons type="document" nodeId={id} isNodeHovered={isHovered} />
          )}

          <div
            className={`
            relative
            h-full
            p-3
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
          >
            <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="document"
                />
                <CustomHandle
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="document"
                />
              </>
            )}
            <div className="flex flex-col h-full">
              <NodeHeader
                title={data.title || t('common.untitled')}
                Icon={HiOutlineDocumentText}
                iconBgColor="#00968F"
              />

              <div
                className={`flex-grow overflow-y-auto pr-2 -mr-2 ${isOperating ? 'overflow-auto' : 'overflow-hidden'}`}
              >
                <ContentPreview
                  content={data.contentPreview || t('canvas.nodePreview.document.noContentPreview')}
                  sizeMode={sizeMode}
                  isOperating={isOperating}
                  isLoading={data.metadata?.status === 'executing' && !data.contentPreview}
                  maxCompactLength={20}
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

        <NodeResizerComponent
          targetRef={targetRef}
          isSelected={selected}
          isHovered={isHovered}
          isPreview={isPreview}
          sizeMode={sizeMode}
          onResize={handleResize}
        />
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
