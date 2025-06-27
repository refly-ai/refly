import { useCallback } from 'react';
import { useCanvasId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-id';
import { Node, useReactFlow } from '@xyflow/react';
import { useNodeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-operations';
import { NODE_PADDING, sortNodes } from '@refly/canvas-common';

export const useUngroupNodes = () => {
  const canvasId = useCanvasId();
  const { getNodes } = useReactFlow();
  const { updateNodesWithSync } = useNodeOperations();

  const ungroupNodes = useCallback(
    (groupId: string) => {
      const nodes = getNodes();

      // Find the group node
      const groupNode = nodes.find((n) => n.id === groupId && n.type === 'group');
      if (!groupNode) return;

      // Calculate absolute positions for the group
      const getAbsolutePosition = (node: Node) => {
        let absoluteX = node.position.x;
        let absoluteY = node.position.y;
        let currentNode = node;
        let parent = nodes.find((n) => n.id === currentNode.parentId);

        while (parent) {
          absoluteX += parent.position.x;
          absoluteY += parent.position.y;
          currentNode = parent;
          parent = nodes.find((n) => n.id === currentNode.parentId);
        }

        return { x: absoluteX, y: absoluteY };
      };

      const groupAbsolutePos = getAbsolutePosition(groupNode);

      // Update nodes
      const updatedNodes = nodes
        .map((node) => {
          if (node.parentId === groupId) {
            // Calculate absolute position for the child node
            const nodeAbsolutePos = {
              x: groupAbsolutePos.x + node.position.x + NODE_PADDING / 2,
              y: groupAbsolutePos.y + node.position.y + NODE_PADDING / 2,
            };

            // Remove group-related properties
            const { parentId, extent, ...nodeWithoutParent } = node;

            return {
              ...nodeWithoutParent,
              position: nodeAbsolutePos,
              selected: false,
            };
          }
          return node;
        })
        .filter((node) => node.id !== groupId); // Remove the group node

      updateNodesWithSync(sortNodes(updatedNodes));
    },
    [canvasId, updateNodesWithSync],
  );

  const ungroupMultipleNodes = useCallback(
    (groupIds: string[]) => {
      for (const groupId of groupIds) {
        ungroupNodes(groupId);
      }
    },
    [ungroupNodes],
  );

  return {
    ungroupNodes,
    ungroupMultipleNodes,
  };
};
