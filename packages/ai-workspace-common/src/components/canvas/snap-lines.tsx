import React, { useMemo } from 'react';
import { Node, useStore, useViewport } from '@xyflow/react';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';

interface SnapLine {
  id: string;
  from: number;
  to: number;
  orientation: 'horizontal' | 'vertical';
  position: number;
}

interface SnapLinesProps {
  snapThreshold?: number;
}

const getNodeBounds = (node: Node, viewport: { zoom: number; x: number; y: number }) => {
  const { position } = node;
  // Get node element by data-id
  const nodeElement = document.querySelector(`[data-id="${node.id}"]`);

  // Get actual dimensions from DOM element
  const nodeWidth = nodeElement?.getBoundingClientRect().width
    ? nodeElement.getBoundingClientRect().width / viewport.zoom
    : 0;
  const nodeHeight = nodeElement?.getBoundingClientRect().height
    ? nodeElement.getBoundingClientRect().height / viewport.zoom
    : 0;

  return {
    left: position.x,
    right: position.x + nodeWidth,
    top: position.y,
    bottom: position.y + nodeHeight,
    center: position.x + nodeWidth / 2,
    middle: position.y + nodeHeight / 2,
  };
};

const SnapLines: React.FC<SnapLinesProps> = ({ snapThreshold = 5 }) => {
  const nodes = useStore((state) => state.nodes);
  const { draggingNodeId } = useEditorPerformance();
  const viewport = useViewport();

  const flowToScreen = useMemo(() => {
    return ({ x, y }: { x: number; y: number }) => ({
      x: x * viewport.zoom + viewport.x,
      y: y * viewport.zoom + viewport.y,
    });
  }, [viewport]);

  const snapLines = useMemo(() => {
    if (!draggingNodeId) return [];
    const draggingNode = nodes.find((n) => n.id === draggingNodeId);
    if (!draggingNode) return [];
    const draggingBounds = getNodeBounds(draggingNode, viewport);

    const lines: SnapLine[] = [];

    // Compare with other nodes
    for (const targetNode of nodes) {
      if (targetNode.id === draggingNodeId) continue;
      const targetBounds = getNodeBounds(targetNode, viewport);

      // Vertical alignments (left, center, right)
      for (const [draggingValue, targetValue, position] of [
        [draggingBounds.left, targetBounds.left, 'left'],
        [draggingBounds.right, targetBounds.right, 'right'],
      ] as const) {
        // Only show snap lines when nodes are close but not perfectly aligned
        const diff = Math.abs(draggingValue - targetValue);
        if (diff <= snapThreshold) {
          const minY = Math.min(draggingBounds.top, targetBounds.top) - 50;
          const maxY = Math.max(draggingBounds.bottom, targetBounds.bottom) + 50;

          lines.push({
            id: `v-${targetNode.id}-${position}`,
            from: minY,
            to: maxY,
            orientation: 'vertical',
            position: targetValue,
          });
        }
      }

      // Horizontal alignments (top, middle, bottom)
      for (const [draggingValue, targetValue, position] of [
        [draggingBounds.top, targetBounds.top, 'top'],
        [draggingBounds.bottom, targetBounds.bottom, 'bottom'],
      ] as const) {
        // Only show snap lines when nodes are close but not perfectly aligned
        const diff = Math.abs(draggingValue - targetValue);
        if (diff > 0 && diff <= snapThreshold) {
          const minX = Math.min(draggingBounds.left, targetBounds.left) - 50;
          const maxX = Math.max(draggingBounds.right, targetBounds.right) + 50;

          lines.push({
            id: `h-${targetNode.id}-${position}`,
            from: minX,
            to: maxX,
            orientation: 'horizontal',
            position: targetValue,
          });
        }
      }
    }

    return lines;
  }, [nodes, draggingNodeId, snapThreshold, viewport]);

  return (
    <>
      {snapLines.map((line) => {
        const isVertical = line.orientation === 'vertical';
        const { x: screenX, y: screenY } = flowToScreen({
          x: isVertical ? line.position : line.from,
          y: isVertical ? line.from : line.position,
        });
        const { x: screenToX, y: screenToY } = flowToScreen({
          x: isVertical ? line.position : line.to,
          y: isVertical ? line.to : line.position,
        });

        return (
          <div
            key={line.id}
            className="snap-line absolute pointer-events-none bg-green-500"
            style={{
              left: screenX,
              top: screenY,
              width: isVertical ? '1px' : screenToX - screenX,
              height: isVertical ? screenToY - screenY : '1px',
              transform: isVertical ? 'translateX(-0.5px)' : 'translateY(-0.5px)',
              zIndex: 1000,
            }}
          />
        );
      })}
    </>
  );
};

const SnapLinesMemo = React.memo(SnapLines);

export { SnapLinesMemo as SnapLines, getNodeBounds };
