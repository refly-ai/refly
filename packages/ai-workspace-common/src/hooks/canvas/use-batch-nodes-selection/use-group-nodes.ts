import { useCallback } from 'react';
import {
  CanvasNode,
  prepareNodeData,
  calculateGroupBoundaries,
  sortNodes,
  getAbsolutePosition,
} from '@refly/canvas-common';
import { useCanvasId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-id';
import { useNodeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-operations';
import { genUniqueId } from '@refly/utils/id';
import { useReactFlow } from '@xyflow/react';

export const useGroupNodes = () => {
  const canvasId = useCanvasId();
  const { getNodes } = useReactFlow<CanvasNode<any>>();
  const { updateNodesWithSync } = useNodeOperations();

  const createGroupFromSelectedNodes = useCallback(() => {
    const beforeNodes = getNodes();
    const selectedNodes = beforeNodes.filter((n) => n.selected);

    if (selectedNodes.length < 2) return;

    // Calculate group boundaries and create group node
    const { groupNode } = calculateGroupBoundaries(selectedNodes, beforeNodes);

    // Prepare the new group node
    const newGroupNode = prepareNodeData({
      ...groupNode,
      zIndex: -1,
      data: {
        ...groupNode.data,
        entityId: genUniqueId(),
      },
    });

    // Track groups that will become empty
    const emptyGroups = new Set<string>();
    const groupChildCounts = new Map<string, number>();

    // Count children in each group
    for (const node of beforeNodes) {
      if (node.parentId) {
        groupChildCounts.set(node.parentId, (groupChildCounts.get(node.parentId) ?? 0) + 1);
      }
    }

    // Update nodes
    let updatedNodes = beforeNodes.map((node) => {
      if (node.selected) {
        // Calculate absolute position for the node
        const absolutePos = getAbsolutePosition(node, beforeNodes);

        // Check if current group will become empty
        if (node.parentId) {
          const selectedSiblingsCount = selectedNodes.filter(
            (n) => n.parentId === node.parentId,
          ).length;

          if (selectedSiblingsCount === groupChildCounts.get(node.parentId)) {
            emptyGroups.add(node.parentId);
          }
        }

        return {
          ...node,
          parentId: newGroupNode.id,
          extent: 'parent' as const,
          position: {
            x: absolutePos.x - newGroupNode.position.x,
            y: absolutePos.y - newGroupNode.position.y,
          },
          selected: false,
          draggable: true,
        };
      }
      return node;
    });

    // Add the new group node
    updatedNodes = [...updatedNodes, newGroupNode];

    // Remove empty groups
    updatedNodes = updatedNodes.filter((node) => !emptyGroups.has(node.id));

    // Update the canvas with sorted nodes
    updateNodesWithSync(sortNodes(updatedNodes));
  }, [canvasId, updateNodesWithSync]);

  return {
    createGroupFromSelectedNodes,
  };
};
