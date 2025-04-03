import { Node, NodePositionChange, XYPosition } from '@xyflow/react';

type GetHelperLinesResult = {
  horizontal?: number;
  vertical?: number;
  snapPosition: Partial<XYPosition>;
};

// get the absolute position of the node, considering all parent nodes
function getNodeAbsolutePosition(node: Node, nodes: Node[]): XYPosition {
  let x = node.position.x;
  let y = node.position.y;

  if (node.parentId) {
    const parent = nodes.find((n) => n.id === node.parentId);
    if (parent) {
      const parentPos = getNodeAbsolutePosition(parent, nodes);
      x += parentPos.x;
      y += parentPos.y;
    }
  }

  return { x, y };
}

// this utility function can be called with a position change (inside onNodesChange)
// it checks all other nodes and calculated the helper line positions and the position where the current node should snap to
export function getHelperLines(
  change: NodePositionChange,
  nodes: Node[],
  distance = 10,
): GetHelperLinesResult {
  const defaultResult = {
    horizontal: undefined,
    vertical: undefined,
    snapPosition: { x: undefined, y: undefined },
  };
  const nodeA = nodes.find((node) => node.id === change.id);

  if (!nodeA || !change.position) {
    return defaultResult;
  }

  // get the parent node chain of the current node
  let parentOffset = { x: 0, y: 0 };
  if (nodeA.parentId) {
    const parent = nodes.find((n) => n.id === nodeA.parentId);
    if (parent) {
      const parentAbsPos = getNodeAbsolutePosition(parent, nodes);
      parentOffset = parentAbsPos;
    }
  }

  // calculate the absolute bounds of the current node
  const nodeABounds = {
    left: parentOffset.x + change.position.x,
    right: parentOffset.x + change.position.x + (nodeA.measured?.width ?? 0),
    top: parentOffset.y + change.position.y,
    bottom: parentOffset.y + change.position.y + (nodeA.measured?.height ?? 0),
    width: nodeA.measured?.width ?? 0,
    height: nodeA.measured?.height ?? 0,
  };

  let horizontalDistance = distance;
  let verticalDistance = distance;

  return nodes
    .filter((node) => node.id !== nodeA.id)
    .reduce<GetHelperLinesResult>((result, nodeB) => {
      // compare the nodeB's absolute position with the nodeA's absolute position
      const nodeBAbsPos = getNodeAbsolutePosition(nodeB, nodes);

      const nodeBBounds = {
        left: nodeBAbsPos.x,
        right: nodeBAbsPos.x + (nodeB.measured?.width ?? 0),
        top: nodeBAbsPos.y,
        bottom: nodeBAbsPos.y + (nodeB.measured?.height ?? 0),
        width: nodeB.measured?.width ?? 0,
        height: nodeB.measured?.height ?? 0,
      };

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //  |
      //  |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftLeft = Math.abs(nodeABounds.left - nodeBBounds.left);

      if (distanceLeftLeft < verticalDistance) {
        // convert the absolute position to a relative position for node positioning
        result.snapPosition.x = nodeBBounds.left - parentOffset.x;
        // keep the helper line at the absolute position to display correctly
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceLeftLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceRightRight = Math.abs(nodeABounds.right - nodeBBounds.right);

      if (distanceRightRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right - nodeABounds.width - parentOffset.x;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceRightRight;
      }

      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     A     |
      //              |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftRight = Math.abs(nodeABounds.left - nodeBBounds.right);

      if (distanceLeftRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right - parentOffset.x;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceLeftRight;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     B     |
      //              |___________|
      const distanceRightLeft = Math.abs(nodeABounds.right - nodeBBounds.left);

      if (distanceRightLeft < verticalDistance) {
        result.snapPosition.x = nodeBBounds.left - nodeABounds.width - parentOffset.x;
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceRightLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|     |___________|
      const distanceTopTop = Math.abs(nodeABounds.top - nodeBBounds.top);

      if (distanceTopTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top - parentOffset.y;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceTopTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|_________________
      //                    |           |
      //                    |     B     |
      //                    |___________|
      const distanceBottomTop = Math.abs(nodeABounds.bottom - nodeBBounds.top);

      if (distanceBottomTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top - nodeABounds.height - parentOffset.y;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceBottomTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|     |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|_____|___________|
      const distanceBottomBottom = Math.abs(nodeABounds.bottom - nodeBBounds.bottom);

      if (distanceBottomBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom - nodeABounds.height - parentOffset.y;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceBottomBottom;
      }

      //                    |‾‾‾‾‾‾‾‾‾‾‾|
      //                    |     B     |
      //                    |           |
      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
      //  |     A     |
      //  |___________|
      const distanceTopBottom = Math.abs(nodeABounds.top - nodeBBounds.bottom);

      if (distanceTopBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom - parentOffset.y;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceTopBottom;
      }

      return result;
    }, defaultResult);
}
