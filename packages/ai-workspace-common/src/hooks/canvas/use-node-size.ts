import { useState, useCallback, useMemo, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { useNodeData } from './use-node-data';

export interface NodeSize {
  width: number;
  height: number | 'auto';
  maxHeight?: number;
}

interface UseNodeSizeProps {
  id: string;
  node: Node;
  sizeMode?: 'compact' | 'adaptive';
  isOperating?: boolean;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number | 'auto';
}

export const useNodeSize = ({
  id,
  node,
  sizeMode = 'adaptive',
  isOperating = false,
  minWidth = 100,
  maxWidth = 800,
  minHeight = 80,
  defaultWidth = 288,
  defaultHeight = 384,
}: UseNodeSizeProps) => {
  const { setNodeStyle } = useNodeData();

  // Initialize size from node measurements or defaults
  const initialSize = useMemo(
    (): NodeSize => ({
      width: node?.style?.width
        ? Number.parseInt(node.style.width as string)
        : (node?.measured?.width ?? defaultWidth),
      height: node?.style?.height === 'auto' ? 'auto' : (node?.measured?.height ?? defaultHeight),
      maxHeight: node?.style?.maxHeight
        ? Number.parseInt(node.style.maxHeight as string)
        : undefined,
    }),
    [node?.measured?.width, node?.measured?.height, node?.style, defaultWidth, defaultHeight],
  );

  const [size, setSize] = useState<NodeSize>(initialSize);

  // Update size when node style changes
  const updateSize = useCallback((newSize: Partial<NodeSize>) => {
    setSize((prevSize) => ({ ...prevSize, ...newSize }));
  }, []);

  // Monitor node style changes
  useEffect(() => {
    if (node?.style) {
      setSize({
        width: node.style.width
          ? Number.parseInt(node.style.width as string)
          : (node?.measured?.width ?? defaultWidth),
        height:
          node.style.height === 'auto'
            ? 'auto'
            : Number.parseInt(node.style.height as string) ||
              (node?.measured?.height ?? defaultHeight),
        maxHeight: node.style.maxHeight
          ? Number.parseInt(node.style.maxHeight as string)
          : undefined,
      });
    }
  }, [
    node?.style?.width,
    node?.style?.height,
    node?.style?.maxHeight,
    node?.measured?.width,
    node?.measured?.height,
    defaultWidth,
    defaultHeight,
  ]);

  useEffect(() => {
    if (sizeMode === 'compact') {
      updateSize({ height: 'auto' });
    }
  }, [sizeMode, updateSize]);

  // Handle resize event
  const handleResize = useCallback(
    ({ target, width, height, direction }) => {
      const newWidth = Math.max(minWidth, Math.min(maxWidth, width));
      const newHeight = Math.max(minHeight, height);

      let newLeft = target.offsetLeft;
      let newTop = target.offsetTop;

      if (direction[0] === -1) {
        newLeft = target.offsetLeft - (newWidth - target.offsetWidth);
      }
      if (direction[1] === -1) {
        newTop = target.offsetTop - (newHeight - target.offsetHeight);
      }

      target.style.width = `${newWidth}px`;
      target.style.height = `${newHeight}px`;
      target.style.left = `${newLeft}px`;
      target.style.top = `${newTop}px`;

      updateSize({ width: newWidth, height: newHeight });

      // Update node style
      setNodeStyle(id, {
        width: `${newWidth}px`,
        height: `${newHeight}px`,
      });
    },
    [id, minWidth, maxWidth, minHeight, setNodeStyle, updateSize],
  );

  // Get container style based on current size and mode
  const containerStyle = useMemo(
    (): React.CSSProperties => ({
      position: 'relative',
      width: size.width,
      height: size.height,
      maxHeight: sizeMode === 'compact' ? size.maxHeight : undefined,
      minWidth: sizeMode === 'compact' ? minWidth : defaultWidth,
      maxWidth,
      userSelect: isOperating ? 'text' : 'none',
      cursor: isOperating ? 'text' : 'grab',
    }),
    [size, sizeMode, minWidth, maxWidth, defaultWidth, isOperating, sizeMode],
  );

  return {
    size,
    updateSize,
    handleResize,
    containerStyle,
  };
};
