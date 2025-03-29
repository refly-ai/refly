import { useCallback } from 'react';
import { CanvasNode, CanvasNodeData } from '../../components/canvas/nodes';
import { CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';

export const useNodeData = () => {
  const { setNodes } = useReactFlow<CanvasNode<any>>();

  const setNodeData = useCallback(
    <T = any>(nodeId: string, nodeData: Partial<CanvasNodeData<T>>) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          data:
            n.id === nodeId
              ? { ...n.data, ...nodeData, metadata: { ...n.data?.metadata, ...nodeData?.metadata } }
              : n.data,
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

  return {
    setNodeData,
    setNodeStyle,
  };
};
