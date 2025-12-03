import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { type CanvasNodeType } from '@refly/openapi-schema';

interface CanvasNodesState {
  pendingNode: {
    type: CanvasNodeType;
    data: any;
    position: { x: number; y: number };
  } | null;
  highlightedNodeId?: string | null;
  highlightedNodeIds?: Set<string>;

  setPendingNode: (node: any) => void;
  clearPendingNode: () => void;
  setHighlightedNodeId: (nodeId: string | null) => void;
  setHighlightedNodeIds: (nodeIds: string[] | null) => void;
  clearHighlightedNodeIds: () => void;
}

export const useCanvasNodesStore = create<CanvasNodesState>((set) => ({
  pendingNode: null,
  setPendingNode: (node) => set({ pendingNode: node }),
  clearPendingNode: () => set({ pendingNode: null }),
  highlightedNodeId: null,
  setHighlightedNodeId: (nodeId: string | null) => set({ highlightedNodeId: nodeId }),
  highlightedNodeIds: undefined,
  setHighlightedNodeIds: (nodeIds: string[] | null) =>
    set({
      highlightedNodeIds: nodeIds && nodeIds.length > 0 ? new Set(nodeIds) : undefined,
    }),
  clearHighlightedNodeIds: () => set({ highlightedNodeIds: undefined }),
}));

export const useCanvasNodesStoreShallow = <T>(selector: (state: CanvasNodesState) => T) => {
  return useCanvasNodesStore(useShallow(selector));
};
