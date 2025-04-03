import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNode, CanvasNodeData, ResourceNodeMeta, ResourceNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './shared/action-buttons';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import classNames from 'classnames';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';
import { genSkillID } from '@refly-packages/utils/id';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import {
  useNodeSize,
  MAX_HEIGHT_CLASS,
} from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { NodeHeader } from './shared/node-header';
import { ContentPreview } from './shared/content-preview';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { message, Result } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import cn from 'classnames';

const NodeContent = memo(
  ({
    data,
    isOperating,
    isPreview,
  }: { data: CanvasNodeData<ResourceNodeMeta>; isOperating: boolean; isPreview: boolean }) => {
    const { t } = useTranslation();
    const { indexStatus, sizeMode } = data?.metadata ?? {};

    if (indexStatus === 'wait_parse') {
      return (
        <div className="flex justify-center items-center h-full">
          <Spin spinning={true} />
        </div>
      );
    }

    if (indexStatus === 'parse_failed') {
      return (
        <div className="flex justify-center items-center h-full">
          <Result
            status="warning"
            title={t('resource.parse_failed')}
            subTitle={t('resource.clickToPreview')}
          />
        </div>
      );
    }

    return (
      <ContentPreview
        content={data.contentPreview || t('canvas.nodePreview.resource.noContentPreview')}
        sizeMode={isPreview ? 'adaptive' : sizeMode}
        isOperating={isOperating}
      />
    );
  },
);

export const ResourceNode = memo(
  ({ id, data, isPreview, selected, hideActions, hideHandles, onNodeClick }: ResourceNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [shouldPoll, setShouldPoll] = useState(false);
    const { edges } = useCanvasData();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getNode } = useReactFlow();
    const updateNodeTitle = useUpdateNodeTitle();

    const { resourceType, indexStatus, sizeMode = 'adaptive' } = data?.metadata ?? {};
    const ResourceIcon =
      resourceType === 'weblink' ? HiOutlineSquare3Stack3D : HiOutlineSquare3Stack3D;

    const { i18n, t } = useTranslation();
    const language = i18n.languages?.[0];

    const targetRef = useRef<HTMLDivElement>(null);

    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));

    const { draggingNodeId } = useEditorPerformance();
    const isOperating = operatingNodeId === id;
    const isDragging = draggingNodeId === id;
    const node = useMemo(() => getNode(id), [id, getNode]);

    const { readonly } = useCanvasContext();
    const { refetchUsage } = useSubscriptionUsage();

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

    const { addToContext } = useAddToContext();

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'resource',
        title: data.title,
        entityId: data.entityId,
        metadata: data.metadata,
      });
    }, [data, addToContext]);

    const { deleteNode } = useDeleteNode();

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'resource',
        data,
        position: { x: 0, y: 0 },
      } as CanvasNode);
    }, [id, data, deleteNode]);

    const { deleteResource } = useDeleteResource();

    const handleDeleteFile = useCallback(() => {
      deleteResource(data.entityId);
      handleDelete();
    }, [data.entityId, deleteResource, handleDelete]);

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
                  type: 'resource',
                  title: data.title,
                  entityId: data.entityId,
                  metadata: data.metadata,
                },
              ] as IContextItem[],
            },
          },
        },
        [{ type: 'resource', entityId: data.entityId }],
        false,
        true,
      );
    }, [data, addNode]);

    const { debouncedCreateDocument } = useCreateDocument();
    const { data: result } = useGetResourceDetail(
      {
        query: { resourceId: data?.entityId },
      },
      null,
      {
        enabled: shouldPoll,
        refetchInterval: shouldPoll ? 2000 : false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 60 * 1000, // Data fresh for 1 minute
        gcTime: 5 * 60 * 1000, // Cache for 5 minutes
      },
    );
    const remoteResult = result?.data;

    const handleCreateDocument = useCallback(async () => {
      try {
        const { data: remoteResult } = await getClient().getResourceDetail({
          query: { resourceId: data.entityId },
        });
        const remoteData = remoteResult?.data;

        if (!remoteData?.content) {
          message.warning(t('knowledgeBase.context.noContent'));
          return;
        }

        await debouncedCreateDocument(remoteData.title ?? '', remoteData.content, {
          sourceNodeId: data.entityId,
          addToCanvas: true,
          sourceType: 'resource',
        });
      } catch (error) {
        console.error(error);
        message.error(t('knowledgeBase.context.noContent'));
      } finally {
        nodeActionEmitter.emit(createNodeEventName(id, 'createDocument.completed'));
      }
    }, [data.title, data.entityId, remoteResult?.content, debouncedCreateDocument, t]);

    const updateTitle = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'resource');
    };

    useEffect(() => {
      if (['wait_parse', 'wait_index'].includes(indexStatus) && !shouldPoll) {
        setShouldPoll(true);
      }
      if (!['wait_parse', 'wait_index'].includes(indexStatus) && shouldPoll) {
        setShouldPoll(false);
      }
    }, [indexStatus, shouldPoll]);

    useEffect(() => {
      if (remoteResult) {
        const { contentPreview, indexStatus, indexError, title } = remoteResult;

        setNodeDataByEntity(
          {
            entityId: data.entityId,
            type: 'resource',
          },
          {
            title: data?.title || title,
            contentPreview,
            metadata: {
              indexStatus,
              indexError,
            },
          },
        );

        if (indexStatus === 'finish' && resourceType === 'file') {
          refetchUsage();
        }
      }
    }, [data.entityId, remoteResult, setNodeDataByEntity]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeDeleteFile = () => handleDeleteFile();
      const handleNodeAskAI = () => handleAskAI();
      const handleNodeCreateDocument = () => handleCreateDocument();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'deleteFile'), handleNodeDeleteFile);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'deleteFile'), handleNodeDeleteFile);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleDeleteFile, handleAskAI, handleCreateDocument]);

    return (
      <div className={classNames({ nowheel: isOperating && isHovered })}>
        <div
          ref={targetRef}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
          style={isPreview ? { width: 288, height: 200 } : containerStyle}
          onClick={onNodeClick}
          className={classNames({
            'nodrag nopan select-text': isOperating,
          })}
        >
          {!isPreview && !hideActions && !isDragging && !readonly && (
            <ActionButtons type="resource" nodeId={id} isNodeHovered={selected && isHovered} />
          )}

          <div
            className={`
            h-full
            flex flex-col
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
          >
            <div className={cn('flex flex-col h-full relative p-3 box-border', MAX_HEIGHT_CLASS)}>
              <NodeHeader
                title={data?.title}
                fixedTitle={t('canvas.nodeTypes.resource')}
                Icon={ResourceIcon}
                iconBgColor={NODE_COLORS.resource}
                canEdit={!readonly}
                updateTitle={updateTitle}
              />

              <div className="relative flex-grow min-h-0 overflow-y-auto pr-2 -mr-2">
                <NodeContent data={data} isOperating={isOperating} isPreview={isPreview} />
              </div>
              {/* Timestamp container */}
              <div className="flex justify-end items-center text-[10px] text-gray-400 mt-1 px-1">
                {time(data.createdAt, language as LOCALE)
                  ?.utc()
                  ?.fromNow()}
              </div>
            </div>

            {/* Handles */}
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  id={`${id}-target`}
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="resource"
                />
                <CustomHandle
                  id={`${id}-source`}
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="resource"
                />
              </>
            )}
          </div>
        </div>

        {!isPreview && selected && sizeMode === 'adaptive' && !readonly && (
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
    // Compare style and sizeMode
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
      sizeModeEqual // Add sizeMode comparison
    );
  },
);
