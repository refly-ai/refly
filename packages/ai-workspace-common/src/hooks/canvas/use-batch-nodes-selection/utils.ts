import { Node } from '@xyflow/react';

export const PADDING = 40;

export const shouldDestroyTemporaryGroup = (selectedNodes: Node[]) => {
  return selectedNodes.length <= 1;
};

export const sortNodes = (nodes: Node[]) => {
  return nodes.sort((a, b) => {
    if (a.type === 'group') return -1;
    if (b.type === 'group') return 1;
    return 0;
  });
};

// Get absolute position for any node considering all parent groups
export const getAbsolutePosition = (node: Node, allNodes: Node[]) => {
  let absoluteX = node.position.x;
  let absoluteY = node.position.y;
  let currentNode = node;
  let parent = allNodes.find((n) => n.id === currentNode.parentId);

  while (parent) {
    absoluteX += parent.position.x;
    absoluteY += parent.position.y;
    currentNode = parent;
    parent = allNodes.find((n) => n.id === currentNode.parentId);
  }

  return { x: absoluteX, y: absoluteY };
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
        width: right - left + PADDING,
        height: bottom - top + PADDING,
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
    width: right - left + PADDING,
    height: bottom - top + PADDING,
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
      x: left - PADDING / 2,
      y: top - PADDING / 2,
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
