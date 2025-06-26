import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import {
  CanvasNodeData,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/types';
import {
  createAutoEvictionStorage,
  CacheInfo,
} from '@refly-packages/ai-workspace-common/stores/utils/storage-manager';

interface NodePreviewData {
  metadata?: Record<string, unknown>;
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

export interface LinearThreadMessage {
  id: string;
  resultId: string;
  nodeId: string;
  timestamp: number;
  data: CanvasNodeData<ResponseNodeMeta>;
}

export interface CanvasState {
  config: Record<string, CanvasConfig & CacheInfo>;
  currentCanvasId: string | null;
  initialFitViewCompleted?: boolean;
  showPreview: boolean;
  showMaxRatio: boolean;
  showLaunchpad: boolean;
  operatingNodeId: string | null;
  showEdges: boolean;
  clickToPreview: boolean;
  nodeSizeMode: 'compact' | 'adaptive';
  autoLayout: boolean;
  showTemplates: boolean;
  showLinearThread: boolean;
  showSlideshow: boolean;
  linearThreadMessages: (LinearThreadMessage & CacheInfo)[];
  tplConfig: Record<string, any> | null;
  canvasPage: Record<string, string>;
  contextMenuOpenedCanvasId: string | null;

  setInitialFitViewCompleted: (completed: boolean) => void;
  deleteCanvasData: (canvasId: string) => void;
  setCurrentCanvasId: (canvasId: string) => void;
  addNodePreview: (canvasId: string, node: NodePreview) => void;
  setNodePreview: (canvasId: string, node: NodePreview) => void;
  removeNodePreview: (canvasId: string, nodeId: string) => void;
  updateNodePreview: (canvasId: string, node: NodePreview) => void;
  reorderNodePreviews: (canvasId: string, sourceIndex: number, targetIndex: number) => void;
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
  setShowTemplates: (show: boolean) => void;
  setShowLinearThread: (show: boolean) => void;
  setShowSlideshow: (show: boolean) => void;
  addLinearThreadMessage: (message: Omit<LinearThreadMessage, 'timestamp'>) => void;
  removeLinearThreadMessage: (id: string) => void;
  removeLinearThreadMessageByNodeId: (nodeId: string) => void;
  clearLinearThreadMessages: () => void;
  setTplConfig: (config: Record<string, any> | null) => void;
  clearState: () => void;
  setCanvasPage: (canvasId: string, pageId: string) => void;
  setContextMenuOpenedCanvasId: (canvasId: string | null) => void;
}

const defaultCanvasConfig: () => CanvasConfig = () => ({
  nodePreviews: [],
});

const defaultCanvasState = () => ({
  config: {},
  currentCanvasId: null,
  initialFitViewCompleted: false,
  showPreview: true,
  showMaxRatio: true,
  showLaunchpad: true,
  operatingNodeId: null,
  showEdges: true,
  clickToPreview: true,
  nodeSizeMode: 'compact' as const,
  autoLayout: false,
  showTemplates: true,
  showLinearThread: false,
  showSlideshow: false,
  linearThreadMessages: [],
  tplConfig: null,
  canvasPage: {},
  contextMenuOpenedCanvasId: null,
});

// Create our custom storage with appropriate configuration
const canvasStorage = createAutoEvictionStorage();

export const useCanvasStore = create<CanvasState>()(
  persist(
    immer((set) => ({
      ...defaultCanvasState(),

      deleteCanvasData: (canvasId) =>
        set((state) => {
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
      setInitialFitViewCompleted: (completed) =>
        set((state) => {
          state.initialFitViewCompleted = completed;
        }),
      setCanvasLocalSynced: (canvasId, syncedAt) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].localSyncedAt = syncedAt;
          state.config[canvasId].lastUsedAt = Date.now();
        }),
      setCanvasRemoteSynced: (canvasId, syncedAt) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].remoteSyncedAt = syncedAt;
          state.config[canvasId].lastUsedAt = Date.now();
        }),
      addNodePreview: (canvasId, node) =>
        set((state) => {
          if (!node) return;
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          state.config[canvasId].lastUsedAt = Date.now();

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
            state.config[canvasId].lastUsedAt = Date.now();
          }
        }),
      removeNodePreview: (canvasId, nodeId) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          state.config[canvasId].nodePreviews = state.config[canvasId].nodePreviews.filter(
            (n) => n.id !== nodeId,
          );
          state.config[canvasId].lastUsedAt = Date.now();
        }),
      updateNodePreview: (canvasId, node) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];
          state.config[canvasId].nodePreviews = state.config[canvasId].nodePreviews.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    ...(node.data || {}),
                  },
                  ...(node.data ? {} : node),
                }
              : n,
          );
          state.config[canvasId].lastUsedAt = Date.now();
        }),
      reorderNodePreviews: (canvasId, sourceIndex, targetIndex) =>
        set((state) => {
          state.config[canvasId] ??= defaultCanvasConfig();
          state.config[canvasId].nodePreviews ??= [];

          const previews = [...state.config[canvasId].nodePreviews];
          const [removed] = previews.splice(sourceIndex, 1);
          previews.splice(targetIndex, 0, removed);

          state.config[canvasId].nodePreviews = previews;
          state.config[canvasId].lastUsedAt = Date.now();
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
      setShowTemplates: (show) =>
        set((state) => {
          state.showTemplates = show;
        }),
      setShowLinearThread: (show) =>
        set((state) => {
          state.showLinearThread = show;
        }),
      setShowSlideshow: (show) =>
        set((state) => {
          state.showSlideshow = show;
        }),
      addLinearThreadMessage: (message) =>
        set((state) => {
          state.linearThreadMessages.push({
            ...message,
            timestamp: Date.now(),
            lastUsedAt: Date.now(),
          });
        }),
      removeLinearThreadMessage: (id) =>
        set((state) => {
          state.linearThreadMessages = state.linearThreadMessages.filter(
            (message) => message.id !== id,
          );
        }),
      removeLinearThreadMessageByNodeId: (nodeId) =>
        set((state) => {
          state.linearThreadMessages = state.linearThreadMessages.filter(
            (message) => message.nodeId !== nodeId,
          );
        }),
      clearLinearThreadMessages: () =>
        set((state) => {
          state.linearThreadMessages = [];
        }),
      setTplConfig: (config) =>
        set((state) => {
          state.tplConfig = config;
        }),
      clearState: () => set(defaultCanvasState()),
      setCanvasPage: (canvasId, pageId) =>
        set((state) => {
          state.canvasPage[canvasId] = pageId;
        }),
      setContextMenuOpenedCanvasId: (canvasId) =>
        set((state) => {
          state.contextMenuOpenedCanvasId = canvasId;
        }),
    })),
    {
      name: 'canvas-storage',
      storage: createJSONStorage(() => canvasStorage),
      partialize: (state) => ({
        config: state.config,
        currentCanvasId: state.currentCanvasId,
        showEdges: state.showEdges,
        showLaunchpad: state.showLaunchpad,
        clickToPreview: state.clickToPreview,
        nodeSizeMode: state.nodeSizeMode,
        showLinearThread: state.showLinearThread,
        linearThreadMessages: state.linearThreadMessages,
        showSlideshow: state.showSlideshow,
        canvasPage: state.canvasPage,
      }),
    },
  ),
);

export const useCanvasStoreShallow = <T>(selector: (state: CanvasState) => T) => {
  return useCanvasStore(useShallow(selector));
};
