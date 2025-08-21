import { Node, XYPosition } from '@xyflow/react';
import { CanvasNodeFilter } from './types';
import { SPACING } from './constants';
import { getNodeWidth, getNodeHeight, getRootNodes } from './nodes';

export const NODE_PADDING = 40;

export interface CalculateNodePositionParams {
  nodes: Node[];
  sourceNodes?: Node[];
  connectTo?: CanvasNodeFilter[];
  defaultPosition?: XYPosition;
  edges?: any[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  autoLayout?: boolean; // Control whether to enable auto layout
}

export const sortNodes = (nodes: Node[]) => {
  return nodes.sort((a, b) => {
    if (a.type === 'group') return -1;
    if (b.type === 'group') return 1;
    return 0;
  });
};

export const getAbsolutePosition = (node: Node, nodes: Node[]) => {
  const position = { x: node.position.x, y: node.position.y };
  let parent = nodes.find((n) => n.id === node.parentId);

  while (parent) {
    position.x += parent.position.x;
    position.y += parent.position.y;
    parent = nodes.find((n) => n.id === parent?.parentId);
  }
  return position;
};

// Get the rightmost position for a new node
export const getRightmostPosition = (
  sourceNodes: Node[],
  nodes: Node[],
  _edges: any[],
): XYPosition => {
  // Convert source nodes to absolute positions if they are in groups
  const sourceNodesAbsolute = sourceNodes.map((node) => ({
    ...node,
    position: getNodeAbsolutePosition(node, nodes),
    width: getNodeWidth(node),
  }));

  // Calculate X position considering node width
  const rightmostX = Math.max(...sourceNodesAbsolute.map((n) => n.position.x + n.width / 2));
  const targetX = rightmostX + SPACING.X;

  // Get all nodes at the same X level
  const nodesAtTargetLevel = nodes
    .filter((node) => {
      const absPos = getNodeAbsolutePosition(node, nodes);
      return Math.abs(absPos.x - targetX) < SPACING.X / 2;
    })
    .map((node) => ({
      ...node,
      position: getNodeAbsolutePosition(node, nodes),
    }))
    .sort((a, b) => a.position.y - b.position.y);

  // Calculate average Y of source nodes
  const avgSourceY =
    sourceNodesAbsolute.reduce((sum, n) => sum + n.position.y, 0) / sourceNodesAbsolute.length;

  // If no nodes at this level, place at average Y of source nodes
  if (nodesAtTargetLevel.length === 0) {
    return {
      x: targetX,
      y: avgSourceY,
    };
  }

  // Calculate the best position based on existing nodes
  const fixedSpacing = SPACING.Y;

  // Calculate position for new node
  let bestY = avgSourceY;
  let minOverlap = Number.POSITIVE_INFINITY;

  // Try different Y positions around the average source Y
  const range = Math.max(fixedSpacing * 3, getNodeHeight(nodesAtTargetLevel[0]));
  const step = fixedSpacing / 4;

  for (let y = avgSourceY - range; y <= avgSourceY + range; y += step) {
    let hasOverlap = false;
    let totalOverlap = 0;

    // Check overlap with existing nodes considering node heights
    for (const node of nodesAtTargetLevel) {
      const nodeHeight = getNodeHeight(node);
      const newNodeHeight = 320; // Default height for new node

      // Calculate the vertical overlap between the two nodes
      const nodeTop = node.position.y - nodeHeight / 2;
      const nodeBottom = node.position.y + nodeHeight / 2;
      const newNodeTop = y - newNodeHeight / 2;
      const newNodeBottom = y + newNodeHeight / 2;

      // Check if the nodes overlap vertically
      if (!(newNodeBottom < nodeTop - fixedSpacing || newNodeTop > nodeBottom + fixedSpacing)) {
        hasOverlap = true;
        // Calculate the amount of overlap
        const overlap = Math.min(
          Math.abs(newNodeBottom - nodeTop),
          Math.abs(newNodeTop - nodeBottom),
        );
        totalOverlap += overlap;
      }
    }

    // If this position has less overlap, use it
    if (totalOverlap < minOverlap) {
      minOverlap = totalOverlap;
      bestY = y;
    }

    // If we found a position with no overlap, use it immediately
    if (!hasOverlap) {
      bestY = y;
      break;
    }
  }

  // If we still have overlap, try to find the largest gap
  if (minOverlap > 0) {
    const gaps: { start: number; end: number }[] = [];
    const firstNode = nodesAtTargetLevel[0];
    const firstNodeHeight = getNodeHeight(firstNode);

    // Add gap before first node
    gaps.push({
      start: avgSourceY - range,
      end: firstNode.position.y - firstNodeHeight / 2 - fixedSpacing,
    });

    // Add gaps between nodes
    for (let i = 0; i < nodesAtTargetLevel.length - 1; i++) {
      const currentNode = nodesAtTargetLevel[i];
      const nextNode = nodesAtTargetLevel[i + 1];
      const currentNodeHeight = getNodeHeight(currentNode);
      const nextNodeHeight = getNodeHeight(nextNode);

      gaps.push({
        start: currentNode.position.y + currentNodeHeight / 2 + fixedSpacing,
        end: nextNode.position.y - nextNodeHeight / 2 - fixedSpacing,
      });
    }

    // Add gap after last node
    const lastNode = nodesAtTargetLevel[nodesAtTargetLevel.length - 1];
    const lastNodeHeight = getNodeHeight(lastNode);
    gaps.push({
      start: lastNode.position.y + lastNodeHeight / 2 + fixedSpacing,
      end: avgSourceY + range,
    });

    // Find the best gap
    let bestGap = { start: 0, end: 0, size: 0, distanceToAvg: Number.POSITIVE_INFINITY };
    for (const gap of gaps) {
      const size = gap.end - gap.start;
      if (size >= fixedSpacing + 320) {
        // Consider minimum space needed for new node
        const gapCenter = (gap.start + gap.end) / 2;
        const distanceToAvg = Math.abs(gapCenter - avgSourceY);
        if (distanceToAvg < bestGap.distanceToAvg) {
          bestGap = { ...gap, size, distanceToAvg };
        }
      }
    }

    if (bestGap.size > 0) {
      bestY = (bestGap.start + bestGap.end) / 2;
    }
  }

  return {
    x: targetX,
    y: bestY,
  };
};

// Get the leftmost bottom position for new nodes
export const getLeftmostBottomPosition = (nodes: Node[], spacing = SPACING): XYPosition => {
  if (nodes.length === 0) {
    return {
      x: SPACING.INITIAL_X,
      y: SPACING.INITIAL_Y,
    };
  }

  // Convert nodes to absolute positions
  const nodesAbsolute = nodes.map((node) => ({
    ...node,
    position: getNodeAbsolutePosition(node, nodes),
  }));

  // Find the leftmost x position among all nodes
  const leftmostX = Math.min(...nodesAbsolute.map((n) => n.position.x));

  // Find all nodes at the leftmost position
  const leftmostNodes = nodesAbsolute
    .filter((n) => Math.abs(n.position.x - leftmostX) < spacing.X / 2)
    .sort((a, b) => a.position.y - b.position.y);

  if (leftmostNodes.length === 0) {
    return {
      x: leftmostX,
      y: SPACING.INITIAL_Y,
    };
  }

  // Find gaps between nodes
  const gaps: { start: number; end: number }[] = [];
  const fixedSpacing = spacing.Y;
  const nodeHeight = 320; // Default node height

  // Add gap before first node
  const firstNode = leftmostNodes[0];
  const firstNodeTop = firstNode.position.y - (firstNode.measured?.height ?? nodeHeight) / 2;
  if (firstNodeTop > SPACING.INITIAL_Y + fixedSpacing + nodeHeight) {
    gaps.push({
      start: SPACING.INITIAL_Y,
      end: firstNodeTop - fixedSpacing,
    });
  }

  // Add gaps between nodes
  for (let i = 0; i < leftmostNodes.length - 1; i++) {
    const currentNode = leftmostNodes[i];
    const nextNode = leftmostNodes[i + 1];
    const currentNodeBottom =
      currentNode.position.y + (currentNode.measured?.height ?? nodeHeight) / 2;
    const nextNodeTop = nextNode.position.y - (nextNode.measured?.height ?? nodeHeight) / 2;

    if (nextNodeTop - currentNodeBottom >= fixedSpacing + nodeHeight) {
      gaps.push({
        start: currentNodeBottom + fixedSpacing,
        end: nextNodeTop - fixedSpacing,
      });
    }
  }

  // Add gap after last node
  const lastNode = leftmostNodes[leftmostNodes.length - 1];
  const lastNodeBottom = lastNode.position.y + (lastNode.measured?.height ?? nodeHeight) / 2;
  gaps.push({
    start: lastNodeBottom + fixedSpacing,
    end: lastNodeBottom + fixedSpacing + nodeHeight,
  });

  // If we found any suitable gaps, use the first one
  if (gaps.length > 0) {
    // Find the first gap that's big enough
    const suitableGap = gaps.find((gap) => gap.end - gap.start >= nodeHeight);
    if (suitableGap) {
      return {
        x: leftmostX,
        y: suitableGap.start + nodeHeight / 2,
      };
    }
  }

  // If no suitable gaps found, place below the last node
  return {
    x: leftmostX,
    y: lastNodeBottom + fixedSpacing + nodeHeight / 2,
  };
};

// Add this helper function before calculateNodePosition
export const getNodeAbsolutePosition = (node: Node, nodes: Node[]): XYPosition => {
  if (!node) {
    return { x: 0, y: 0 };
  }

  if (!node.parentId) {
    return node.position;
  }

  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) {
    return node.position;
  }

  const parentPos = getNodeAbsolutePosition(parent, nodes);
  return {
    x: parentPos.x + node.position.x,
    y: parentPos.y + node.position.y,
  };
};

export const calculateNodePosition = ({
  nodes,
  sourceNodes,
  defaultPosition,
  edges = [],
  viewport,
  autoLayout = false, // Default to false for backward compatibility
}: CalculateNodePositionParams): XYPosition => {
  // If position is provided, use it
  if (defaultPosition) {
    return defaultPosition;
  }

  // Case 1: No nodes exist or no source nodes - place in viewport center if available
  if (nodes.length === 0 || !sourceNodes?.length) {
    // If viewport is provided, center the node in the user's current visible area
    // This ensures that new nodes appear in the center of what the user is currently viewing
    if (viewport) {
      // Convert viewport to flow coordinates
      // This formula calculates the center point of the visible area in flow coordinates
      // accounting for current pan position (viewport.x/y) and zoom level
      return {
        x: -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom,
        y: -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom,
      };
    }

    // Fallback to old behavior if viewport not available
    if (nodes.length === 0) {
      return {
        x: SPACING.INITIAL_X,
        y: SPACING.INITIAL_Y,
      };
    }

    return getLeftmostBottomPosition(nodes);
  }

  // Case 3: Connected to existing nodes
  if (sourceNodes?.length > 0) {
    // Use the autoLayout parameter passed in instead of hardcoded value
    // Convert relative positions to absolute positions for calculations
    const sourceNodesAbsolute = sourceNodes.map((node) => ({
      ...node,
      position: getNodeAbsolutePosition(node, nodes),
      width: getNodeWidth(node),
    }));

    if (!autoLayout) {
      // For each source node, find all its connected target nodes
      const connectedNodes = new Set<Node>();

      for (const sourceNode of sourceNodes) {
        // Find all direct target nodes of this source node
        for (const edge of edges) {
          if (edge.source === sourceNode.id) {
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (targetNode) {
              connectedNodes.add(targetNode);
            }
          }
        }
      }

      // Calculate X position considering node width
      const rightmostSourceX = Math.max(
        ...sourceNodesAbsolute.map((n) => n.position.x + n.width / 2),
      );
      const targetX = rightmostSourceX + SPACING.X;

      if (connectedNodes.size > 0) {
        // Convert connected nodes to absolute positions
        const connectedNodesAbsolute = Array.from(connectedNodes).map((node) => ({
          ...node,
          position: getNodeAbsolutePosition(node, nodes),
          width: getNodeWidth(node),
        }));

        // Find the bottommost node among all connected nodes
        const bottomNode = connectedNodesAbsolute.reduce((bottom, current) => {
          const bottomY = bottom.position.y + (bottom.measured?.height ?? 320) / 2;
          const currentY = current.position.y + (current.measured?.height ?? 320) / 2;
          return currentY > bottomY ? current : bottom;
        });

        // Position new node below the bottommost connected node
        const bottomY = bottomNode.position.y + (bottomNode.measured?.height ?? 320) / 2;

        return {
          x: targetX,
          y: bottomY + SPACING.Y + 320 / 2,
        };
      }
      // If no connected nodes, place at average Y of source nodes
      const avgSourceY =
        sourceNodesAbsolute.reduce((sum, n) => sum + n.position.y, 0) / sourceNodesAbsolute.length;
      return {
        x: targetX,
        y: avgSourceY,
      };
    }

    // If auto-layout is enabled or no branch nodes found, use original positioning logic
    return getRightmostPosition(sourceNodesAbsolute, nodes, edges);
  }

  // Case 2: No specific connections - add to a new branch
  const rootNodes = getRootNodes(nodes, edges);

  if (rootNodes.length > 0) {
    // Sort root nodes by Y position
    const sortedRootNodes = [...rootNodes].sort((a, b) => a.position.y - b.position.y);

    // Try to find a gap between root nodes that's large enough
    for (let i = 0; i < sortedRootNodes.length - 1; i++) {
      const gap = sortedRootNodes[i + 1].position.y - sortedRootNodes[i].position.y;
      if (gap >= 30) {
        return {
          x: sortedRootNodes[i].position.x,
          y: sortedRootNodes[i].position.y + gap / 2,
        };
      }
    }

    // If no suitable gap found, place below the last root node
    const lastNode = sortedRootNodes[sortedRootNodes.length - 1];
    return {
      x: lastNode.position.x,
      y: lastNode.position.y + SPACING.Y + (lastNode.measured?.height ?? 320),
    };
  }

  // Fallback: Place to the right of existing nodes with proper spacing
  const rightmostNodes = nodes
    .filter((n) => {
      const isRightmost = !edges.some((e) => e.source === n.id);
      return isRightmost;
    })
    .sort((a, b) => a.position.y - b.position.y);

  if (rightmostNodes.length > 0) {
    // Try to find a gap between rightmost nodes
    for (let i = 0; i < rightmostNodes.length - 1; i++) {
      const gap = rightmostNodes[i + 1].position.y - rightmostNodes[i].position.y;
      if (gap >= 30) {
        return {
          x: Math.max(...rightmostNodes.map((n) => n.position.x)) + SPACING.X,
          y: rightmostNodes[i].position.y + gap / 2,
        };
      }
    }

    // If no suitable gap found, place below the last rightmost node
    const lastNode = rightmostNodes[rightmostNodes.length - 1];
    return {
      x: Math.max(...rightmostNodes.map((n) => n.position.x)) + SPACING.X,
      y: lastNode.position.y + SPACING.Y + (lastNode.measured?.height ?? 320),
    };
  }

  // Final fallback: Place at initial position with offset
  return {
    x: SPACING.INITIAL_X,
    y: SPACING.INITIAL_Y,
  };
};

// Get node dimensions considering if it's a group
export const getNodeDimensions = (node: Node, allNodes: Node[]) => {
  if (node.type === 'group') {
    const groupChildren = allNodes.filter((n) => n.parentId === node.id);
    if (groupChildren.length > 0) {
      const childPositions = groupChildren.map((child) => {
        const { x, y } = getAbsolutePosition(child, allNodes);
        return {
          x,
          y,
          width: child.measured?.width ?? child.width ?? 200,
          height: child.measured?.height ?? child.height ?? 100,
        };
      });

      const left = Math.min(...childPositions.map((p) => p.x));
      const right = Math.max(...childPositions.map((p) => p.x + p.width));
      const top = Math.min(...childPositions.map((p) => p.y));
      const bottom = Math.max(...childPositions.map((p) => p.y + p.height));

      return {
        width: right - left + NODE_PADDING,
        height: bottom - top + NODE_PADDING,
      };
    }
    return {
      width: (node.data as any)?.metadata?.width ?? 200,
      height: (node.data as any)?.metadata?.height ?? 100,
    };
  }

  return {
    width: node.measured?.width ?? node.width ?? 200,
    height: node.measured?.height ?? node.height ?? 100,
  };
};

// Calculate group boundaries based on absolute positions
export const calculateGroupBoundaries = (nodesToGroup: Node[], currentNodes: Node[]) => {
  // Get absolute positions and dimensions for all nodes
  const nodesWithAbsolutePos = nodesToGroup.map((node) => {
    const absolutePos = getAbsolutePosition(node, currentNodes);
    const dimensions = getNodeDimensions(node, currentNodes);

    return {
      ...node,
      absolutePos,
      dimensions,
    };
  });

  // Calculate boundaries
  const left = Math.min(...nodesWithAbsolutePos.map((n) => n.absolutePos.x));
  const right = Math.max(...nodesWithAbsolutePos.map((n) => n.absolutePos.x + n.dimensions.width));
  const top = Math.min(...nodesWithAbsolutePos.map((n) => n.absolutePos.y));
  const bottom = Math.max(
    ...nodesWithAbsolutePos.map((n) => n.absolutePos.y + n.dimensions.height),
  );

  const dimensions = {
    width: right - left + NODE_PADDING,
    height: bottom - top + NODE_PADDING,
  };

  // Create group node
  const groupNode = {
    type: 'group' as const,
    data: {
      title: '',
      metadata: {
        ...dimensions,
      },
    },
    position: {
      x: left - NODE_PADDING / 2,
      y: top - NODE_PADDING / 2,
    },
    className: 'react-flow__node-default important-box-shadow-none',
    style: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      ...dimensions,
    },
    selected: false,
    draggable: true,
  };

  return { groupNode, dimensions, minX: left, minY: top };
};
