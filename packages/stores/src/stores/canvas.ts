import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CanvasNode, CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { createAutoEvictionStorage, CacheInfo } from '../utils/storage';
import { WorkflowNodeExecution, WorkflowVariable } from '@refly/openapi-schema';

interface NodePreviewData {
  metadata?: Record<string, unknown>;
  [key: string]: any;
}

type NodePreview = CanvasNode<NodePreviewData> & {
  isPinned?: boolean;
};

interface CanvasConfig {
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
  nodeSizeMode: 'compact' | 'adaptive';
  showTemplates: boolean;
  showSlideshow: boolean;
  linearThreadMessages: (LinearThreadMessage & CacheInfo)[];
  tplConfig: Record<string, any> | null;
  canvasPage: Record<string, string>;
  contextMenuOpenedCanvasId: string | null;
  canvasTitle: Record<string, string>;
  canvasInitialized: Record<string, boolean>;
  canvasInitializedAt: Record<string, number | undefined>;
  canvasExecutionId: Record<string, string>;
  canvasNodeExecutions: Record<string, WorkflowNodeExecution[]>;
  canvasVariables: Record<string, WorkflowVariable[] | undefined>;

  setInitialFitViewCompleted: (completed: boolean) => void;
  deleteCanvasData: (canvasId: string) => void;
  setCurrentCanvasId: (canvasId: string | null) => void;
  addNodePreview: (canvasId: string, node: NodePreview) => void;
  setNodePreview: (canvasId: string, node: NodePreview) => void;
  removeNodePreview: (canvasId: string, nodeId: string) => void;
  updateNodePreview: (canvasId: string, node: NodePreview) => void;
  reorderNodePreviews: (canvasId: string, sourceIndex: number, targetIndex: number) => void;
  setShowPreview: (show: boolean) => void;
  setShowMaxRatio: (show: boolean) => void;
  setShowLaunchpad: (show: boolean) => void;
  setOperatingNodeId: (nodeId: string | null) => void;
  setShowEdges: (show: boolean) => void;
  setNodeSizeMode: (mode: 'compact' | 'adaptive') => void;
  setShowTemplates: (show: boolean) => void;
  setShowSlideshow: (show: boolean) => void;
  addLinearThreadMessage: (message: Omit<LinearThreadMessage, 'timestamp'>) => void;
  removeLinearThreadMessage: (id: string) => void;
  removeLinearThreadMessageByNodeId: (nodeId: string) => void;
  clearLinearThreadMessages: () => void;
  setTplConfig: (config: Record<string, any> | null) => void;
  clearState: () => void;
  setCanvasPage: (canvasId: string, pageId: string) => void;
  setContextMenuOpenedCanvasId: (canvasId: string | null) => void;
  setCanvasTitle: (canvasId: string, title: string) => void;
  setCanvasInitialized: (canvasId: string, initialized: boolean) => void;
  setCanvasExecutionId: (canvasId: string, executionId: string | null) => void;
  setCanvasNodeExecutions: (
    canvasId: string,
    nodeExecutions: WorkflowNodeExecution[] | null,
  ) => void;
  setCanvasVariables: (canvasId: string, variables: WorkflowVariable[]) => void;
}

const defaultCanvasConfig = (): CanvasConfig => ({
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
  nodeSizeMode: 'compact' as const,
  showTemplates: true,
  showSlideshow: false,
  linearThreadMessages: [],
  tplConfig: null,
  canvasPage: {},
  contextMenuOpenedCanvasId: null,
  canvasTitle: {},
  canvasInitialized: {},
  canvasInitializedAt: {},
  canvasExecutionId: {},
  canvasNodeExecutions: {},
  canvasVariables: {},
});

// Create our custom storage with appropriate configuration
const canvasStorage = createAutoEvictionStorage();

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set) => ({
      ...defaultCanvasState(),

      deleteCanvasData: (canvasId) =>
        set((state) => {
          const newConfig = { ...state.config };
          delete newConfig[canvasId];
          return { ...state, config: newConfig };
        }),

      setCurrentCanvasId: (canvasId) =>
        set((state) => ({
          ...state,
          currentCanvasId: canvasId,
        })),

      setShowPreview: (show) =>
        set((state) => ({
          ...state,
          showPreview: show,
        })),

      setShowMaxRatio: (show) =>
        set((state) => ({
          ...state,
          showMaxRatio: show,
        })),

      setShowLaunchpad: (show) =>
        set((state) => ({
          ...state,
          showLaunchpad: show,
        })),

      setInitialFitViewCompleted: (completed) =>
        set((state) => ({
          ...state,
          initialFitViewCompleted: completed,
        })),

      addNodePreview: (canvasId, node) =>
        set((state) => {
          if (!node) return state;

          const currentConfig = state.config[canvasId] ?? defaultCanvasConfig();
          const currentPreviews = currentConfig.nodePreviews ?? [];
          const existingNodeIndex = currentPreviews.findIndex((n) => n.id === node.id);

          // Do nothing if the node already exists
          if (existingNodeIndex !== -1) {
            return state;
          }

          let newPreviews: NodePreview[];

          if (node.isPinned) {
            // Find the first pinned node index
            const firstPinnedIndex = currentPreviews.findIndex((n) => n.isPinned);

            if (firstPinnedIndex === -1) {
              // If no pinned nodes, add after the unpinned node (if exists)
              newPreviews =
                currentPreviews.length > 0
                  ? [...currentPreviews.slice(0, 1), node, ...currentPreviews.slice(1)]
                  : [node];
            } else {
              // Insert before the first pinned node
              newPreviews = [
                ...currentPreviews.slice(0, firstPinnedIndex),
                node,
                ...currentPreviews.slice(firstPinnedIndex),
              ];
            }
          } else {
            // For unpinned node: remove any existing unpinned node and add new one at start
            const unpinnedIndex = currentPreviews.findIndex((n) => !n.isPinned);
            if (unpinnedIndex !== -1) {
              newPreviews = [
                node,
                ...currentPreviews.slice(0, unpinnedIndex),
                ...currentPreviews.slice(unpinnedIndex + 1),
              ];
            } else {
              newPreviews = [node, ...currentPreviews];
            }
          }

          return {
            ...state,
            config: {
              ...state.config,
              [canvasId]: {
                ...currentConfig,
                nodePreviews: newPreviews,
                lastUsedAt: Date.now(),
              },
            },
          };
        }),

      setNodePreview: (canvasId, node) =>
        set((state) => {
          if (!node) return state;

          const currentConfig = state.config[canvasId] ?? defaultCanvasConfig();
          const currentPreviews = currentConfig.nodePreviews ?? [];
          const existingNodeIndex = currentPreviews.findIndex((n) => n.id === node.id);

          if (existingNodeIndex !== -1) {
            let newPreviews: NodePreview[];

            // If the node is unpinned and not the first one, remove it
            if (!node.isPinned && existingNodeIndex > 0) {
              newPreviews = [
                ...currentPreviews.slice(0, existingNodeIndex),
                ...currentPreviews.slice(existingNodeIndex + 1),
              ];
            } else {
              // Otherwise, update the node
              newPreviews = [
                ...currentPreviews.slice(0, existingNodeIndex),
                node,
                ...currentPreviews.slice(existingNodeIndex + 1),
              ];
            }

            return {
              ...state,
              config: {
                ...state.config,
                [canvasId]: {
                  ...currentConfig,
                  nodePreviews: newPreviews,
                  lastUsedAt: Date.now(),
                },
              },
            };
          }

          return state;
        }),

      removeNodePreview: (canvasId, nodeId) =>
        set((state) => {
          const currentConfig = state.config[canvasId] ?? defaultCanvasConfig();
          const currentPreviews = currentConfig.nodePreviews ?? [];
          const newPreviews = currentPreviews.filter((n) => n.id !== nodeId);

          return {
            ...state,
            config: {
              ...state.config,
              [canvasId]: {
                ...currentConfig,
                nodePreviews: newPreviews,
                lastUsedAt: Date.now(),
              },
            },
          };
        }),

      updateNodePreview: (canvasId, node) =>
        set((state) => {
          const currentConfig = state.config[canvasId] ?? defaultCanvasConfig();
          const currentPreviews = currentConfig.nodePreviews ?? [];
          const newPreviews = currentPreviews.map((n) =>
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

          return {
            ...state,
            config: {
              ...state.config,
              [canvasId]: {
                ...currentConfig,
                nodePreviews: newPreviews,
                lastUsedAt: Date.now(),
              },
            },
          };
        }),

      reorderNodePreviews: (canvasId, sourceIndex, targetIndex) =>
        set((state) => {
          const currentConfig = state.config[canvasId] ?? defaultCanvasConfig();
          const currentPreviews = currentConfig.nodePreviews ?? [];

          const newPreviews = [...currentPreviews];
          const [removed] = newPreviews.splice(sourceIndex, 1);
          if (removed) {
            newPreviews.splice(targetIndex, 0, removed);
          }

          return {
            ...state,
            config: {
              ...state.config,
              [canvasId]: {
                ...currentConfig,
                nodePreviews: newPreviews,
                lastUsedAt: Date.now(),
              },
            },
          };
        }),

      setOperatingNodeId: (nodeId) =>
        set((state) => ({
          ...state,
          operatingNodeId: nodeId,
        })),

      setShowEdges: (show) =>
        set((state) => ({
          ...state,
          showEdges: show,
        })),

      setNodeSizeMode: (mode) =>
        set((state) => ({
          ...state,
          nodeSizeMode: mode,
        })),

      setShowTemplates: (show) =>
        set((state) => ({
          ...state,
          showTemplates: show,
        })),

      setShowSlideshow: (show) =>
        set((state) => ({
          ...state,
          showSlideshow: show,
        })),

      addLinearThreadMessage: (message) =>
        set((state) => ({
          ...state,
          linearThreadMessages: [
            ...state.linearThreadMessages,
            {
              ...message,
              timestamp: Date.now(),
              lastUsedAt: Date.now(),
            },
          ],
        })),

      removeLinearThreadMessage: (id) =>
        set((state) => ({
          ...state,
          linearThreadMessages: state.linearThreadMessages.filter((message) => message.id !== id),
        })),

      removeLinearThreadMessageByNodeId: (nodeId) =>
        set((state) => ({
          ...state,
          linearThreadMessages: state.linearThreadMessages.filter(
            (message) => message.nodeId !== nodeId,
          ),
        })),

      clearLinearThreadMessages: () =>
        set((state) => ({
          ...state,
          linearThreadMessages: [],
        })),

      setTplConfig: (config) =>
        set((state) => ({
          ...state,
          tplConfig: config,
        })),

      clearState: () => set(defaultCanvasState()),

      setCanvasPage: (canvasId, pageId) =>
        set((state) => ({
          ...state,
          canvasPage: {
            ...state.canvasPage,
            [canvasId]: pageId,
          },
        })),

      setContextMenuOpenedCanvasId: (canvasId) =>
        set((state) => ({
          ...state,
          contextMenuOpenedCanvasId: canvasId,
        })),

      setCanvasTitle: (canvasId, title) =>
        set((state) => ({
          ...state,
          canvasTitle: {
            ...state.canvasTitle,
            [canvasId]: title,
          },
        })),

      setCanvasInitialized: (canvasId, initialized) =>
        set((state) => ({
          ...state,
          canvasInitialized: {
            ...state.canvasInitialized,
            [canvasId]: initialized,
          },
          canvasInitializedAt: {
            ...state.canvasInitializedAt,
            [canvasId]: initialized ? Date.now() : undefined,
          },
        })),

      setCanvasExecutionId: (canvasId, executionId) =>
        set((state) => {
          const newCanvasExecutionId = { ...state.canvasExecutionId };
          if (executionId === null) {
            delete newCanvasExecutionId[canvasId];
          } else {
            newCanvasExecutionId[canvasId] = executionId;
          }
          return {
            ...state,
            canvasExecutionId: newCanvasExecutionId,
          };
        }),

      setCanvasNodeExecutions: (canvasId, nodeExecutions) =>
        set((state) => {
          const newCanvasNodeExecutions = { ...state.canvasNodeExecutions };
          if (nodeExecutions === null) {
            delete newCanvasNodeExecutions[canvasId];
          } else {
            newCanvasNodeExecutions[canvasId] = nodeExecutions;
          }
          return {
            ...state,
            canvasNodeExecutions: newCanvasNodeExecutions,
          };
        }),

      setCanvasVariables: (canvasId, variables) =>
        set((state) => ({
          ...state,
          canvasVariables: {
            ...state.canvasVariables,
            [canvasId]: variables,
          },
        })),
    }),
    {
      name: 'canvas-storage',
      storage: createJSONStorage(() => canvasStorage),
      partialize: (state) => ({
        config: state.config,
        currentCanvasId: state.currentCanvasId,
        showEdges: state.showEdges,
        showLaunchpad: state.showLaunchpad,
        nodeSizeMode: state.nodeSizeMode,
        linearThreadMessages: state.linearThreadMessages,
        showSlideshow: state.showSlideshow,
        canvasPage: state.canvasPage,
        canvasTitle: state.canvasTitle,
        canvasExecutionId: state.canvasExecutionId,
      }),
    },
  ),
);

export const useCanvasStoreShallow = <T>(selector: (state: CanvasState) => T) => {
  return useCanvasStore(useShallow(selector));
};
