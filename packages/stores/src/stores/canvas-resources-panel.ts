import { CanvasNode } from '@refly/canvas-common';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { DriveFile } from '@refly/openapi-schema';

export type CanvasResourcesPanelMode = 'wide' | 'normal' | 'hidden';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  currentResource: CanvasNode | null;
  currentFile: DriveFile | null;
  sidePanelVisible: boolean;
  wideScreenVisible: boolean;
  // Change from single activeNode to map of canvasId to activeNode
  activeNodes: Record<string, CanvasNode | null>;
  searchKeyword: string;
  showWorkflowRun: boolean;
  toolsDependencyOpen: Record<string, boolean>;
  toolsDependencyHighlight: Record<string, boolean>;

  // Methods
  setCurrentResource: (resource: CanvasNode | null) => void;
  setCurrentFile: (file: DriveFile | null) => void;
  setSidePanelVisible: (visible: boolean) => void;
  setWideScreenVisible: (visible: boolean) => void;
  // Update setActiveNode to accept canvasId parameter
  setActiveNode: (canvasId: string, node: CanvasNode | null) => void;
  // Add helper method to get activeNode for a specific canvas
  getActiveNode: (canvasId: string) => CanvasNode | null;
  setSearchKeyword: (keyword: string) => void;
  setShowWorkflowRun: (show: boolean) => void;
  setToolsDependencyOpen: (canvasId: string, open: boolean) => void;
  setToolsDependencyHighlight: (canvasId: string, highlight: boolean) => void;
  resetToolsDependency: (canvasId: string) => void;
  resetState: () => void;
}

const defaultState = {
  currentResource: null,
  currentFile: null,
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
      toolsDependencyOpen: {},
      toolsDependencyHighlight: {},
      ...defaultState,

      // Methods
      setCurrentResource: (resource: CanvasNode | null) => set({ currentResource: resource }),
      setCurrentFile: (file: DriveFile | null) => set({ currentFile: file }),
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
      setToolsDependencyOpen: (canvasId: string, open: boolean) =>
        set((state) => ({
          toolsDependencyOpen: {
            ...state.toolsDependencyOpen,
            [canvasId]: open,
          },
        })),
      setToolsDependencyHighlight: (canvasId: string, highlight: boolean) =>
        set((state) => ({
          toolsDependencyHighlight: {
            ...state.toolsDependencyHighlight,
            [canvasId]: highlight,
          },
        })),
      resetToolsDependency: (canvasId: string) =>
        set((state) => {
          const { [canvasId]: _open, ...restOpen } = state.toolsDependencyOpen;
          const { [canvasId]: _highlight, ...restHighlight } = state.toolsDependencyHighlight;
          return {
            toolsDependencyOpen: restOpen,
            toolsDependencyHighlight: restHighlight,
          };
        }),
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
