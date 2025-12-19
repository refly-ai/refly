import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useReactFlow, Position } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { getNodeCommonStyles } from './shared/styles';
import { CustomHandle } from './shared/custom-handle';
import { NodeHeader } from './shared/node-header';
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
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { NodeProps } from '@xyflow/react';
import { CanvasNodeData } from '@refly/canvas-common';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { ModelInfo } from '@refly/openapi-schema';
import { HiExclamationTriangle } from 'react-icons/hi2';
import { useNodeExecutionStatus } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { NodeExecutionStatus } from './shared/node-execution-status';

// Define VideoNodeMeta interface
interface VideoNodeMeta {
  videoUrl?: string;
  storageKey?: string;
  showBorder?: boolean;
  showTitle?: boolean;
  style?: Record<string, any>;
  resultId?: string;
  contextItems?: IContextItem[];
  modelInfo?: ModelInfo;
  parentResultId?: string;
}

interface VideoNodeProps extends NodeProps {
  data: CanvasNodeData<VideoNodeMeta>;
  isPreview?: boolean;
  hideHandles?: boolean;
  onNodeClick?: () => void;
}

// Fixed dimensions for video node
const NODE_SIDE_CONFIG = { width: 420, height: 'auto' };

export const VideoNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: VideoNodeProps) => {
    const { metadata } = data ?? {};
    const videoUrl = metadata?.videoUrl ?? '';
    const [isHovered, setIsHovered] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { addNode } = useAddNode();
    const { addToContext } = useAddToContext();
    const { deleteNode } = useDeleteNode();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { readonly, canvasId } = useCanvasContext();
    const { previewNode } = useNodePreviewControl({ canvasId });

    // Get node execution status
    const { status: executionStatus } = useNodeExecutionStatus({
      canvasId: canvasId || '',
      nodeId: id,
    });

    // Check if node has any connections
    const { getEdges } = useReactFlow();
    const edges = useMemo(() => getEdges(), [getEdges]);
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

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

    const handleVideoClick = useCallback(() => {
      // Create a node object for preview
      const nodeForPreview = {
        id,
        type: 'video' as const,
        data: data as any,
        position: { x: 0, y: 0 },
      };
      previewNode(nodeForPreview);
    }, [previewNode, id, data]);

    const handleVideoError = useCallback((e: any) => {
      // Mark error to show friendly fallback UI
      console.error('Video failed to load:', e?.message ?? e);
      setVideoError(true);
    }, []);

    const handleRetry = useCallback(() => {
      // Retry by resetting error and forcing a reload on the video element
      setVideoError(false);
      const videoEl = videoRef?.current;
      if (videoEl) {
        // load() will attempt to reload the current source without changing it
        videoEl.load();
      }
    }, []);

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

    if (!data || !videoUrl) {
      return null;
    }

    return (
      <div
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        className="rounded-2xl relative"
        style={NODE_SIDE_CONFIG}
        onClick={onNodeClick}
      >
        <div className="absolute -top-8 left-3 right-0 z-10 flex items-center h-8 gap-2 w-[70%]">
          <div
            className={cn(
              'flex-1 min-w-0 rounded-t-lg px-1 py-1 transition-opacity duration-200 bg-transparent',
              {
                'opacity-100': isHovered,
                'opacity-0': !isHovered,
              },
            )}
          >
            <NodeHeader
              title={data.title}
              type="video"
              canEdit={!readonly}
              updateTitle={onTitleChange}
            />
          </div>
        </div>

        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="video"
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
              nodeType="video"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="video"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        <div
          className={`h-full flex items-center justify-center relative z-1 box-border ${getNodeCommonStyles({ selected, isHovered })}`}
          style={{ cursor: isPreview || readonly ? 'default' : 'pointer' }}
          onClick={handleVideoClick}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />
          {videoError ? (
            <div className="flex flex-col items-center justify-center gap-2 text-red-500 p-4 w-full h-full bg-black/60 rounded-2xl">
              <HiExclamationTriangle className="w-8 h-8" />
              <p className="text-sm text-center">Video failed to load</p>
              <p className="text-xs text-gray-400 text-center">
                Please check your network connection
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry();
                }}
                className="mt-1 px-3 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain bg-black rounded-2xl"
              preload="metadata"
              onError={handleVideoError}
              onLoadStart={() => setVideoError(false)}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data?.title === nextProps.data?.title &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata)
    );
  },
);

VideoNode.displayName = 'VideoNode';
