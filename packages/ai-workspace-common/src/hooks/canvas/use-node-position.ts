import { Node, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import {
  CalculateNodePositionParams,
  LayoutBranchOptions,
  calculateNodePosition,
  getNodeAbsolutePosition,
  getLayoutBranchPositionUpdates,
} from '@refly/canvas-common';

export const useNodePosition = () => {
  const { getNode, getNodes, setCenter, getZoom, setNodes, getViewport } = useReactFlow();

  const calculatePosition = useCallback(
    (params: CalculateNodePositionParams) => {
      // Get the current viewport to center new nodes in visible area
      const viewport = getViewport();
      return calculateNodePosition({ ...params, viewport });
    },
    [getViewport],
  );

  const setNodeCenter = useCallback(
    (nodeId: string, shouldSelect = false) => {
      requestAnimationFrame(() => {
        const renderedNode = getNode(nodeId);
        const nodes = getNodes();
        if (!nodes?.length) return;

        const renderedNodeAbsolute = getNodeAbsolutePosition(renderedNode, nodes);

        const currentZoom = getZoom();
        if (renderedNode) {
          setCenter(renderedNodeAbsolute.x + 200, renderedNodeAbsolute.y + 200, {
            duration: 300,
            zoom: currentZoom,
          });
          if (shouldSelect) {
            setNodes((nodes) =>
              nodes.map((node) => ({
                ...node,
                selected: node.id === nodeId,
              })),
            );
          }
        }
      });
    },
    [setCenter, getNode, getNodes, getZoom, setNodes],
  );

  const layoutBranchAndUpdatePositions = useCallback(
    (
      sourceNodes: Node[],
      allNodes: Node[],
      edges: any[],
      _options: LayoutBranchOptions = {},
      needSetCenter: { targetNodeId: string; needSetCenter: boolean } = {
        targetNodeId: '',
        needSetCenter: true,
      },
    ) => {
      const positionUpdates = getLayoutBranchPositionUpdates(sourceNodes, allNodes, edges);

      setNodes((nodes) =>
        nodes.map((node) => {
          const newPosition = positionUpdates.get(node.id);
          if (!newPosition) return node;

          return {
            ...node,
            position: newPosition,
          };
        }),
      );

      // Set center on the specified target node
      if (needSetCenter.needSetCenter && needSetCenter.targetNodeId) {
        setNodeCenter(needSetCenter.targetNodeId);
      }
    },
    [setNodes, setNodeCenter],
  );

  return { calculatePosition, setNodeCenter, layoutBranchAndUpdatePositions };
};
