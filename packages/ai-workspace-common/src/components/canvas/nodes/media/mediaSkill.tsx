import { Edge, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, MediaSkillNodeMeta } from '@refly/canvas-common';
import { Node } from '@xyflow/react';
import { Typography } from 'antd';
import { CustomHandle } from '../shared/custom-handle';
import { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';
import { getNodeCommonStyles } from '../index';
import { ModelInfo } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { IContextItem } from '@refly/common-types';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { genUniqueId } from '@refly/utils/id';
import { useNodeSize } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { NodeResizer as NodeResizerComponent } from '../shared/node-resizer';
import classNames from 'classnames';
import Moveable from 'react-moveable';
import { useContextUpdateByEdges } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useDebouncedCallback } from 'use-debounce';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from '../shared/node-action-buttons';
import { useTranslation } from 'react-i18next';
import { IconImage } from '@refly-packages/ai-workspace-common/components/common/icon';
import { MediaChatInput } from './media-input';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';

const { Text } = Typography;

type MediaSkillNode = Node<CanvasNodeData<MediaSkillNodeMeta>, 'mediaSkill'>;

export const MediaSkillNode = memo(
  ({ data, selected, id }: NodeProps<MediaSkillNode>) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    const { edges } = useCanvasData();
    const { setNodeData } = useNodeData();
    const edgeStyles = useEdgeStyles();
    const { getNode, getNodes, getEdges, addEdges, deleteElements } = useReactFlow();
    const { deleteNode } = useDeleteNode();
    useSelectedNodeZIndex(id, selected);

    const moveableRef = useRef<Moveable>(null);
    const targetRef = useRef<HTMLDivElement>(null);
    const { operatingNodeId } = useCanvasStoreShallow((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));
    const isOperating = operatingNodeId === id;
    const node = useMemo(() => getNode(id), [id, getNode]);
    const { readonly } = useCanvasContext();

    const { containerStyle, handleResize, updateSize } = useNodeSize({
      id,
      node,
      readonly,
      isOperating,
      minWidth: 100,
      maxWidth: 800,
      minHeight: 150,
      defaultWidth: 400,
      defaultHeight: 'auto',
    });

    // Add a safe container style with NaN check
    const safeContainerStyle = useMemo(() => {
      const style = { ...containerStyle };
      // Ensure height is never NaN
      if (typeof style.height === 'number' && Number.isNaN(style.height)) {
        style.height = 'auto';
      }
      return style;
    }, [containerStyle]);

    const { metadata = {} } = data;
    const { query, modelInfo, contextItems = [], mediaType = 'image' } = metadata;

    const [localQuery, setLocalQuery] = useState(query);

    // Check if node has any connections
    const isTargetConnected = useMemo(() => edges?.some((edge) => edge.target === id), [edges, id]);
    const isSourceConnected = useMemo(() => edges?.some((edge) => edge.source === id), [edges, id]);

    const updateNodeData = useDebouncedCallback(
      (data: Partial<CanvasNodeData<MediaSkillNodeMeta>>) => {
        setNodeData(id, data);
      },
      50,
    );

    const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
      skillSelectedModel: state.skillSelectedModel,
      setSkillSelectedModel: state.setSkillSelectedModel,
    }));

    const setQuery = useCallback(
      (query: string) => {
        setLocalQuery(query);
        updateNodeData({ title: query, metadata: { query } });
      },
      [updateNodeData],
    );

    const setModelInfo = useCallback(
      (modelInfo: ModelInfo | null) => {
        setNodeData(id, { metadata: { modelInfo } });
        setSkillSelectedModel(modelInfo);
      },
      [id, setNodeData, setSkillSelectedModel],
    );

    const setContextItems = useCallback(
      (items: IContextItem[]) => {
        setNodeData(id, { metadata: { contextItems: items } });

        const nodes = getNodes() as CanvasNode<any>[];
        const entityNodeMap = new Map(nodes.map((node) => [node.data?.entityId, node]));
        const contextNodes = items.map((item) => entityNodeMap.get(item.entityId)).filter(Boolean);

        const edges = getEdges();
        const existingEdges = edges?.filter((edge) => edge.target === id) ?? [];
        const existingSourceIds = new Set(existingEdges.map((edge) => edge.source));
        const newSourceNodes = contextNodes.filter((node) => !existingSourceIds.has(node?.id));

        const newEdges = newSourceNodes.map((node) => ({
          id: `edge-${genUniqueId()}`,
          source: node.id,
          target: id,
          style: edgeStyles.hover,
          type: 'default',
        }));

        const contextNodeIds = new Set(contextNodes.map((node) => node?.id));
        const edgesToRemove = existingEdges.filter((edge) => !contextNodeIds.has(edge.source));

        setTimeout(() => {
          if (newEdges?.length > 0) {
            addEdges(newEdges);
          }

          if (edgesToRemove?.length > 0) {
            deleteElements({ edges: edgesToRemove });
          }
        }, 10);
      },
      [id, setNodeData, addEdges, getNodes, getEdges, deleteElements, edgeStyles.hover],
    );

    const setMediaType = useCallback(
      (mediaType: 'image' | 'video' | 'audio') => {
        setNodeData(id, { metadata: { mediaType } });
      },
      [id, setNodeData],
    );

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    useEffect(() => {
      if (!targetRef.current || readonly) return;

      const { offsetWidth, offsetHeight } = targetRef.current;
      // Ensure we're not passing NaN values to resizeMoveable
      if (
        !Number.isNaN(offsetWidth) &&
        !Number.isNaN(offsetHeight) &&
        offsetWidth > 0 &&
        offsetHeight > 0
      ) {
        resizeMoveable(offsetWidth, offsetHeight);
      }
    }, [resizeMoveable, targetRef.current?.offsetHeight]);

    useEffect(() => {
      if (skillSelectedModel && !modelInfo) {
        setModelInfo(skillSelectedModel);
      }
    }, [skillSelectedModel, modelInfo, setModelInfo]);

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleDelete = useCallback(() => {
      const currentNode = getNode(id);
      deleteNode({
        id,
        type: 'mediaSkill',
        data,
        position: currentNode?.position || { x: 0, y: 0 },
      });
    }, [id, data, getNode, deleteNode]);

    useEffect(() => {
      const handleNodeDelete = () => handleDelete();

      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        cleanupNodeEvents(id);
      };
    }, [id, handleDelete]);

    // Use the new custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByEdges({
      readonly,
      nodeId: id,
      updateNodeData: (data) => updateNodeData(data),
    });

    // listen to edges changes and automatically update contextItems
    useEffect(() => {
      const handleEdgeChange = (data: { newEdges: Edge[] }) => {
        const node = getNode(id) as CanvasNode<MediaSkillNodeMeta>;
        if (!node) return;
        const contextItems = node.data?.metadata?.contextItems ?? [];
        debouncedUpdateContextItems(contextItems, data.newEdges ?? []);
      };

      edgeEventsEmitter.on('edgeChange', handleEdgeChange);

      return () => edgeEventsEmitter.off('edgeChange', handleEdgeChange);
    }, [id, debouncedUpdateContextItems, getNode]);

    return (
      <div className={classNames({ nowheel: isOperating && isHovered })}>
        <div
          ref={targetRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={classNames({
            'relative group nodrag nopan select-text': isOperating,
          })}
          style={safeContainerStyle}
        >
          <div className={`w-full h-full ${getNodeCommonStyles({ selected, isHovered })}`}>
            {
              <>
                <CustomHandle
                  id={`${id}-target`}
                  nodeId={id}
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="mediaSkill"
                />
                <CustomHandle
                  id={`${id}-source`}
                  nodeId={id}
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="mediaSkill"
                />
              </>
            }

            {!readonly && (
              <NodeActionButtons
                nodeId={id}
                nodeType="mediaSkill"
                isNodeHovered={isHovered}
                isSelected={selected}
              />
            )}

            <div className="flex flex-col gap-3 h-full p-3 box-border max-w-[1024px] mx-auto">
              {/* Node Type Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <div className="w-6 h-6 rounded bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                  <IconImage className="w-3 h-3 text-white" />
                </div>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t(`canvas.nodes.mediaSkill.${mediaType}Generate`, 'Media Generator')}
                </Text>
              </div>

              {/* TODO: add context manager */}
              {false && (
                <ContextManager contextItems={contextItems} setContextItems={setContextItems} />
              )}

              <MediaChatInput
                readonly={readonly}
                query={localQuery || ''}
                setQuery={(value) => {
                  setQuery(value);
                  if (updateSize) {
                    setTimeout(() => updateSize({ height: 'auto' }), 0);
                  }
                }}
                mediaType={mediaType}
                setMediaType={setMediaType}
                nodeId={id}
              />
            </div>
          </div>
        </div>

        {!readonly && (
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
  (prevProps, nextProps) => {
    // Optimize re-renders by comparing only necessary props
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.data?.title === nextProps.data?.title &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata)
    );
  },
);

MediaSkillNode.displayName = 'MediaSkillNode';
