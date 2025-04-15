import { useState, useCallback, useMemo, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { useNodeData } from './use-node-data';

export const MAX_HEIGHT = 1200;
export const MAX_HEIGHT_CLASS = 'max-h-[1200px]';
const COMPACT_MAX_HEIGHT = 384;

const getMaxHeight = (height: number) => {
  return Math.min(height, MAX_HEIGHT);
};

export interface NodeSize {
  width: number;
  height: number | 'auto';
  maxHeight?: number;
}

interface UseNodeSizeProps {
  id: string;
  node: Node;
  sizeMode?: 'compact' | 'adaptive';
  readonly?: boolean;
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
  readonly = false,
  sizeMode = 'adaptive',
  isOperating = false,
  minWidth = 100,
  maxWidth = 800,
  minHeight = 80,
  defaultWidth = 288,
  defaultHeight = 384,
}: UseNodeSizeProps) => {
  const { setNodeStyle } = useNodeData();

  const containerMaxHeight = useMemo(() => {
    return sizeMode === 'compact' ? COMPACT_MAX_HEIGHT : MAX_HEIGHT;
  }, [sizeMode]);

  // Initialize size from node measurements or defaults
  const initialSize = useMemo(
    (): NodeSize => ({
      width: node?.style?.width
        ? Number.parseInt(node.style.width as string)
        : (node?.measured?.width ?? defaultWidth),
      height:
        sizeMode === 'compact' || node?.style?.height === 'auto'
          ? 'auto'
          : getMaxHeight(Number(node?.measured?.height ?? defaultHeight)),
      maxHeight: containerMaxHeight,
    }),
    [node?.measured?.width, node?.measured?.height, node?.style, defaultWidth, defaultHeight],
  );

  const [size, setSize] = useState<NodeSize>(initialSize);

  // Update size when node style changes
  const updateSize = useCallback((newSize: Partial<NodeSize>) => {
    setSize((prevSize) => ({ ...prevSize, ...newSize }));
  }, []);

  useEffect(() => {
    const height = size.height === 'auto' ? 'auto' : `${Math.max(size.height, minHeight)}px`;

    setNodeStyle(id, {
      width: `${size.width}px`,
      height,
      maxHeight: size.maxHeight,
    });
  }, [id]);

  // Monitor node style changes
  useEffect(() => {
    if (node?.style) {
      setSize({
        width: node.style.width
          ? Number.parseInt(node.style.width as string)
          : (node?.measured?.width ?? defaultWidth),
        height:
          sizeMode === 'compact' || node?.style?.height === 'auto'
            ? 'auto'
            : getMaxHeight(
                Number.parseInt(node.style.height as string) ||
                  Number(node?.measured?.height ?? defaultHeight),
              ),
        maxHeight: containerMaxHeight,
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
      const newHeight = Math.max(minHeight, Math.min(height, MAX_HEIGHT));

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
        maxHeight: MAX_HEIGHT,
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
      maxHeight: containerMaxHeight,
      minWidth: sizeMode === 'compact' ? minWidth : defaultWidth,
      maxWidth,
      userSelect: isOperating ? 'text' : 'none',
      cursor: readonly ? 'default' : isOperating ? 'text' : 'grab',
    }),
    [size, sizeMode, minWidth, maxWidth, defaultWidth, isOperating, sizeMode, readonly],
  );

  return {
    size,
    updateSize,
    handleResize,
    containerStyle,
  };
};
