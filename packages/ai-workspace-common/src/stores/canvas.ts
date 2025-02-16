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

interface NodePreviewData {
  metadata?: {
    rawFileKey?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

type NodePreview = CanvasNode<NodePreviewData> & {
  isPinned?: boolean;
};

interface CanvasConfig {
  localSyncedAt?: number;
  remoteSyncedAt?: number;
  nodePreviews: NodePreview[];
}

export interface CanvasState {
  data: Record<string, CanvasData>;
  config: Record<string, CanvasConfig>;
  currentCanvasId: string | null;
  showPreview: boolean;
  showMaxRatio: boolean;
  showLaunchpad: boolean;
  operatingNodeId: string | null;
  showEdges: boolean;
  clickToPreview: boolean;
  nodeSizeMode: 'compact' | 'adaptive';
  autoLayout: boolean;

  setNodes: (canvasId: string, nodes: CanvasNode<any>[]) => void;
  setEdges: (canvasId: string, edges: Edge[]) => void;
  setTitle: (canvasId: string, title: string) => void;
  setInitialFitViewCompleted: (canvasId: string, completed: boolean) => void;
  deleteCanvasData: (canvasId: string) => void;
  setCurrentCanvasId: (canvasId: string) => void;
  addNodePreview: (canvasId: string, node: NodePreview) => void;
  setNodePreview: (canvasId: string, node: NodePreview) => void;
  removeNodePreview: (canvasId: string, nodeId: string) => void;
  setCanvasLocalSynced: (canvasId: string, syncedAt: number) => void;
  setCanvasRemoteSynced: (canvasId: string, syncedAt: number) => void;
  setShowPreview: (show: boolean) => void;
  setShowMaxRatio: (show: boolean) => void;
  setShowLaunchpad: (show: boolean) => void;
  setOperatingNodeId: (nodeId: string | null) => void;
  setShowEdges: (show: boolean) => void;
  setClickToPreview: (enabled: boolean) => void;
  setNodeSizeMode: (mode: 'compact' | 'adaptive') => void;
  setAutoLayout: (enabled: boolean) => void;
  updateNodePreviewRawFileKey: (canvasId: string, nodeId: string, rawFileKey: string) => void;
  clearState: () => void;
}

const defaultCanvasData: () => CanvasData = () => ({
  nodes: [],
  edges: [],
  title: '',
  initialFitViewCompleted: false,
});

const defaultCanvasConfig: () => CanvasConfig = () => ({
  nodePreviews: [],
});

const defaultCanvasState = () => ({
  data: {},
  config: {},
  currentCanvasId: null,
  showPreview: true,
  showMaxRatio: true,
  showLaunchpad: true,
  operatingNodeId: null,
  showEdges: false,
  clickToPreview: true,
  nodeSizeMode: 'adaptive' as const,
  autoLayout: true,
});

export const useCanvasStore = create<CanvasState>()(
  persist(
    immer((set) => ({
      ...defaultCanvasState(),

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
          state.data[canvasId] ??= defaultCanvasData();
          state.data[canvasId].nodes = nodes;
        }),
      setEdges: (canvasId, edges) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasData();
          state.data[canvasId].edges = edges;
        }),
      setTitle: (canvasId, title) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasData();
          state.data[canvasId].title = title;
        }),
      setInitialFitViewCompleted: (canvasId, completed) =>
        set((state) => {
          state.data[canvasId] ??= defaultCanvasData();
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
      addNodePreview: (canvasId, node) =>
        set((state) => {
          if (!node) return;
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];

          const previews = state.config[canvasId].nodePreviews;
          const existingNodeIndex = previews.findIndex((n) => n.id === node.id);

          // Do nothing if the node already exists
          if (existingNodeIndex !== -1) {
            return;
          }

          if (node.isPinned) {
            // Find the first pinned node index
            const firstPinnedIndex = previews.findIndex((n) => n.isPinned);

            if (firstPinnedIndex === -1) {
              // If no pinned nodes, add after the unpinned node (if exists)
              previews.length > 0 ? previews.splice(1, 0, node) : previews.push(node);
            } else {
              // Insert before the first pinned node
              previews.splice(firstPinnedIndex, 0, node);
            }
          } else {
            // For unpinned node: remove any existing unpinned node and add new one at start
            const unpinnedIndex = previews.findIndex((n) => !n.isPinned);
            if (unpinnedIndex !== -1) {
              previews.splice(unpinnedIndex, 1);
            }
            previews.unshift(node);
          }
        }),
      setNodePreview: (canvasId, node) =>
        set((state) => {
          if (!node) return;
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          const existingNodeIndex = state.config[canvasId].nodePreviews.findIndex(
            (n) => n.id === node.id,
          );
          if (existingNodeIndex !== -1) {
            // If the node is unpinned and not the first one, remove it
            if (!node.isPinned && existingNodeIndex > 0) {
              state.config[canvasId].nodePreviews.splice(existingNodeIndex, 1);
            } else {
              // Otherwise, update the node
              state.config[canvasId].nodePreviews[existingNodeIndex] = node;
            }
          }
        }),
      removeNodePreview: (canvasId, nodeId) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          state.config[canvasId].nodePreviews = state.config[canvasId].nodePreviews.filter(
            (n) => n.id !== nodeId,
          );
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
      setNodeSizeMode: (mode) =>
        set((state) => {
          state.nodeSizeMode = mode;
        }),
      setAutoLayout: (enabled) =>
        set((state) => {
          state.autoLayout = enabled;
        }),
      clearState: () => set(defaultCanvasState()),
      updateNodePreviewRawFileKey: (canvasId, nodeId, rawFileKey) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          state.config[canvasId].nodePreviews = state.config[canvasId].nodePreviews.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    metadata: {
                      ...(n.data?.metadata ?? {}),
                      rawFileKey,
                    },
                  },
                }
              : n,
          );
        }),
    })),
    {
      name: 'canvas-storage',
      partialize: (state) => ({
        config: state.config,
        currentCanvasId: state.currentCanvasId,
        showEdges: state.showEdges,
        showLaunchpad: state.showLaunchpad,
        clickToPreview: state.clickToPreview,
        nodeSizeMode: state.nodeSizeMode,
        autoLayout: state.autoLayout,
      }),
    },
  ),
);

export const useCanvasStoreShallow = <T>(selector: (state: CanvasState) => T) => {
  return useCanvasStore(useShallow(selector));
};
