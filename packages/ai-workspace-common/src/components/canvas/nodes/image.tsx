import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useReactFlow, Position } from '@xyflow/react';
import { CanvasNode, ImageNodeProps } from './shared/types';
import { ActionButtons } from './shared/action-buttons';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import {
  useNodeSize,
  MAX_HEIGHT_CLASS,
} from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { getNodeCommonStyles } from './index';
import { CustomHandle } from './shared/custom-handle';
import classNames from 'classnames';
import { NodeHeader } from './shared/node-header';
import { IconImage } from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly-packages/utils/id';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import Moveable from 'react-moveable';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

export const ImageNode = memo(
  ({ id, data, isPreview, selected, hideActions, hideHandles, onNodeClick }: ImageNodeProps) => {
    const { metadata } = data ?? {};
    const imageUrl = metadata?.imageUrl;
    const [isHovered, setIsHovered] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const targetRef = useRef<HTMLDivElement>(null);
    const { getNode } = useReactFlow();
    const { addNode } = useAddNode();
    const { addToContext } = useAddToContext();
    const { deleteNode } = useDeleteNode();
    const setNodeDataByEntity = useSetNodeDataByEntity();

    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));

    const { draggingNodeId } = useEditorPerformance();
    const isOperating = operatingNodeId === id;
    const isDragging = draggingNodeId === id;
    const node = useMemo(() => getNode(id), [id, getNode]);
    const { readonly } = useCanvasContext();

    const { containerStyle, handleResize } = useNodeSize({
      id,
      node,
      readonly,
      isOperating,
      minWidth: 100,
      maxWidth: 800,
      minHeight: 80,
      defaultWidth: 288,
      defaultHeight: 'auto',
    });

    // Ensure containerStyle has valid height value
    const safeContainerStyle = useMemo(() => {
      const style = { ...containerStyle };
      // If height is NaN, set it to 'auto'
      if (typeof style.height === 'number' && Number.isNaN(style.height)) {
        style.height = 'auto';
      }
      return style;
    }, [containerStyle]);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'image',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'image',
        data,
        position: { x: 0, y: 0 },
      } as unknown as CanvasNode);
    }, [id, data, deleteNode]);

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
                  type: 'image',
                  title: data.title,
                  entityId: data.entityId,
                  metadata: data.metadata,
                },
              ] as IContextItem[],
            },
          },
        },
        [{ type: 'image', entityId: data.entityId }],
        false,
        true,
      );
    }, [data, addNode]);

    const handlePreview = useCallback(() => {
      setIsPreviewModalVisible(true);
    }, []);

    const onTitleChange = (newTitle: string) => {
      setNodeDataByEntity(
        {
          entityId: data.entityId,
          type: 'image',
        },
        {
          title: newTitle,
        },
      );
    };

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeAskAI = () => handleAskAI();
      const handleNodePreview = () => handlePreview();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'preview'), handleNodePreview);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'preview'), handleNodePreview);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleAskAI, handlePreview]);

    const moveableRef = useRef<Moveable>(null);

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    useEffect(() => {
      setTimeout(() => {
        if (!targetRef.current || readonly) return;
        const { offsetWidth, offsetHeight } = targetRef.current;
        resizeMoveable(offsetWidth, offsetHeight);
      }, 1);
    }, [resizeMoveable, targetRef.current?.offsetHeight]);

    if (!data || !imageUrl) {
      return null;
    }

    return (
      <div className={isOperating && isHovered ? 'nowheel' : ''}>
        <div
          ref={targetRef}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          style={isPreview ? { width: 288, height: 200 } : safeContainerStyle}
          onClick={onNodeClick}
          className={classNames({
            'nodrag nopan select-text': isOperating,
          })}
        >
          {!isPreview && !hideActions && !isDragging && !readonly && (
            <ActionButtons type="image" nodeId={id} isNodeHovered={selected && isHovered} />
          )}

          <div
            className={`
                w-full
                h-full
                ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
              `}
          >
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  id={`${id}-target`}
                  type="target"
                  position={Position.Left}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="image"
                />
                <CustomHandle
                  id={`${id}-source`}
                  type="source"
                  position={Position.Right}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="image"
                />
              </>
            )}

            <div className={cn('flex flex-col h-full relative p-3 box-border', MAX_HEIGHT_CLASS)}>
              <NodeHeader
                title={data.title}
                Icon={IconImage}
                iconBgColor="#02b0c7"
                canEdit={!readonly}
                updateTitle={onTitleChange}
              />

              <div className="w-full rounded-lg overflow-y-auto">
                <img
                  onClick={readonly ? handlePreview : undefined}
                  src={imageUrl}
                  alt={data.title || 'Image'}
                  className="w-full h-auto object-contain"
                />

                {/* only for preview image */}
                {isPreviewModalVisible && !isPreview && (
                  <ImagePreview
                    isPreviewModalVisible={isPreviewModalVisible}
                    setIsPreviewModalVisible={setIsPreviewModalVisible}
                    imageUrl={imageUrl}
                    imageTitle={data?.title}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {!isPreview && selected && !readonly && (
          <NodeResizerComponent
            moveableRef={moveableRef}
            targetRef={targetRef}
            isSelected={selected}
            isHovered={isHovered}
            isPreview={isPreview}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
);

ImageNode.displayName = 'ImageNode';
