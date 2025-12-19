import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNode, CanvasNodeData, ResourceNodeMeta } from '@refly/canvas-common';
import { ResourceNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
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
import { genSkillID } from '@refly/utils/id';
import { NodeHeader } from './shared/node-header';
import { ContentPreview } from './shared/content-preview';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { message, Result } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';

const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto', maxHeight: 214 };

const NodeContent = memo(
  ({ data }: { data: CanvasNodeData<ResourceNodeMeta>; isPreview: boolean }) => {
    const { t } = useTranslation();
    const { indexStatus } = data?.metadata ?? {};

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
      />
    );
  },
);

export const ResourceNode = memo(
  ({ id, data, isPreview, selected, hideHandles, onNodeClick }: ResourceNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [shouldPoll, setShouldPoll] = useState(false);
    const { edges } = useCanvasData();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { getNode } = useReactFlow();
    const updateNodeTitle = useUpdateNodeTitle();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { setNodeStyle } = useNodeData();
    const { resourceType, indexStatus } = data?.metadata ?? {};

    const { i18n, t } = useTranslation();
    const language = i18n.languages?.[0];

    const node = useMemo(() => getNode(id), [id, getNode]);

    const { readonly } = useCanvasContext();
    const { refetchUsage } = useSubscriptionUsage();

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

    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const { connectTo, position } = getConnectionInfo(
          { entityId: data.entityId, type: 'resource' },
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
                    type: 'resource',
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

    const handleCreateDocument = useCallback(
      async (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        try {
          const { data: remoteResult } = await getClient().getResourceDetail({
            query: { resourceId: data.entityId },
          });
          const remoteData = remoteResult?.data;

          if (!remoteData?.content) {
            message.warning(t('knowledgeBase.context.noContent'));
            return;
          }

          const { connectTo, position } = getConnectionInfo(
            { entityId: data.entityId, type: 'resource' },
            event?.dragCreateInfo,
          );

          await debouncedCreateDocument(remoteData.title ?? '', remoteData.content, {
            sourceNodeId: connectTo.find((c) => c.handleType === 'source')?.entityId,
            targetNodeId: connectTo.find((c) => c.handleType === 'target')?.entityId,
            addToCanvas: true,
            sourceType: 'resource',
            position,
          });
        } catch (error) {
          console.error(error);
          message.error(t('knowledgeBase.context.noContent'));
        } finally {
          nodeActionEmitter.emit(createNodeEventName(id, 'createDocument.completed'));
        }
      },
      [data.title, data.entityId, remoteResult?.content, debouncedCreateDocument, t, id],
    );

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

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeDeleteFile = () => handleDeleteFile();
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);
      const handleNodeCreateDocument = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleCreateDocument(event);

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
      <div
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        onClick={onNodeClick}
      >
        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="resource"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        {/* Handles */}
        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              id={`${id}-target`}
              nodeId={id}
              type="target"
              position={Position.Left}
              isConnected={isTargetConnected}
              isNodeHovered={isHovered}
              nodeType="resource"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="resource"
            />
          </>
        )}

        <div
          style={NODE_SIDE_CONFIG}
          className={`h-full flex flex-col relative p-4 box-border z-1
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
        >
          <NodeHeader
            title={data?.title}
            fixedTitle={t('canvas.nodeTypes.resource')}
            type="resource"
            resourceType={resourceType}
            resourceMeta={data?.metadata?.resourceMeta}
            canEdit={!readonly}
            updateTitle={updateTitle}
          />

          <div className="relative flex-grow min-h-0 overflow-y-auto pr-2 -mr-2">
            <NodeContent data={data} isPreview={isPreview} />
          </div>
          {/* Timestamp container */}
          <div className="flex justify-end items-center text-[10px] text-gray-400 mt-1">
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
