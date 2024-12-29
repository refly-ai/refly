import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { genUniqueId } from '@refly-packages/utils/id';
import { useCanvasStore, useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import {
  CanvasNodeData,
  getNodeDefaultMetadata,
  prepareNodeData,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useEdgeStyles } from '../../components/canvas/constants';
import { CanvasNodeFilter } from './use-node-selection';

const deduplicateNodes = (nodes: any[]) => {
  const uniqueNodesMap = new Map();
  nodes.forEach((node) => uniqueNodesMap.set(node.id, node));
  return Array.from(uniqueNodesMap.values());
};

const deduplicateEdges = (edges: any[]) => {
  const uniqueEdgesMap = new Map();
  edges.forEach((edge) => uniqueEdgesMap.set(edge.id, edge));
  return Array.from(uniqueEdgesMap.values());
};

export const useAddNode = (canvasId: string) => {
  const { t } = useTranslation();
  const edgeStyles = useEdgeStyles();
  const { setCenter, getNode } = useReactFlow();

  const { setNodes, setEdges, addPinnedNode } = useCanvasStoreShallow((state) => ({
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    addPinnedNode: state.addPinnedNode,
  }));

  const setNodeCenter = useCallback(
    (nodeId: string) => {
      // Center view on new node after it's rendered
      requestAnimationFrame(() => {
        const renderedNode = getNode(nodeId);
        if (renderedNode) {
          setCenter(renderedNode.position.x, renderedNode.position.y, {
            duration: 300,
            zoom: 1,
          });
        }
      });
    },
    [setCenter],
  );

  const setSelectedNode = useCallback(
    (node: any) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === node?.id,
      }));
      setNodes(canvasId, updatedNodes);
    },
    [canvasId, setNodes],
  );

  const addNode = useCallback(
    (
      node: { type: CanvasNodeType; data: CanvasNodeData<any>; position?: XYPosition },
      connectTo?: CanvasNodeFilter[],
    ) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const edges = data[canvasId]?.edges ?? [];

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        return;
      }

      let needSetCenter = true;

      // Check for existing node
      const existingNode = nodes.find((n) => n.type === node.type && n.data?.entityId === node.data?.entityId);
      if (existingNode) {
        if (existingNode.type !== 'skillResponse') {
          message.warning(t('canvas.action.nodeAlreadyExists', { type: t(`common.${node.type}`) }));
        }
        setSelectedNode(existingNode);
        setNodeCenter(existingNode.id);
        return;
      }

      // Find source nodes
      const sourceNodes = connectTo
        ?.map((filter) => nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId))
        .filter(Boolean);

      // Calculate new node position
      let newPosition: XYPosition;

      if (sourceNodes?.length) {
        // Get all existing target nodes that are connected to any of the source nodes
        const existingTargetNodeIds = new Set(
          edges.filter((edge) => sourceNodes.some((source) => source.id === edge.source)).map((edge) => edge.target),
        );

        const existingTargetNodes = nodes.filter((n) => existingTargetNodeIds.has(n.id));

        if (existingTargetNodes.length) {
          // Position based on existing target nodes
          const minTargetX = Math.min(...existingTargetNodes.map((n) => n.position.x));
          const maxTargetY = Math.max(...existingTargetNodes.map((n) => n.position.y + (n.measured?.height ?? 100)));

          newPosition = {
            x: minTargetX,
            y: maxTargetY + 40,
          };
        } else {
          // First connection - position based on source nodes
          const avgSourceX = sourceNodes.reduce((sum, n) => sum + n.position.x, 0) / sourceNodes.length;
          const maxSourceY = Math.max(...sourceNodes.map((n) => n.position.y + (n.measured?.height ?? 100)));

          newPosition = {
            x: avgSourceX + 400, // Offset to the right of source nodes
            y: maxSourceY + 40,
          };
        }
      } else {
        // Default position if no source nodes
        newPosition = node.position ?? {
          x: Math.max(...nodes.map((n) => n.position.x), 0) + 400,
          y: Math.max(...nodes.map((n) => n.position.y), 0),
        };
        needSetCenter = true;
      }

      const enrichedData = {
        createdAt: new Date().toISOString(),
        ...node.data,
        metadata: {
          ...getNodeDefaultMetadata(node.type),
          ...node?.data?.metadata,
        },
      };

      const newNode = prepareNodeData({
        type: node.type,
        data: enrichedData,
        position: newPosition,
        selected: true,
      });
      const updatedNodes = deduplicateNodes([...nodes.map((n) => ({ ...n, selected: false })), newNode]);

      setNodes(canvasId, updatedNodes);

      if (connectTo?.length > 0) {
        const newEdges =
          sourceNodes?.map((sourceNode) => ({
            id: `edge-${genUniqueId()}`,
            source: sourceNode.id,
            target: newNode.id,
            style: edgeStyles.default,
            type: 'default',
          })) ?? [];

        if (newEdges.length > 0) {
          const updatedEdges = deduplicateEdges([...edges, ...newEdges]);
          setEdges(canvasId, updatedEdges);
        }
      }

      if (needSetCenter) {
        setNodeCenter(newNode.id);
      }

      if (newNode.type === 'document' || newNode.type === 'resource') {
        addPinnedNode(canvasId, newNode);
      }
    },
    [canvasId, setNodes, setEdges, edgeStyles, setSelectedNode, setNodeCenter, addPinnedNode, t],
  );

  return { addNode };
};
