import { useCallback } from 'react';
import { CanvasNode, CanvasNodeData } from '@refly/canvas-common';
import { CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import { deepmerge } from '@refly/utils';

export const useNodeData = () => {
  const { setNodes } = useReactFlow<CanvasNode<any>>();

  const setNodeData = useCallback(
    <T = any>(nodeId: string, nodeData: Partial<CanvasNodeData<T>>) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          data: n.id === nodeId ? deepmerge(n.data, nodeData) : n.data,
        })),
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
