import { Edge, Node, XYPosition } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { SPACING } from './constants';
import { getNodeHeight, getNodeLevel, getNodeWidth } from './nodes';
import { getNodeAbsolutePosition } from './position';

export interface LayoutBranchOptions {
  fromRoot?: boolean; // 是否从根节点开始布局
  direction?: 'TB' | 'LR';
  fixedNodeLevels?: boolean;
  spacing?: {
    x: number;
    y: number;
  };
}

// Helper function to get all nodes in a branch starting from specific nodes
export const getBranchNodes = (
  startNodeIds: string[],
  nodes: Node[],
  edges: any[],
  visited: Set<string> = new Set(),
): Node[] => {
  const branchNodes: Node[] = [];
  const queue = [...startNodeIds];

  while (queue.length > 0) {
    const currentId = queue.shift() ?? '';
    if (visited.has(currentId) || !currentId) continue;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (node) {
      branchNodes.push(node);

      // Only get outgoing connections to maintain hierarchy
      const outgoingIds = edges.filter((e) => e.source === currentId).map((e) => e.target);

      queue.push(...outgoingIds);
    }
  }

  return branchNodes;
};

// Get nodes at specific level
export const getNodesAtLevel = (
  nodes: Node[],
  edges: any[],
  level: number,
  rootNodes: Node[],
): Node[] => {
  const result: Node[] = [];
  const visited = new Set<string>();
  const queue: Array<{ node: Node; level: number }> = rootNodes.map((node) => ({ node, level: 0 }));

  while (queue.length > 0) {
    const item = queue.shift() ?? { node: null, level: -1 };
    const { node, level: currentLevel } = item;

    if (visited.has(node.id) || !node) continue;
    visited.add(node.id);

    if (currentLevel === level) {
      result.push(node);
      continue;
    }

    // Add next level nodes to queue
    const nextNodes = edges
      .filter((edge) => edge.source === node.id)
      .map((edge) => nodes.find((n) => n.id === edge.target))
      .filter((n): n is Node => n !== undefined)
      .map((node) => ({ node, level: currentLevel + 1 }));

    queue.push(...nextNodes);
  }

  return result;
};

// Layout a branch using Dagre while preserving root positions
export const layoutBranch = (
  branchNodes: Node[],
  edges: any[],
  rootNodes: Node[],
  options: LayoutBranchOptions = {},
): Node[] => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  // Configure the layout with consistent spacing
  g.setGraph({
    rankdir: 'LR',
    nodesep: SPACING.Y,
    // Use consistent spacing as calculatePosition
    ranksep: SPACING.X,
    marginx: 50,
    marginy: 50,
  });

  // Add all nodes to the graph with their actual dimensions
  for (const node of branchNodes) {
    const nodeWidth = getNodeWidth(node);
    const nodeHeight = getNodeHeight(node);
    g.setNode(node.id, {
      ...node,
      width: nodeWidth,
      height: nodeHeight,
      // Store original dimensions for later use
      originalWidth: nodeWidth,
      originalHeight: nodeHeight,
    });
  }

  // Add edges
  for (const edge of edges) {
    if (
      branchNodes.some((n) => n.id === edge.source) &&
      branchNodes.some((n) => n.id === edge.target)
    ) {
      g.setEdge(edge.source, edge.target);
    }
  }

  // Get the maximum level in the branch
  const maxLevel = Math.max(
    ...branchNodes.map((node) => getNodeLevel(node.id, branchNodes, edges, rootNodes)),
  );

  // Fix positions based on mode
  for (const node of branchNodes) {
    const level = getNodeLevel(node.id, branchNodes, edges, rootNodes);
    const isRoot = rootNodes.some((root) => root.id === node.id);
    const shouldFixPosition = options.fromRoot ? isRoot : level < maxLevel;

    if (shouldFixPosition) {
      const nodeWidth = getNodeWidth(node);
      g.setNode(node.id, {
        ...g.node(node.id),
        x: node.position.x + nodeWidth / 2, // Adjust x position to account for node width
        y: node.position.y,
        fixed: true,
      });
    }
  }

  // Apply layout
  Dagre.layout(g);

  // Return nodes with updated positions, adjusting for node widths
  return branchNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const level = getNodeLevel(node.id, branchNodes, edges, rootNodes);
    const isRoot = rootNodes.some((root) => root.id === node.id);
    const shouldPreservePosition = options.fromRoot ? isRoot : level < maxLevel;

    if (shouldPreservePosition) {
      return node; // Keep original position for fixed nodes
    }

    // For non-fixed nodes, ensure they maintain relative Y position to their source nodes
    const sourceEdges = edges.filter((edge) => edge.target === node.id);
    if (sourceEdges.length > 0 && !options.fromRoot) {
      const sourceNodes = sourceEdges
        .map((edge) => branchNodes.find((n) => n.id === edge.source))
        .filter((n): n is Node => n !== undefined);

      if (sourceNodes.length > 0) {
        const avgSourceY =
          sourceNodes.reduce((sum, n) => sum + n.position.y, 0) / sourceNodes.length;
        const nodeWidth = getNodeWidth(node);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - nodeWidth / 2, // Adjust back from Dagre's center position
            y: avgSourceY,
          },
        };
      }
    }

    // For other nodes, adjust position based on node width
    const nodeWidth = getNodeWidth(node);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2, // Adjust back from Dagre's center position
        y: nodeWithPosition.y,
      },
    };
  });
};

// Get the branch cluster that a node belongs to
export const getBranchCluster = (nodeId: string, nodes: Node[], edges: any[]): Node[] => {
  const visited = new Set<string>();
  const cluster = new Set<string>();
  const queue = [nodeId];

  // First traverse upwards to find root
  while (queue.length > 0) {
    const currentId = queue.shift() ?? '';
    if (visited.has(currentId) || !currentId) continue;
    visited.add(currentId);
    cluster.add(currentId);

    // Add parent nodes
    const parentIds = edges.filter((edge) => edge.target === currentId).map((edge) => edge.source);
    queue.push(...parentIds);
  }

  // Then traverse downwards from all found nodes
  const downQueue = Array.from(cluster);
  visited.clear();

  while (downQueue.length > 0) {
    const currentId = downQueue.shift() ?? '';
    if (visited.has(currentId) || !currentId) continue;
    visited.add(currentId);

    // Add child nodes
    const childIds = edges.filter((edge) => edge.source === currentId).map((edge) => edge.target);
    downQueue.push(...childIds);
    for (const id of childIds) {
      cluster.add(id);
    }
  }

  return nodes.filter((node) => cluster.has(node.id));
};

// Get all connected nodes to the right of a given node
const _getRightwardNodes = (nodeId: string, nodes: Node[], edges: any[]): Node[] => {
  const visited = new Set<string>();
  const rightwardNodes: Node[] = [];
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift() ?? '';
    if (visited.has(currentId) || !currentId) continue;
    visited.add(currentId);

    const currentNode = nodes.find((n) => n.id === currentId);
    if (currentNode) {
      rightwardNodes.push(currentNode);

      // Only follow outgoing edges to nodes that are to the right
      const outgoingIds = edges
        .filter((edge) => edge.source === currentId)
        .map((edge) => edge.target)
        .filter((targetId) => {
          const targetNode = nodes.find((n) => n.id === targetId);
          return targetNode && targetNode.position.x >= currentNode.position.x;
        });

      queue.push(...outgoingIds);
    }
  }

  return rightwardNodes;
};

export const getLayoutBranchPositionUpdates = (
  sourceNodes: Node[],
  allNodes: Node[],
  edges: Edge[],
): Map<string, XYPosition> => {
  // Collect all source nodes including children of group nodes
  const sourceNodesAbsolute = sourceNodes.map((node) => ({
    ...node,
    position: getNodeAbsolutePosition(node, allNodes),
    width: getNodeWidth(node),
  }));
  if (sourceNodesAbsolute.length === 0) return new Map();

  // Find all nodes directly connected to source nodes and their connections
  const targetNodeIds = new Set<string>();
  const queue = [...sourceNodes.map((n) => n.id)];
  const visited = new Set<string>();

  // Find all connected nodes in the branch
  while (queue.length > 0) {
    const currentId = queue.shift() ?? '';
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    for (const edge of edges) {
      if (edge.source === currentId && !sourceNodes.some((n) => n.id === edge.target)) {
        targetNodeIds.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  // Get target nodes that need to be laid out
  const targetNodes = allNodes.filter((node) => targetNodeIds.has(node.id));
  if (targetNodes.length === 0) return new Map();

  // Group nodes by their level (distance from source nodes)
  const nodeLevels = new Map<number, Node[]>();
  const nodeLevel = new Map<string, number>();

  // Calculate levels for each node
  const calculateLevels = (nodeId: string, level: number) => {
    if (nodeLevel.has(nodeId)) return;
    nodeLevel.set(nodeId, level);

    const levelNodes = nodeLevels.get(level) || [];
    const node = allNodes.find((n) => n.id === nodeId);
    if (node) {
      levelNodes.push(node);
      nodeLevels.set(level, levelNodes);
    }

    // Process children
    for (const edge of edges) {
      if (edge.source === nodeId) {
        calculateLevels(edge.target, level + 1);
      }
    }
  };

  // Start level calculation from source nodes
  for (const node of sourceNodesAbsolute) {
    calculateLevels(node.id, 0);
  }

  // Sort nodes within each level by their Y position
  for (const nodes of nodeLevels.values()) {
    nodes.sort((a, b) => a.position.y - b.position.y);
  }

  // First pass: Calculate initial positions
  const nodePositions = new Map<string, XYPosition>();
  const fixedSpacing = SPACING.Y;

  // Process each level
  for (const [level, nodes] of Array.from(nodeLevels.entries())) {
    // Calculate X position consistently with calculatePosition
    const levelX =
      level === 0
        ? Math.max(...sourceNodesAbsolute.map((n) => n.position.x + getNodeWidth(n) / 2))
        : Math.max(
            ...Array.from(nodeLevels.get(level - 1) || []).map((n) => {
              const nodeWidth = getNodeWidth(n);
              const pos = n.position;
              return pos.x + nodeWidth / 2;
            }),
          ) + SPACING.X;

    // Calculate total height needed for this level
    const totalHeight = nodes.reduce((sum, node) => {
      const nodeHeight = getNodeHeight(node);
      return sum + nodeHeight + fixedSpacing;
    }, -fixedSpacing);

    // Calculate starting Y position (centered around average source Y)
    const avgSourceY =
      sourceNodesAbsolute.reduce((sum, n) => sum + n.position.y, 0) / sourceNodesAbsolute.length;
    let currentY = avgSourceY - totalHeight / 2;

    // Calculate center positions for nodes in this level
    nodes.forEach((node, index) => {
      const nodeHeight = getNodeHeight(node);

      // Get direct source nodes for this node
      const directSourceNodes = edges
        .filter((edge) => edge.target === node.id)
        .map((edge) => allNodes.find((n) => n.id === edge.source))
        .filter((n): n is Node => n !== undefined);
      const directSourceNodesAbsolute = directSourceNodes.map((node) => ({
        ...node,
        position: getNodeAbsolutePosition(node, allNodes),
        width: getNodeWidth(node),
      }));

      if (directSourceNodesAbsolute.length > 0) {
        // Try to align with average Y of source nodes
        const avgDirectSourceY =
          directSourceNodesAbsolute.reduce((sum, n) => sum + n.position.y, 0) /
          directSourceNodesAbsolute.length;
        // Adjust currentY to be closer to direct source nodes while maintaining spacing
        currentY = avgDirectSourceY - totalHeight / 2 + index * (nodeHeight + fixedSpacing);
      }

      nodePositions.set(node.id, {
        x: levelX,
        y: currentY + nodeHeight / 2,
      });

      currentY += nodeHeight + fixedSpacing;
    });
  }

  // Second pass: Adjust positions to prevent overlaps
  const adjustOverlaps = () => {
    let hasOverlap = true;
    const maxIterations = 10;
    let iteration = 0;

    while (hasOverlap && iteration < maxIterations) {
      hasOverlap = false;
      iteration++;

      // Check each pair of nodes for overlaps
      for (const [nodeId, pos1] of Array.from(nodePositions.entries())) {
        const node1 = allNodes.find((n) => n.id === nodeId);
        if (!node1) continue;
        const height1 = getNodeHeight(node1);

        for (const [otherId, pos2] of Array.from(nodePositions.entries())) {
          if (nodeId === otherId) return;

          const node2 = allNodes.find((n) => n.id === otherId);
          if (!node2) continue;
          const height2 = getNodeHeight(node2);

          // Calculate the vertical overlap between the two nodes
          const node1Top = pos1.y - height1 / 2;
          const node1Bottom = pos1.y + height1 / 2;
          const node2Top = pos2.y - height2 / 2;
          const node2Bottom = pos2.y + height2 / 2;

          // Check if the nodes overlap vertically
          if (!(node1Bottom < node2Top - fixedSpacing || node1Top > node2Bottom + fixedSpacing)) {
            hasOverlap = true;
            // Move the node with higher Y value further down
            if (pos1.y > pos2.y) {
              const newY = node2Bottom + fixedSpacing + height1 / 2;
              nodePositions.set(nodeId, {
                ...pos1,
                y: newY,
              });
            }
          }
        }
      }
    }
  };

  adjustOverlaps();

  // Filter out non-target nodes
  const filteredPositions = new Map<string, XYPosition>();

  for (const [nodeId, position] of nodePositions.entries()) {
    if (targetNodeIds.has(nodeId)) {
      filteredPositions.set(nodeId, position);
    }
  }

  return filteredPositions;
};
