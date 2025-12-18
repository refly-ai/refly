import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

export const useSelectedNodeZIndex = (id: string, selected: boolean) => {
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            style: {
              ...node.style,
              zIndex: selected ? 1000 : node.type === 'memo' ? 0 : 1,
            },
          };
        }
        return node;
      });
    });
  }, [id, selected, setNodes]);
};
