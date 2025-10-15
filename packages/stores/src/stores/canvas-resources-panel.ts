import { CanvasNode } from '@refly/canvas-common';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesPanelMode = 'wide' | 'normal' | 'hidden';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  panelWidth: number;
  sidePanelVisible: boolean;
  wideScreenVisible: boolean;
  showLeftOverview: boolean;
  parentType: CanvasResourcesParentType | null;
  activeTab: CanvasResourcesParentType;
  // Change from single activeNode to map of canvasId to activeNode
  activeNodes: Record<string, CanvasNode | null>;
  searchKeyword: string;
  showWorkflowRun: boolean;
  showCopilot: boolean;

  // Methods
  setPanelWidth: (width: number) => void;
  setSidePanelVisible: (visible: boolean) => void;
  setWideScreenVisible: (visible: boolean) => void;
  setShowLeftOverview: (show: boolean) => void;
  setParentType: (type: CanvasResourcesParentType | null) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  // Update setActiveNode to accept canvasId parameter
  setActiveNode: (canvasId: string, node: CanvasNode | null) => void;
  // Add helper method to get activeNode for a specific canvas
  getActiveNode: (canvasId: string) => CanvasNode | null;
  setSearchKeyword: (keyword: string) => void;
  setShowWorkflowRun: (show: boolean) => void;
  setShowCopilot: (show: boolean) => void;
  resetState: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;
const defaultState = {
  sidePanelVisible: true,
  wideScreenVisible: false,
  showLeftOverview: false,
  parentType: null,
  activeTab: 'stepsRecord' as const,
  // Initialize activeNodes as empty object
  searchKeyword: '',
  showWorkflowRun: false,
  showCopilot: false,
};

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set, get) => ({
      // Default state
      panelWidth: DEFAULT_PANEL_WIDTH,
      activeNodes: {},
      ...defaultState,

      // Methods
      setPanelWidth: (width: number) => set({ panelWidth: width }),
      setSidePanelVisible: (visible: boolean) => set({ sidePanelVisible: visible }),
      setWideScreenVisible: (visible: boolean) => set({ wideScreenVisible: visible }),
      setShowLeftOverview: (show: boolean) => set({ showLeftOverview: show }),
      setParentType: (type: CanvasResourcesParentType | null) => set({ parentType: type }),
      setActiveTab: (tab: CanvasResourcesParentType) => set({ activeTab: tab }),
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
        if (show) {
          set({ showWorkflowRun: show, showCopilot: false, sidePanelVisible: true });
        } else {
          set({ showWorkflowRun: show });
        }
      },
      setShowCopilot: (show: boolean) => {
        if (show) {
          set({ showCopilot: show, showWorkflowRun: false, sidePanelVisible: true });
        } else {
          set({ showCopilot: show });
        }
      },
      resetState: () => set(defaultState),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
        activeTab: state.activeTab,
        // Persist activeNodes for all canvases
        activeNodes: state.activeNodes,
        parentType: state.parentType,
        panelWidth: state.panelWidth,
        sidePanelVisible: state.sidePanelVisible,
        wideScreenVisible: state.wideScreenVisible,
        showWorkflowRun: state.showWorkflowRun,
        showCopilot: state.showCopilot,
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
