import { useCallback } from 'react';
import { CanvasNode, CanvasNodeData } from '@refly/canvas-common';
import { CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import { deepmerge } from '@refly/utils';

export const useNodeData = () => {
  const { setNodes } = useReactFlow<CanvasNode<any>>();

  const setNodeData = useCallback(
    <T = any>(
      nodeId: string,
      nodeData:
        | Partial<CanvasNodeData<T>>
        | ((prevData: CanvasNodeData<T>) => Partial<CanvasNodeData<T>>),
    ) => {
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== nodeId) {
            return n;
          }

          const prevData = (n?.data ?? {}) as CanvasNodeData<T>;
          const nextData = typeof nodeData === 'function' ? nodeData(prevData) : nodeData;

          return {
            ...n,
            data: deepmerge(prevData, nextData ?? {}),
          };
        }),
      );
    },
    [setNodes],
  );

  const setNodeStyle = useCallback(
    (nodeId: string, style: Partial<CSSProperties>) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          style: n.id === nodeId ? { ...n.style, ...style } : n.style,
        })),
      );
    },
    [setNodes],
  );

  const setNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          position: n.id === nodeId ? position : n.position,
        })),
      );
    },
    [setNodes],
  );

  return {
    setNodeData,
    setNodeStyle,
    setNodePosition,
  };
};
