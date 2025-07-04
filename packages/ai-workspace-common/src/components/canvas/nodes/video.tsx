import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useReactFlow, Position } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
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
import { HiOutlineFilm } from 'react-icons/hi2';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { IContextItem } from '@refly/common-types';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import Moveable from 'react-moveable';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { NodeProps } from '@xyflow/react';
import { CanvasNodeData } from '@refly/canvas-common';

// Define VideoNodeMeta interface
interface VideoNodeMeta {
  videoUrl?: string;
  showBorder?: boolean;
  showTitle?: boolean;
  style?: Record<string, any>;
}

interface VideoNodeProps extends NodeProps {
  data: CanvasNodeData<VideoNodeMeta>;
  isPreview?: boolean;
  hideHandles?: boolean;
  onNodeClick?: () => void;
}

export const VideoNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: VideoNodeProps) => {
    const { metadata } = data ?? {};
    const videoUrl = metadata?.videoUrl ?? '';
    const showBorder = metadata?.showBorder ?? false;
    const showTitle = metadata?.showTitle ?? true;
    const [isHovered, setIsHovered] = useState(false);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const targetRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { getNode } = useReactFlow();
    useSelectedNodeZIndex(id, selected);
    const { addNode } = useAddNode();
    const { addToContext } = useAddToContext();
    const { deleteNode } = useDeleteNode();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { readonly } = useCanvasContext();

    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));

    const isOperating = operatingNodeId === id;
    const node = useMemo(() => getNode(id), [id, getNode]);

    const { containerStyle, handleResize } = useNodeSize({
      id,
      node,
      readonly,
      isOperating,
      minWidth: 200,
      maxWidth: 800,
      minHeight: 150,
      defaultWidth: 400,
      defaultHeight: 300,
    });

    // Ensure containerStyle has valid height value
    const safeContainerStyle = useMemo(() => {
      const style = { ...containerStyle };
      // If height is NaN, set it to 'auto'
      if (typeof style.height === 'number' && Number.isNaN(style.height)) {
        style.height = 300;
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
        type: 'video',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'video',
        data,
        position: { x: 0, y: 0 },
      } as unknown as CanvasNode);
    }, [id, data, deleteNode]);

    const handleAskAI = useCallback(
      (dragCreateInfo?: NodeDragCreateInfo) => {
        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'video' },
          dragCreateInfo,
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
                    type: 'video',
                    title: data.title,
                    entityId: data.entityId,
                    metadata: data.metadata,
                  },
                ] as IContextItem[],
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

    const onTitleChange = (newTitle: string) => {
      setNodeDataByEntity(
        {
          entityId: data.entityId,
          type: 'video',
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
      const handleNodeAskAI = (event?: { dragCreateInfo?: NodeDragCreateInfo }) => {
        handleAskAI(event?.dragCreateInfo);
      };

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleAskAI]);

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

    if (!data || !videoUrl) {
      return null;
    }

    return (
      <div className={isOperating && isHovered ? 'nowheel' : ''}>
        <div
          ref={targetRef}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          style={isPreview ? { width: 400, height: 300 } : safeContainerStyle}
          onClick={onNodeClick}
          className={classNames({
            'nodrag nopan select-text': isOperating,
          })}
        >
          <div
            className={`
                w-full
                h-full
                ${showBorder ? getNodeCommonStyles({ selected: !isPreview && selected, isHovered }) : ''}
              `}
          >
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  id={`${id}-target`}
                  nodeId={id}
                  type="target"
                  position={Position.Left}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="video"
                />
                <CustomHandle
                  id={`${id}-source`}
                  nodeId={id}
                  type="source"
                  position={Position.Right}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="video"
                />
              </>
            )}

            <div className={cn('flex flex-col h-full relative box-border', MAX_HEIGHT_CLASS)}>
              {!isPreview && !readonly && (
                <NodeActionButtons
                  nodeId={id}
                  nodeType="video"
                  isNodeHovered={isHovered}
                  isSelected={selected}
                />
              )}

              <div className="relative w-full h-full rounded-lg overflow-hidden">
                {showTitle && (
                  <div
                    className={cn(
                      'absolute top-0 left-0 right-0 z-10 rounded-t-lg px-1 py-1 transition-opacity duration-200 bg-gray-100 dark:bg-black',
                      {
                        'opacity-100': selected || isHovered,
                        'opacity-0': !selected && !isHovered,
                      },
                    )}
                  >
                    <NodeHeader
                      title={data.title}
                      Icon={HiOutlineFilm}
                      iconBgColor="#FF6B6B"
                      canEdit={!readonly}
                      updateTitle={onTitleChange}
                    />
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  style={{ cursor: 'default' }}
                  preload="metadata"
                  onError={(e) => {
                    console.error('Video failed to load:', e);
                  }}
                >
                  <track kind="captions" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        </div>

        {!readonly && !isPreview && (
          <NodeResizerComponent
            moveableRef={moveableRef}
            targetRef={targetRef}
            isSelected={selected}
            isHovered={isHovered}
            isPreview={false}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
);

VideoNode.displayName = 'VideoNode';
