import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasEdge } from '@refly/openapi-schema';
import { useMemo } from 'react';

const nodesLookupCache = new WeakMap<CanvasNode[], Map<string, CanvasNode>>();

const getNodesLookup = (nodes?: CanvasNode[]) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return new Map<string, CanvasNode>();
  }

  const cachedLookup = nodesLookupCache.get(nodes);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookup = new Map<string, CanvasNode>();
  for (const canvasNode of nodes) {
    if (!canvasNode?.id) {
      continue;
    }
    lookup.set(canvasNode.id, canvasNode);
  }

  nodesLookupCache.set(nodes, lookup);
  return lookup;
};

export const useRealtimeCanvasData = () => {
  const { nodes, edges, nodesSignature } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      // This signature forces re-render when node parent relationships change
      nodesSignature: Array.isArray(state.nodes)
        ? [...state.nodes]
            .map((n) => `${n?.id ?? ''}:${n?.type ?? ''}:${n?.parentId ?? ''}`)
            .sort()
            .join('|')
        : '',
    })),
  );
  const nodesLookup = useMemo(() => getNodesLookup(nodes as CanvasNode[]), [nodes]);

  return {
    nodes: nodes as CanvasNode[],
    edges: edges as CanvasEdge[],
    nodesSignature,
    nodesLookup,
  };
};
