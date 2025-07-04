import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useReactFlow, Position } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import {
  useNodeSize,
  MAX_HEIGHT_CLASS,
} from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { NodeResizer as NodeResizerComponent } from '../shared/node-resizer';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { getNodeCommonStyles } from '../index';
import { CustomHandle } from '../shared/custom-handle';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { useTranslation } from 'react-i18next';
import {
  IconImage,
  IconLoading,
  IconError,
  IconRerun,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { HiOutlineFilm, HiOutlineSpeakerWave } from 'react-icons/hi2';
import { genImageID, genVideoID, genAudioID } from '@refly/utils/id';
import { Button, Spin, Progress, message } from 'antd';
import { cn } from '@refly/utils/cn';
import { NodeProps } from '@xyflow/react';
import { CanvasNodeFilter } from '@refly/canvas-common';
import classNames from 'classnames';
import Moveable from 'react-moveable';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { CanvasNodeType } from '@refly/openapi-schema';

export type MediaType = 'image' | 'video' | 'audio';

interface MediaSkillResponseNodeMeta extends ResponseNodeMeta {
  mediaType?: MediaType;
  prompt?: string;
  model?: string;
  resultId?: string;
}

interface MediaSkillResponseNodeProps extends NodeProps {
  data: CanvasNodeData<MediaSkillResponseNodeMeta>;
  isPreview?: boolean;
  hideHandles?: boolean;
  onNodeClick?: () => void;
}

const MediaSkillResponseNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: MediaSkillResponseNodeProps) => {
    const { t } = useTranslation();
    const { metadata } = data ?? {};
    const { mediaType = 'image', prompt = '', model = '', resultId = '', status } = metadata ?? {};

    const [isHovered, setIsHovered] = useState(false);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const targetRef = useRef<HTMLDivElement>(null);
    const { getNode, getEdges, getNodes } = useReactFlow();

    useSelectedNodeZIndex(id, selected);

    const { addNode } = useAddNode();
    const { deleteNode } = useDeleteNode();
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
      maxWidth: 500,
      minHeight: 120,
      defaultWidth: 320,
      defaultHeight: 180,
    });

    // Polling logic
    const { result, isPolling } = useActionResultStoreShallow((state) => ({
      result: state.resultMap[resultId],
      isPolling: !!state.pollingStateMap[resultId]?.isPolling,
    }));

    const { startPolling, stopPolling, resetFailedState } = useActionPolling();

    // Start polling when component mounts or when status changes to waiting
    useEffect(() => {
      if (resultId && (status === 'waiting' || status === 'executing')) {
        startPolling(resultId, 0);
      }

      return () => {
        if (resultId) {
          stopPolling(resultId);
        }
      };
    }, [resultId, status, startPolling, stopPolling]);

    // Handle polling results
    useEffect(() => {
      if (result && resultId) {
        if (result.status === 'finish' && result.outputUrl) {
          // Create appropriate media node
          handleCreateMediaNode(result.outputUrl);
        } else if (result.status === 'failed') {
          // Update node to show error state
          console.error('Media generation failed:', result.errors);
        }
      }
    }, [result, resultId]);

    const handleCreateMediaNode = useCallback(
      async (outputUrl: string) => {
        try {
          const entityId =
            mediaType === 'image'
              ? genImageID()
              : mediaType === 'video'
                ? genVideoID()
                : genAudioID();

          const urlKey =
            mediaType === 'image' ? 'imageUrl' : mediaType === 'video' ? 'videoUrl' : 'audioUrl';

          const newNode = {
            type: mediaType,
            data: {
              title: prompt,
              entityId,
              metadata: {
                [urlKey]: outputUrl,
              },
            },
          };

          // Find the mediaSkill node that connects to this mediaSkillResponse node
          const edges = getEdges();
          const nodes = getNodes();

          // Find edges where current node is the target (incoming connections)
          const incomingEdges = edges?.filter((edge) => edge.target === id) ?? [];

          // Find the mediaSkill node that connects to this node
          const mediaSkillNode = nodes?.find((node) => {
            return (
              node.type === 'mediaSkill' && incomingEdges.some((edge) => edge.source === node.id)
            );
          });

          const connectedTo: CanvasNodeFilter[] = [];

          if (mediaSkillNode) {
            // Connect the new media node to the mediaSkill node's source
            connectedTo.push({
              type: 'mediaSkill' as CanvasNodeType,
              entityId: mediaSkillNode.data?.entityId as string,
              handleType: 'source',
            });
          }

          console.log('connectedTo', mediaSkillNode, connectedTo);

          // Add the new media node
          addNode(newNode, connectedTo, false, true);

          // Delete this MediaSkillResponse node
          const currentNode = getNode(id);
          deleteNode(
            {
              id,
              type: 'mediaSkillResponse',
              data,
              position: currentNode?.position || { x: 0, y: 0 },
            },
            {
              showMessage: false,
            },
          );

          message.success(
            t('canvas.nodes.mediaSkillResponse.success', 'Media generated successfully!'),
          );
        } catch (error) {
          console.error('Failed to create media node:', error);
          message.error(
            t('canvas.nodes.mediaSkillResponse.createFailed', 'Failed to create media node'),
          );
        }
      },
      [mediaType, prompt, id, data, getNode, getEdges, getNodes, addNode, deleteNode, t],
    );

    const handleRetry = useCallback(async () => {
      if (!resultId) return;

      try {
        // Reset polling state
        resetFailedState(resultId);

        // Retry the media generation
        const { data: responseData } = await getClient().generateMedia({
          body: {
            prompt,
            mediaType,
            model,
            provider: 'replicate',
          },
        });

        if (responseData?.success && responseData?.resultId) {
          // Update node with new resultId and start polling
          // Note: This would need to be implemented with proper node data update
          startPolling(responseData.resultId, 0);
        }
      } catch (error) {
        console.error('Failed to retry media generation:', error);
        message.error(
          t('canvas.nodes.mediaSkillResponse.retryFailed', 'Failed to retry generation'),
        );
      }
    }, [resultId, prompt, mediaType, model, resetFailedState, startPolling, t]);

    const handleDelete = useCallback(() => {
      if (resultId) {
        stopPolling(resultId);
      }
      deleteNode({
        id,
        type: 'mediaSkillResponse',
        data,
        position: { x: 0, y: 0 },
      } as unknown as CanvasNode);
    }, [id, data, resultId, stopPolling, deleteNode]);

    const safeContainerStyle = useMemo(() => {
      const style = { ...containerStyle };
      if (typeof style.height === 'number' && Number.isNaN(style.height)) {
        style.height = 'auto';
      }
      return style;
    }, [containerStyle]);

    // Event handlers
    useEffect(() => {
      const handleNodeRerun = () => handleRetry();
      const handleNodeDelete = () => handleDelete();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'rerun'), handleNodeRerun);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'rerun'), handleNodeRerun);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
      };
    }, [id, handleRetry, handleDelete]);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const getMediaIcon = useCallback(() => {
      switch (mediaType) {
        case 'image':
          return IconImage;
        case 'video':
          return HiOutlineFilm;
        case 'audio':
          return HiOutlineSpeakerWave;
        default:
          return IconImage;
      }
    }, [mediaType]);

    const getMediaTypeLabel = useCallback(() => {
      switch (mediaType) {
        case 'image':
          return t('canvas.nodes.mediaSkillResponse.image', 'Image');
        case 'video':
          return t('canvas.nodes.mediaSkillResponse.video', 'Video');
        case 'audio':
          return t('canvas.nodes.mediaSkillResponse.audio', 'Audio');
        default:
          return t('canvas.nodes.mediaSkillResponse.media', 'Media');
      }
    }, [mediaType, t]);

    const getProgress = useCallback(() => {
      if (!result) return 10;

      switch (result.status) {
        case 'waiting':
          return 25;
        case 'executing':
          return 60;
        case 'finish':
          return 100;
        case 'failed':
          return 0;
        default:
          return 10;
      }
    }, [result]);

    const moveableRef = useRef<Moveable>(null);

    if (!data) {
      return null;
    }

    const MediaIcon = getMediaIcon();
    const isGenerating =
      !result || result.status === 'waiting' || result.status === 'executing' || isPolling;
    const hasFailed = result?.status === 'failed';

    return (
      <div className={isOperating && isHovered ? 'nowheel' : ''}>
        <div
          ref={targetRef}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          style={isPreview ? { width: 320, height: 180 } : safeContainerStyle}
          onClick={onNodeClick}
          className={classNames({
            'nodrag nopan select-text': isOperating,
          })}
        >
          <div
            className={`w-full h-full ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}`}
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
                  nodeType="mediaSkillResponse"
                />
                <CustomHandle
                  id={`${id}-source`}
                  nodeId={id}
                  type="source"
                  position={Position.Right}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="mediaSkillResponse"
                />
              </>
            )}

            <div className={cn('flex flex-col h-full relative box-border p-4', MAX_HEIGHT_CLASS)}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                  <MediaIcon className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t('canvas.nodes.mediaSkillResponse.generating', 'Generating {{type}}...', {
                      type: getMediaTypeLabel(),
                    })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{prompt}</div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col items-center justify-center">
                {isGenerating && !hasFailed && (
                  <div className="text-center">
                    <Spin
                      indicator={<IconLoading className="animate-spin text-2xl text-blue-500" />}
                      size="large"
                    />
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {t('canvas.nodes.mediaSkillResponse.generating', 'Generating {{type}}...', {
                        type: getMediaTypeLabel(),
                      })}
                    </div>
                    <div className="mt-2 w-full max-w-xs">
                      <Progress
                        percent={getProgress()}
                        size="small"
                        status={hasFailed ? 'exception' : 'active'}
                      />
                    </div>
                  </div>
                )}

                {hasFailed && (
                  <div className="text-center">
                    <IconError className="text-2xl text-red-500 mb-2" />
                    <div className="text-sm text-red-600 dark:text-red-400 mb-3">
                      {t('canvas.nodes.mediaSkillResponse.failed', 'Generation failed')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      {result?.errors?.[0] ||
                        t('canvas.nodes.mediaSkillResponse.unknownError', 'Unknown error occurred')}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconRerun className="text-xs" />}
                        onClick={handleRetry}
                      >
                        {t('common.retry', 'Retry')}
                      </Button>
                      <Button size="small" onClick={handleDelete}>
                        {t('common.delete', 'Delete')}
                      </Button>
                    </div>
                  </div>
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

MediaSkillResponseNode.displayName = 'MediaSkillResponseNode';

export { MediaSkillResponseNode };
