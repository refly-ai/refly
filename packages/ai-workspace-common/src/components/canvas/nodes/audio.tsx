import { memo, useState, useCallback, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { getNodeCommonStyles } from './shared/styles';
import { CustomHandle } from './shared/custom-handle';
import { NodeHeader } from './shared/node-header';
import { HiExclamationTriangle } from 'react-icons/hi2';
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
import { useNodeExecutionStatus } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { NodeExecutionStatus } from './shared/node-execution-status';

const NODE_SIDE_CONFIG = {
  width: 350,
  height: 120,
};

// Define AudioNodeMeta interface
interface AudioNodeMeta {
  audioUrl?: string;
  storageKey?: string;
  showBorder?: boolean;
  showTitle?: boolean;
  style?: Record<string, any>;
  resultId?: string;
  contextItems?: IContextItem[];
  modelInfo?: ModelInfo;
  parentResultId?: string;
}

interface AudioNodeProps extends NodeProps {
  data: CanvasNodeData<AudioNodeMeta>;
  isPreview?: boolean;
  hideHandles?: boolean;
  onNodeClick?: () => void;
}

// Fallback audio URLs
const FALLBACK_AUDIO_URLS = [
  'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
  'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
  // Data URL for a simple beep sound as ultimate fallback
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D2v2odCRxDj+D5v2kfCGPX3u3h7BDwGu8k7eVc9dQK7SLsHuAZJMgN5hEGQiECKgUCDmVEJQoGKiJAIQAA',
];

export const AudioNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: AudioNodeProps) => {
    const { metadata } = data ?? {};
    const audioUrl = metadata?.audioUrl ?? '';
    const showTitle = metadata?.showTitle ?? true;
    const [isHovered, setIsHovered] = useState(false);
    const [audioError, setAudioError] = useState(false);
    const [currentAudioUrl, setCurrentAudioUrl] = useState(audioUrl);
    const [fallbackIndex, setFallbackIndex] = useState(0);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
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
        type: 'audio',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'audio',
        data,
        position: { x: 0, y: 0 },
      } as unknown as CanvasNode);
    }, [id, data, deleteNode]);

    const handleAskAI = useCallback(
      (dragCreateInfo?: NodeDragCreateInfo) => {
        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'audio' },
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
                    type: 'audio',
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
          type: 'audio',
        },
        {
          title: newTitle,
        },
      );
    };

    const handleAudioClick = useCallback(() => {
      // Create a node object for preview
      const nodeForPreview = {
        id,
        type: 'audio' as const,
        data: data as any,
        position: { x: 0, y: 0 },
      };
      previewNode(nodeForPreview);
    }, [previewNode, id, data]);

    // Handle audio loading errors with fallback
    const handleAudioError = useCallback(() => {
      console.error('Audio failed to load:', currentAudioUrl);

      // Try next fallback URL
      if (fallbackIndex < FALLBACK_AUDIO_URLS.length) {
        const nextUrl = FALLBACK_AUDIO_URLS[fallbackIndex];
        console.log('Trying fallback audio URL:', nextUrl);
        setCurrentAudioUrl(nextUrl);
        setFallbackIndex((prev) => prev + 1);
        setAudioError(false);
      } else {
        // All fallbacks failed
        setAudioError(true);
      }
    }, [currentAudioUrl, fallbackIndex]);

    // Reset audio URL only when the original audioUrl prop changes
    // Avoid resetting when switching to fallback URLs to prevent infinite retries
    useEffect(() => {
      if (audioUrl) {
        setCurrentAudioUrl(audioUrl);
        setFallbackIndex(0);
        setAudioError(false);
      }
    }, [audioUrl]);

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

    if (!data) {
      return null;
    }

    return (
      <div
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        style={NODE_SIDE_CONFIG}
        onClick={onNodeClick}
        className="relative"
      >
        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="audio"
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
              isConnected={false}
              isNodeHovered={isHovered}
              nodeType="audio"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={false}
              isNodeHovered={isHovered}
              nodeType="audio"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        <div
          className={`
                w-full
                h-full
               rounded-2xl
               relative
               z-1
               p-4
                ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
              `}
          style={{ cursor: isPreview || readonly ? 'default' : 'pointer' }}
          onClick={handleAudioClick}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />
          <div className={cn('flex flex-col h-full relative box-border')}>
            {showTitle && (
              <NodeHeader
                title={data.title}
                type="audio"
                canEdit={!readonly}
                updateTitle={onTitleChange}
              />
            )}

            {/* Audio Player or Error Message */}
            {audioError ? (
              <div className="flex flex-col items-center justify-center gap-2 text-red-500">
                <HiExclamationTriangle className="w-8 h-8" />
                <p className="text-sm text-center">Audio failed to load</p>
                <p className="text-xs text-gray-500 text-center">
                  Please check your network connection
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <audio
                  src={currentAudioUrl}
                  controls
                  className="w-full max-w-sm rounded-md"
                  preload="metadata"
                  onError={handleAudioError}
                  onLoadStart={() => setAudioError(false)}
                  onClick={(e) => {
                    // Prevent audio controls from triggering the parent click
                    e.stopPropagation();
                  }}
                >
                  <track kind="captions" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

AudioNode.displayName = 'AudioNode';
