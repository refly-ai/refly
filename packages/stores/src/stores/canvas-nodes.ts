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

  setPendingNode: (node: any) => void;
  clearPendingNode: () => void;
  setHighlightedNodeId: (nodeId: string | null) => void;
}

export const useCanvasNodesStore = create<CanvasNodesState>((set) => ({
  pendingNode: null,
  setPendingNode: (node) => set({ pendingNode: node }),
  clearPendingNode: () => set({ pendingNode: null }),
  highlightedNodeId: null,
  setHighlightedNodeId: (nodeId: string | null) => set({ highlightedNodeId: nodeId }),
}));

export const useCanvasNodesStoreShallow = <T>(selector: (state: CanvasNodesState) => T) => {
  return useCanvasNodesStore(useShallow(selector));
};
