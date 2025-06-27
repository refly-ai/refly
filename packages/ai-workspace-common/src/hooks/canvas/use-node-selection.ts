import { useCallback } from 'react';
import { Node, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeFilter } from '@refly/canvas-common';

export const useNodeSelection = () => {
  const { getNodes, setNodes } = useReactFlow<CanvasNode<any>>();

  const setSelectedNode = useCallback(
    (node: Node) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          selected: n.id === node?.id,
        })),
      );
    },
    [setNodes],
  );

  const addSelectedNode = useCallback(
    (node: Node) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          selected: n.id === node?.id ? true : n.selected,
        })),
      );
    },
    [setNodes],
  );

  const setSelectedNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      const { type, entityId } = filter;
      const nodes = getNodes();
      const node = nodes.find((node) => node.type === type && node.data?.entityId === entityId);
      if (node) {
        setSelectedNode(node);
      }
    },
    [getNodes, setSelectedNode],
  );

  const addSelectedNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      const { type, entityId } = filter;
      const nodes = getNodes();
      const node = nodes.find((node) => node.type === type && node.data?.entityId === entityId);
      if (node) {
        addSelectedNode(node);
      }
    },
    [getNodes, addSelectedNode],
  );

  const deselectNode = useCallback(
    (node: CanvasNode) => {
      setNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          selected: n.id === node.id ? false : n.selected,
        })),
      );
    },
    [getNodes, setNodes],
  );

  const deselectNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      const { type, entityId } = filter;
      const nodes = getNodes();
      const node = nodes.find((n) => n.type === type && n.data?.entityId === entityId);
      if (node) {
        deselectNode(node);
      }
    },
    [getNodes, deselectNode],
  );

  return {
    setSelectedNode,
    addSelectedNode,
    setSelectedNodeByEntity,
    addSelectedNodeByEntity,
    deselectNode,
    deselectNodeByEntity,
  };
};
