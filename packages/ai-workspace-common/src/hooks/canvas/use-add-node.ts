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
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useNodePosition } from './use-node-position';

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

const padding = 200;

export const useAddNode = () => {
  const { t } = useTranslation();
  const edgeStyles = useEdgeStyles();
  const { setCenter, getNode } = useReactFlow();
  const { canvasId } = useCanvasContext();
  const { calculatePosition, layoutBranchAndUpdatePositions } = useNodePosition();

  const { setNodes, setEdges, addNodePreview } = useCanvasStoreShallow((state) => ({
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    addNodePreview: state.addNodePreview,
  }));

  const reactFlowInstance = useReactFlow();

  const setNodeCenter = useCallback(
    (nodeId: string) => {
      const currentZoom = reactFlowInstance.getZoom();
      const zoomAdjustedPadding = padding;

      requestAnimationFrame(() => {
        const renderedNode = getNode(nodeId);
        if (renderedNode) {
          setCenter(renderedNode.position.x + zoomAdjustedPadding, renderedNode.position.y + zoomAdjustedPadding, {
            duration: 300,
            zoom: currentZoom,
          });
        }
      });
    },
    [setCenter, reactFlowInstance],
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
      shouldPreview: boolean = true,
      needSetCenter: boolean = true,
    ) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const edges = data[canvasId]?.edges ?? [];

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        return;
      }

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

      // Calculate new node position using the utility function
      const newPosition = calculatePosition({
        nodes,
        sourceNodes,
        connectTo,
        defaultPosition: node.position,
        edges,
      });

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

      // Create updated nodes array with the new node
      const updatedNodes = deduplicateNodes([...nodes.map((n) => ({ ...n, selected: false })), newNode]);

      // Create new edges if connecting to source nodes
      let updatedEdges = edges;
      if (connectTo?.length > 0 && sourceNodes?.length > 0) {
        const newEdges = sourceNodes.map((sourceNode) => ({
          id: `edge-${genUniqueId()}`,
          source: sourceNode.id,
          target: newNode.id,
          style: edgeStyles.default,
          type: 'default',
        }));

        updatedEdges = deduplicateEdges([...edges, ...newEdges]);
      }

      // Update nodes and edges
      setNodes(canvasId, updatedNodes);
      setEdges(canvasId, updatedEdges);

      // Apply branch layout if we're connecting to existing nodes
      if (sourceNodes?.length > 0) {
        // Use setTimeout to ensure the new node and edges are added before layout
        setTimeout(() => {
          const { autoLayout } = useCanvasStore.getState();
          if (!autoLayout) {
            if (needSetCenter) {
              setNodeCenter(newNode.id);
            }

            return;
          }

          layoutBranchAndUpdatePositions(
            sourceNodes,
            updatedNodes,
            updatedEdges,
            {},
            { needSetCenter: needSetCenter, targetNodeId: newNode.id },
          );
        }, 0);
      } else if (needSetCenter) {
        setNodeCenter(newNode.id);
      }

      if (newNode.type === 'document' || (newNode.type === 'resource' && shouldPreview)) {
        addNodePreview(canvasId, newNode);
        locateToNodePreviewEmitter.emit('locateToNodePreview', { canvasId, id: newNode.id });
      }
    },
    [
      canvasId,
      setNodes,
      setEdges,
      edgeStyles,
      setSelectedNode,
      setNodeCenter,
      addNodePreview,
      t,
      calculatePosition,
      layoutBranchAndUpdatePositions,
    ],
  );

  return { addNode };
};
