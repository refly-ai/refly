import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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

interface AlignmentResult {
  snapLines: SnapLine[];
  getSnappedPosition: (node: Node) => { x: number; y: number };
}

// 增加水平对齐类型
interface HorizontalAlignment {
  nodePos: 'left' | 'right';
  targetPos: 'left' | 'right';
  nodeValue: number;
  targetValue: number;
  offset: number;
}

// 增加垂直对齐类型
interface VerticalAlignment {
  nodePos: 'top' | 'bottom';
  targetPos: 'top' | 'bottom';
  nodeValue: number;
  targetValue: number;
  offset: number;
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

// 新增 hook 用于计算磁吸和辅助线
export const useNodeSnapping = (snapThreshold = 5): AlignmentResult => {
  const nodes = useStore((state) => state.nodes);
  const { draggingNodeId } = useEditorPerformance();
  const viewport = useViewport();
  const [lastAlignments, setLastAlignments] = useState<AlignmentPosition | null>(null);
  const currentLinesRef = useRef<SnapLine[]>([]);
  const currentHorizontalAlignmentRef = useRef<any>(null);
  const currentVerticalAlignmentRef = useRef<any>(null);

  // 计算对齐线和磁吸位置
  const calculateSnapping = useCallback(
    (
      nodeId: string | null,
    ): {
      lines: SnapLine[];
      horizontalAlignment: any;
      verticalAlignment: any;
    } => {
      if (!nodeId) return { lines: [], horizontalAlignment: null, verticalAlignment: null };

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { lines: [], horizontalAlignment: null, verticalAlignment: null };

      const nodeBounds = getNodeBounds(node, viewport);
      const otherNodes = nodes.filter((n) => n.id !== nodeId);

      const lines: SnapLine[] = [];
      let bestHorizontalAlignment = null;
      let bestVerticalAlignment = null;
      let bestHorizontalDistance = snapThreshold + 1;
      let bestVerticalDistance = snapThreshold + 1;

      // 遍历其他节点计算对齐信息
      for (const targetNode of otherNodes) {
        const targetBounds = getNodeBounds(targetNode, viewport);

        // 水平对齐的所有可能性
        const horizontalAlignments: HorizontalAlignment[] = [
          {
            nodePos: 'left',
            targetPos: 'left',
            nodeValue: nodeBounds.left,
            targetValue: targetBounds.left,
            offset: 0,
          },
          {
            nodePos: 'right',
            targetPos: 'right',
            nodeValue: nodeBounds.right,
            targetValue: targetBounds.right,
            offset: nodeBounds.right - nodeBounds.left,
          },
          {
            nodePos: 'left',
            targetPos: 'right',
            nodeValue: nodeBounds.left,
            targetValue: targetBounds.right,
            offset: 0,
          },
          {
            nodePos: 'right',
            targetPos: 'left',
            nodeValue: nodeBounds.right,
            targetValue: targetBounds.left,
            offset: nodeBounds.right - nodeBounds.left,
          },
        ];

        // 寻找最佳水平对齐并生成辅助线
        for (const align of horizontalAlignments) {
          const distance = Math.abs(align.nodeValue - align.targetValue);
          if (distance <= snapThreshold) {
            // 如果是更好的对齐，更新最佳对齐信息
            if (distance < bestHorizontalDistance) {
              bestHorizontalDistance = distance;
              bestHorizontalAlignment = {
                ...align,
                targetNode,
                distance,
              };
            }

            // 生成垂直辅助线
            const minY = Math.min(nodeBounds.top, targetBounds.top) - 50;
            const maxY = Math.max(nodeBounds.bottom, targetBounds.bottom) + 50;

            lines.push({
              id: `v-${targetNode.id}-${align.targetPos}`,
              from: minY,
              to: maxY,
              orientation: 'vertical',
              position: align.targetValue,
            });
          }
        }

        // 垂直对齐的所有可能性
        const verticalAlignments: VerticalAlignment[] = [
          {
            nodePos: 'top',
            targetPos: 'top',
            nodeValue: nodeBounds.top,
            targetValue: targetBounds.top,
            offset: 0,
          },
          {
            nodePos: 'bottom',
            targetPos: 'bottom',
            nodeValue: nodeBounds.bottom,
            targetValue: targetBounds.bottom,
            offset: nodeBounds.bottom - nodeBounds.top,
          },
          {
            nodePos: 'top',
            targetPos: 'bottom',
            nodeValue: nodeBounds.top,
            targetValue: targetBounds.bottom,
            offset: 0,
          },
          {
            nodePos: 'bottom',
            targetPos: 'top',
            nodeValue: nodeBounds.bottom,
            targetValue: targetBounds.top,
            offset: nodeBounds.bottom - nodeBounds.top,
          },
        ];

        // 寻找最佳垂直对齐并生成辅助线
        for (const align of verticalAlignments) {
          const distance = Math.abs(align.nodeValue - align.targetValue);
          if (distance <= snapThreshold) {
            // 如果是更好的对齐，更新最佳对齐信息
            if (distance < bestVerticalDistance) {
              bestVerticalDistance = distance;
              bestVerticalAlignment = {
                ...align,
                targetNode,
                distance,
              };
            }

            // 生成水平辅助线
            const minX = Math.min(nodeBounds.left, targetBounds.left) - 50;
            const maxX = Math.max(nodeBounds.right, targetBounds.right) + 50;

            lines.push({
              id: `h-${targetNode.id}-${align.targetPos}`,
              from: minX,
              to: maxX,
              orientation: 'horizontal',
              position: align.targetValue,
            });
          }
        }
      }

      // 去重辅助线，避免显示过多
      const uniqueLines = lines.reduce((acc, line) => {
        const key = `${line.orientation}-${line.position.toFixed(2)}`;
        if (!acc.some((l) => `${l.orientation}-${l.position.toFixed(2)}` === key)) {
          acc.push(line);
        }
        return acc;
      }, [] as SnapLine[]);

      return {
        lines: uniqueLines,
        horizontalAlignment: bestHorizontalAlignment,
        verticalAlignment: bestVerticalAlignment,
      };
    },
    [nodes, snapThreshold, viewport],
  );

  // 获取当前的辅助线
  const snapLines = useMemo(() => {
    if (!draggingNodeId) {
      // 如果没有正在拖动但有最近的对齐信息，显示它
      if (lastAlignments && Date.now() - lastAlignments.timestamp < 1000) {
        return lastAlignments.lines;
      }
      return [];
    }

    const { lines, horizontalAlignment, verticalAlignment } = calculateSnapping(draggingNodeId);

    // 保存当前计算结果到 ref
    currentLinesRef.current = lines;
    currentHorizontalAlignmentRef.current = horizontalAlignment;
    currentVerticalAlignmentRef.current = verticalAlignment;

    return lines;
  }, [draggingNodeId, calculateSnapping, lastAlignments]);

  // 处理 lastAlignments 的更新
  useEffect(() => {
    if (draggingNodeId && currentLinesRef.current.length > 0) {
      setLastAlignments({
        nodeId: draggingNodeId,
        lines: [...currentLinesRef.current],
        timestamp: Date.now(),
      });
    }
  }, [draggingNodeId]);

  // 一段时间后清除最近的对齐信息
  useEffect(() => {
    if (!draggingNodeId && lastAlignments) {
      const timer = setTimeout(() => {
        setLastAlignments(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [draggingNodeId, lastAlignments]);

  // 获取磁吸后的位置
  const getSnappedPosition = useCallback(
    (node: Node) => {
      // 如果没有拖动或者节点ID不匹配，返回原始位置
      if (!draggingNodeId || node.id !== draggingNodeId) {
        return { ...node.position };
      }

      const snappedPosition = { ...node.position };

      // 应用水平对齐
      if (currentHorizontalAlignmentRef.current) {
        snappedPosition.x =
          currentHorizontalAlignmentRef.current.targetValue -
          currentHorizontalAlignmentRef.current.offset;
      }

      // 应用垂直对齐
      if (currentVerticalAlignmentRef.current) {
        snappedPosition.y =
          currentVerticalAlignmentRef.current.targetValue -
          currentVerticalAlignmentRef.current.offset;
      }

      return snappedPosition;
    },
    [draggingNodeId],
  );

  return {
    snapLines,
    getSnappedPosition,
  };
};

const SnapLines: React.FC<SnapLinesProps> = ({ snapThreshold = 5 }) => {
  const { snapLines } = useNodeSnapping(snapThreshold);
  const viewport = useViewport();
  const { draggingNodeId } = useEditorPerformance();

  // 转换流坐标到屏幕坐标
  const flowToScreen = useMemo(() => {
    return ({ x, y }: { x: number; y: number }) => ({
      x: x * viewport.zoom + viewport.x,
      y: y * viewport.zoom + viewport.y,
    });
  }, [viewport]);

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
