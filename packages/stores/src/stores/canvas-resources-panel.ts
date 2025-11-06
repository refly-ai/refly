import { CanvasNode } from '@refly/canvas-common';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesPanelMode = 'wide' | 'normal' | 'hidden';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  currentResource: CanvasNode | null;
  sidePanelVisible: boolean;
  wideScreenVisible: boolean;
  // Change from single activeNode to map of canvasId to activeNode
  activeNodes: Record<string, CanvasNode | null>;
  searchKeyword: string;
  showWorkflowRun: boolean;

  // Methods
  setCurrentResource: (resource: CanvasNode | null) => void;
  setSidePanelVisible: (visible: boolean) => void;
  setWideScreenVisible: (visible: boolean) => void;
  // Update setActiveNode to accept canvasId parameter
  setActiveNode: (canvasId: string, node: CanvasNode | null) => void;
  // Add helper method to get activeNode for a specific canvas
  getActiveNode: (canvasId: string) => CanvasNode | null;
  setSearchKeyword: (keyword: string) => void;
  setShowWorkflowRun: (show: boolean) => void;
  resetState: () => void;
}

const defaultState = {
  currentResource: null,
  sidePanelVisible: false,
  wideScreenVisible: false,
  searchKeyword: '',
  showWorkflowRun: false,
};

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set, get) => ({
      // Default state
      activeNodes: {},
      ...defaultState,

      // Methods
      setCurrentResource: (resource: CanvasNode | null) => set({ currentResource: resource }),
      setSidePanelVisible: (visible: boolean) => set({ sidePanelVisible: visible }),
      setWideScreenVisible: (visible: boolean) => set({ wideScreenVisible: visible }),
      // Update setActiveNode to handle canvasId
      setActiveNode: (canvasId: string, node: CanvasNode | null) =>
        set((state) => ({
          activeNodes: {
            ...state.activeNodes,
            [canvasId]: node,
          },
        })),
      // Add helper method to get activeNode for a specific canvas
      getActiveNode: (canvasId: string) => {
        const state = get();
        return state.activeNodes[canvasId] ?? null;
      },
      setSearchKeyword: (keyword: string) => set({ searchKeyword: keyword }),
      setShowWorkflowRun: (show: boolean) => {
        set({ showWorkflowRun: show });
      },
      resetState: () => set(defaultState),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
        activeNodes: state.activeNodes,
        wideScreenVisible: state.wideScreenVisible,
        showWorkflowRun: state.showWorkflowRun,
      }),
    },
  ),
);

export const useCanvasResourcesPanelStoreShallow = <T>(
  selector: (state: CanvasResourcesPanelState) => T,
) => {
  return useCanvasResourcesPanelStore(useShallow(selector));
};

export const useActiveNode = (canvasId: string) => {
  const activeNode = useCanvasResourcesPanelStore((state) => state.activeNodes[canvasId] ?? null);
  const setActiveNodeImpl = useCanvasResourcesPanelStore((state) => state.setActiveNode);

  const setActiveNode = useCallback(
    (node: CanvasNode | null) => setActiveNodeImpl(canvasId, node),
    [canvasId, setActiveNodeImpl],
  );

  return useMemo(() => ({ activeNode, setActiveNode }), [activeNode, setActiveNode]);
};
