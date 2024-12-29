import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { persist } from 'zustand/middleware';
import { Edge } from '@xyflow/react';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

interface CanvasData {
  nodes: CanvasNode<any>[];
  edges: Edge[];
  title: string;
  initialFitViewCompleted?: boolean;
}

interface CanvasConfig {
  localSyncedAt?: number;
  remoteSyncedAt?: number;
  pinnedNodes: CanvasNode<any>[];
}

export interface CanvasState {
  data: Record<string, CanvasData>;
  config: Record<string, CanvasConfig>;
  currentCanvasId: string | null;
  showPreview: boolean;
  showMaxRatio: boolean;
  showLaunchpad: boolean;
  interactionMode: 'mouse' | 'touchpad';
  operatingNodeId: string | null;
  showEdges: boolean;
  clickToPreview: boolean;

  setNodes: (canvasId: string, nodes: CanvasNode<any>[]) => void;
  setEdges: (canvasId: string, edges: Edge[]) => void;
  setTitle: (canvasId: string, title: string) => void;
  setInitialFitViewCompleted: (canvasId: string, completed: boolean) => void;
  deleteCanvasData: (canvasId: string) => void;
  setCurrentCanvasId: (canvasId: string) => void;
  addPinnedNode: (canvasId: string, node: CanvasNode<any>) => void;
  setCanvasLocalSynced: (canvasId: string, syncedAt: number) => void;
  setCanvasRemoteSynced: (canvasId: string, syncedAt: number) => void;
  removePinnedNode: (canvasId: string, nodeId: string) => void;
  setShowPreview: (show: boolean) => void;
  setShowMaxRatio: (show: boolean) => void;
  setShowLaunchpad: (show: boolean) => void;
  setInteractionMode: (mode: 'mouse' | 'touchpad') => void;
  setOperatingNodeId: (nodeId: string | null) => void;
  setShowEdges: (show: boolean) => void;
  setClickToPreview: (enabled: boolean) => void;
}

const defaultCanvasState: () => CanvasData = () => ({
  nodes: [],
  edges: [],
  title: '',
  initialFitViewCompleted: false,
});

const defaultCanvasConfig: () => CanvasConfig = () => ({
  pinnedNodes: [],
});

export const useCanvasStore = create<CanvasState>()(
  persist(
    immer((set) => ({
      data: {},
      config: {},
      currentCanvasId: null,
      showPreview: true,
      showMaxRatio: false,
      showLaunchpad: true,
      interactionMode: 'touchpad',
      operatingNodeId: null,
      showEdges: false,
      clickToPreview: true,

      deleteCanvasData: (canvasId) =>
        set((state) => {
          delete state.data[canvasId];
          delete state.config[canvasId];
        }),
      setCurrentCanvasId: (canvasId) =>
        set((state) => {
          state.currentCanvasId = canvasId;
        }),
      setShowPreview: (show) =>
        set((state) => {
          state.showPreview = show;
        }),
      setShowMaxRatio: (show) =>
        set((state) => {
          state.showMaxRatio = show;
        }),
      setShowLaunchpad: (show) =>
        set((state) => {
          state.showLaunchpad = show;
        }),
      setNodes: (canvasId, nodes) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasState();
          state.data[canvasId].nodes = nodes;
        }),
      setEdges: (canvasId, edges) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasState();
          state.data[canvasId].edges = edges;
        }),
      setTitle: (canvasId, title) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasState();
          state.data[canvasId].title = title;
        }),
      setInitialFitViewCompleted: (canvasId, completed) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasState();
          state.data[canvasId].initialFitViewCompleted = completed;
        }),
      setCanvasLocalSynced: (canvasId, syncedAt) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].localSyncedAt = syncedAt;
        }),
      setCanvasRemoteSynced: (canvasId, syncedAt) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].remoteSyncedAt = syncedAt;
        }),
      addPinnedNode: (canvasId, node) =>
        set((state) => {
          if (!node) return;
          state.config[canvasId] ??= defaultCanvasConfig();

          state.config[canvasId].pinnedNodes = state.config[canvasId].pinnedNodes.filter((n) => n.id !== node.id);
          state.config[canvasId].pinnedNodes.unshift(node);
        }),
      removePinnedNode: (canvasId, nodeId) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].pinnedNodes = state.config[canvasId].pinnedNodes.filter((n) => n.id !== nodeId);
        }),
      setInteractionMode: (mode) =>
        set((state) => {
          state.interactionMode = mode;
        }),
      setOperatingNodeId: (nodeId) => set({ operatingNodeId: nodeId }),
      setShowEdges: (show) =>
        set((state) => {
          state.showEdges = show;
        }),
      setClickToPreview: (enabled) =>
        set((state) => {
          state.clickToPreview = enabled;
        }),
    })),
    {
      name: 'canvas-storage',
      partialize: (state) => ({
        config: state.config,
        currentCanvasId: state.currentCanvasId,
        interactionMode: state.interactionMode,
        showEdges: state.showEdges,
        showLaunchpad: state.showLaunchpad,
        clickToPreview: state.clickToPreview,
      }),
    },
  ),
);

export const useCanvasStoreShallow = <T>(selector: (state: CanvasState) => T) => {
  return useCanvasStore(useShallow(selector));
};
