import { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { Position, NodeProps, useReactFlow } from '@xyflow/react';
import { CustomHandle } from './shared/custom-handle';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { CanvasNode, CommonNodeProps } from './shared/types';
import { GroupActionButtons } from '../group-action-menu/group-action-buttons';
import { GroupName } from '../group-action-menu/group-name';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useUngroupNodes } from '@refly-packages/ai-workspace-common/hooks/canvas/use-batch-nodes-selection/use-ungroup-nodes';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { genSkillID } from '@refly/utils/id';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useNodeCluster } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-cluster';
import Moveable from 'react-moveable';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useThrottledCallback } from 'use-debounce';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-data';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';

interface GroupMetadata {
  label?: string;
  width?: number;
  height?: number;
  isTemporary?: boolean;
  bgColor?: string;
}

export interface GroupData {
  title: string;
  entityId: string;
  metadata?: GroupMetadata;
}

type GroupNodeProps = Omit<NodeProps, 'data'> & {
  data: GroupData;
} & CommonNodeProps;

const getChildNodes = (id: string, nodes: CanvasNode[]) => {
  const childNodes = nodes.filter((node) => {
    const isInGroup = node.parentId === id;
    return isInGroup && !['skill', 'group'].includes(node.type);
  }) as CanvasNode[];

  return childNodes;
};

export const GroupNode = memo(
  ({
    id,
    data,
    selected,
    isPreview = false,
    hideActions = false,
    hideHandles = false,
    onNodeClick,
  }: GroupNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const { ungroupNodes } = useUngroupNodes();
    const { getNode, getNodes, setNodes } = useReactFlow();
    const { deleteNodes, deleteNode } = useDeleteNode();
    const { addContextItems } = useAddToContext();
    const { addNode } = useAddNode();
    const { selectNodeCluster, groupNodeCluster } = useNodeCluster();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const { setNodeStyle } = useNodeData();
    const { onLayoutWithGroup } = useCanvasLayout();
    useSelectedNodeZIndex(id, selected);

    // Memoize node and its measurements
    const node = useMemo(() => getNode(id), [id, getNode]);
    const { draggingNodeId } = useEditorPerformance();
    const isDragging = draggingNodeId === id;

    const initialSize = useMemo(
      () => ({
        width: node?.measured?.width ?? data.metadata?.width ?? 288,
        height: node?.measured?.height ?? data.metadata?.height ?? 384,
      }),
      [node?.measured?.width, node?.measured?.height, data.metadata?.width, data.metadata?.height],
    );

    const [size, setSize] = useState(initialSize);

    const targetRef = useRef<HTMLDivElement>(null);
    const { readonly } = useCanvasContext();

    // Add useEffect to update node data when size changes
    useEffect(() => {
      if (size.width !== initialSize.width || size.height !== initialSize.height) {
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  metadata: {
                    ...((node?.data?.metadata as any) || {}),
                    width: size.width,
                    height: size.height,
                  },
                },
                measured: {
                  width: size.width,
                  height: size.height,
                },
              };
            }
            return node;
          }),
        );
      }
    }, [size, initialSize, id, setNodes]);

    const handleAddToContext = useCallback(() => {
      const childNodes = getNodes().filter((node) => {
        const isInGroup = node.parentId === id;
        return isInGroup;
      });

      if (childNodes.length > 0) {
        const contextItems = childNodes.map(
          (node) =>
            ({
              type: node.type,
              title: node.data.title,
              entityId: node.data.entityId,
              metadata: node.data.metadata,
            }) as IContextItem,
        );

        addContextItems(contextItems);
      }
    }, [id, getNodes, addContextItems]);

    const handleAskAI = useCallback(() => {
      const childNodes = getChildNodes(id, getNodes() as CanvasNode[]);

      if (childNodes.length > 0) {
        const connectTo = childNodes.map((node) => ({
          type: node.type as CanvasNodeType,
          entityId: node.data.entityId as string,
        }));

        addNode(
          {
            type: 'skill',
            data: {
              title: 'Skill',
              entityId: genSkillID(),
              metadata: {
                contextItems: childNodes.map((node) => ({
                  type: node.type,
                  title: node.data?.title,
                  entityId: node.data?.entityId,
                  metadata: {
                    ...node.data?.metadata,
                    ...(node.type === 'skillResponse' ? { withHistory: true } : {}),
                  },
                })),
              },
            },
          },
          connectTo,
          false,
          true,
        );
      }
    }, [id, getNodes, addNode]);

    const handleSelectCluster = useCallback(() => {
      const childNodes = getChildNodes(id, getNodes() as CanvasNode[]);

      if (childNodes.length > 0) {
        selectNodeCluster(childNodes.map((node) => node.id));
      }
    }, [id, getNodes, selectNodeCluster]);

    const handleGroupCluster = useCallback(() => {
      const childNodes = getChildNodes(id, getNodes() as CanvasNode[]);

      if (childNodes.length > 0) {
        groupNodeCluster(childNodes.map((node) => node.id));
      }
    }, [id, getNodes, groupNodeCluster]);

    const handleLayoutCluster = useCallback(() => {
      onLayoutWithGroup(id, data);
    }, [id, data, onLayoutWithGroup]);

    useEffect(() => {
      const handleNodeUngroup = () => {
        ungroupNodes(id);
      };
      const handleNodeAskAI = () => {
        handleAskAI();
      };
      const handleNodeSelectCluster = () => handleSelectCluster();
      const handleNodeGroupCluster = () => handleGroupCluster();
      const handleNodeLayoutCluster = () => handleLayoutCluster();

      nodeActionEmitter.on(createNodeEventName(id, 'ungroup'), handleNodeUngroup);
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'selectCluster'), handleNodeSelectCluster);
      nodeActionEmitter.on(createNodeEventName(id, 'groupCluster'), handleNodeGroupCluster);
      nodeActionEmitter.on(createNodeEventName(id, 'layoutCluster'), handleNodeLayoutCluster);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'ungroup'), handleNodeUngroup);
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'selectCluster'), handleNodeSelectCluster);
        nodeActionEmitter.off(createNodeEventName(id, 'groupCluster'), handleNodeGroupCluster);
        nodeActionEmitter.off(createNodeEventName(id, 'layoutCluster'), handleNodeLayoutCluster);
        cleanupNodeEvents(id);
      };
    }, [
      id,
      ungroupNodes,
      handleAddToContext,
      handleAskAI,
      handleSelectCluster,
      handleGroupCluster,
      handleLayoutCluster,
    ]);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart(selected);
    }, [onHoverStart, selected]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd(selected);
    }, [onHoverEnd, selected]);

    const handleDelete = useCallback(() => {
      const childNodes = getNodes().filter((node) => {
        const isInGroup = node.parentId === id;
        return isInGroup;
      });

      if (childNodes.length > 0) {
        deleteNodes(
          childNodes.map(
            (node) =>
              ({
                id: node.id,
                type: node.type,
                data: node.data,
                position: node.position,
              }) as CanvasNode,
          ),
          { showMessage: false },
        );
      }

      deleteNode({
        id,
        type: 'group',
        data,
        position: { x: 0, y: 0 },
      });
    }, [id, data, getNodes, deleteNodes, deleteNode]);

    const handleUpdateName = useThrottledCallback(
      (name: string) => {
        setNodeDataByEntity(
          {
            entityId: data.entityId,
            type: 'group',
          },
          {
            title: name,
          },
        );
      },
      500,
      {
        leading: true,
        trailing: true,
      },
    );

    const handleChangeBgColor = useCallback((color: string) => {
      console.log('change bg color', color);
      setNodeDataByEntity(
        {
          entityId: data.entityId,
          type: 'group',
        },
        {
          metadata: {
            ...data.metadata,
            bgColor: color,
          },
        },
      );
    }, []);

    useEffect(() => {
      const handleNodeDelete = () => handleDelete();

      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        cleanupNodeEvents(id);
      };
    }, [id, handleDelete]);

    return (
      <div>
        <div
          ref={targetRef}
          className="group-node"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onNodeClick}
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
          }}
        >
          <div
            className={`relative h-full rounded-lg border-2 border-dashed ${
              selected ? 'border-[#00968F]' : 'border-black/10 dark:border-white/10'
            } transition-all duration-200`}
            style={{
              background: 'transparent',
            }}
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
                  nodeType="group"
                />
                <CustomHandle
                  id={`${id}-source`}
                  nodeId={id}
                  type="source"
                  position={Position.Right}
                  isConnected={false}
                  isNodeHovered={isHovered}
                  nodeType="group"
                />
              </>
            )}

            {!isPreview && !hideActions && !isDragging && !readonly && (
              <GroupActionButtons
                nodeId={id}
                isTemporary={data.metadata?.isTemporary}
                isNodeHovered={selected && isHovered}
              />
            )}

            <GroupName
              title={data.title}
              onUpdateName={handleUpdateName}
              selected={selected}
              readonly={readonly}
              bgColor={data.metadata?.bgColor || 'rgba(255, 255, 255, 0)'}
              onChangeBgColor={handleChangeBgColor}
            />

            <div
              className="absolute top-0 left-0 w-full h-full"
              style={{
                backgroundColor: data.metadata?.bgColor || 'transparent',
              }}
            />
          </div>
        </div>

        {!isPreview && selected && !readonly && (
          <Moveable
            target={targetRef}
            resizable={true}
            edge={false}
            throttleResize={1}
            renderDirections={['nw', 'ne', 'sw', 'se']}
            onResizeStart={({ setOrigin, dragStart }) => {
              setOrigin(['%', '%']);
              if (dragStart && dragStart instanceof MouseEvent) {
                dragStart.preventDefault();
              }
            }}
            onResize={({ target, width, height, direction }) => {
              const newWidth = Math.max(100, width);
              const newHeight = Math.max(80, height);

              let newLeft = (target as HTMLElement).offsetLeft;
              let newTop = (target as HTMLElement).offsetTop;

              if (direction[0] === -1) {
                newLeft =
                  (target as HTMLElement).offsetLeft -
                  (newWidth - (target as HTMLElement).offsetWidth);
              }
              if (direction[1] === -1) {
                newTop =
                  (target as HTMLElement).offsetTop -
                  (newHeight - (target as HTMLElement).offsetHeight);
              }

              target.style.width = `${newWidth}px`;
              target.style.height = `${newHeight}px`;
              target.style.left = `${newLeft}px`;
              target.style.top = `${newTop}px`;

              setSize({ width: newWidth, height: newHeight });
              setNodeStyle(id, {
                width: `${newWidth}px`,
                height: `${newHeight}px`,
              });
            }}
            hideDefaultLines={true}
            className={`!pointer-events-auto ${!isHovered ? 'moveable-control-hidden' : 'moveable-control-show'}`}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Add memo comparison function
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideActions === nextProps.hideActions &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data.title === nextProps.data.title &&
      JSON.stringify(prevProps.data.metadata) === JSON.stringify(nextProps.data.metadata)
    );
  },
);

GroupNode.displayName = 'GroupNode';
