import React, { useMemo, useState, useEffect, useRef } from 'react';
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

// Add last aligned positions concept
interface AlignmentPosition {
  nodeId: string;
  lines: SnapLine[];
  timestamp: number;
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
    width: nodeWidth,
    height: nodeHeight,
  };
};

const SnapLines: React.FC<SnapLinesProps> = ({ snapThreshold = 5 }) => {
  const nodes = useStore((state) => state.nodes);
  const { draggingNodeId } = useEditorPerformance();
  const viewport = useViewport();
  const [lastAlignments, setLastAlignments] = useState<AlignmentPosition | null>(null);
  // 使用 ref 存储当前计算出的线条，避免在 useMemo 中直接调用 setState
  const currentLinesRef = useRef<SnapLine[]>([]);

  // Convert flow coordinates to screen coordinates
  const flowToScreen = useMemo(() => {
    return ({ x, y }: { x: number; y: number }) => ({
      x: x * viewport.zoom + viewport.x,
      y: y * viewport.zoom + viewport.y,
    });
  }, [viewport]);

  // Calculate snap lines with smoother logic
  const snapLines = useMemo(() => {
    if (!draggingNodeId) {
      // If no dragging but we have recent alignment, show it
      if (lastAlignments && Date.now() - lastAlignments.timestamp < 1000) {
        return lastAlignments.lines;
      }
      return [];
    }

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
        [draggingBounds.center, targetBounds.center, 'center'],
        [draggingBounds.right, targetBounds.right, 'right'],
        [draggingBounds.left, targetBounds.right, 'left-to-right'],
        [draggingBounds.right, targetBounds.left, 'right-to-left'],
      ] as const) {
        // Only show snap lines when nodes are close
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
        [draggingBounds.middle, targetBounds.middle, 'middle'],
        [draggingBounds.bottom, targetBounds.bottom, 'bottom'],
        [draggingBounds.top, targetBounds.bottom, 'top-to-bottom'],
        [draggingBounds.bottom, targetBounds.top, 'bottom-to-top'],
      ] as const) {
        // Only show snap lines when nodes are close
        const diff = Math.abs(draggingValue - targetValue);
        if (diff <= snapThreshold) {
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

    // 将计算出的线条保存到 ref 中，但不在 useMemo 中调用 setState
    currentLinesRef.current = lines;
    return lines;
  }, [nodes, draggingNodeId, snapThreshold, viewport, lastAlignments]);

  // 使用一个单独的 useEffect 来处理 lastAlignments 的更新
  useEffect(() => {
    if (draggingNodeId && currentLinesRef.current.length > 0) {
      setLastAlignments({
        nodeId: draggingNodeId,
        lines: [...currentLinesRef.current],
        timestamp: Date.now(),
      });
    }
  }, [draggingNodeId]); // 只依赖 draggingNodeId 变化

  // Clear last alignments after some time
  useEffect(() => {
    if (!draggingNodeId && lastAlignments) {
      const timer = setTimeout(() => {
        setLastAlignments(null);
      }, 2000); // 增加到2000毫秒，让辅助线有更长的可见时间

      return () => clearTimeout(timer);
    }
  }, [draggingNodeId, lastAlignments]);

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
              opacity: draggingNodeId ? 1 : 0.7,
              transition: draggingNodeId ? 'none' : 'opacity 0.3s ease-out',
            }}
          />
        );
      })}
    </>
  );
};

const SnapLinesMemo = React.memo(SnapLines);

export { SnapLinesMemo as SnapLines, getNodeBounds };
