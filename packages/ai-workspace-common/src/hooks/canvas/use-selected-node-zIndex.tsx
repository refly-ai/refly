import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

export const useSelectedNodeZIndex = (id: string, selected: boolean) => {
  const { getNode, setNodes, getNodes, setEdges } = useReactFlow();
  const nodeType = getNode(id)?.type;

  const setNodeAndEdgeIndex = (zIndexForGroup: number, type: 'create' | 'destory') => {
    const newZIndex = type === 'destory' ? 0 : selected ? 1 : -1;
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id || type === 'destory') {
          return { ...node, style: { ...node.style, zIndex: newZIndex } };
        }
        // Also set child nodes zIndex when parent group is selected
        if (node.parentId === id && selected) {
          return { ...node, style: { ...node.style, zIndex: zIndexForGroup } };
        }
        return node;
      }),
    );

    // Also update edges between children of this group
    const childNodeIds = getNodes()
      .filter((node) => node.parentId === id)
      .map((node) => node.id);

    setEdges((edges) =>
      edges.map((edge) => {
        if (type === 'destory') {
          return { ...edge, zIndex: newZIndex };
        }

        const sourceInGroup = childNodeIds.includes(edge.source);
        const targetInGroup = childNodeIds.includes(edge.target);

        if (sourceInGroup && targetInGroup && selected) {
          return { ...edge, zIndex: zIndexForGroup };
        }

        return edge;
      }),
    );
  };

  useEffect(() => {
    const handleGroupSelection = () => {
      setNodeAndEdgeIndex(2, 'create');
    };

    const handleGroupDeselection = () => {
      setNodeAndEdgeIndex(0, 'destory');
    };

    if (nodeType === 'group') {
      handleGroupSelection();
    } else {
      setNodes((nodes) => {
        return nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              style: {
                ...node.style,
                zIndex: selected ? 1000 : node.parentId && getNode(node.parentId)?.selected ? 2 : 0,
              },
            };
          }
          return node;
        });
      });
    }

    return () => {
      if (nodeType === 'group') {
        handleGroupDeselection();
      }
    };
  }, [id, selected, getNode, setNodes, getNodes, setEdges]);
};
