import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { type ActionResult, type DriveFile } from '@refly/openapi-schema';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type CacheInfo, createAutoEvictionStorage } from '../stores/utils/storage-manager';

interface PollingState {
  notFoundErrorCount: number;
  lastPollTime: number;
  isPolling: boolean;
  version: number;
  timeoutStartTime: number | null;
  lastEventTime: number | null;
}

export type ResultActiveTab = 'configure' | 'lastRun';

interface ActionResultState {
  resultMap: Record<string, ActionResult & CacheInfo>;
  resultActiveTabMap: Record<string, ResultActiveTab>;
  pollingStateMap: Record<string, PollingState & CacheInfo>;
  streamResults: Record<string, ActionResult>;
  traceIdMap: Record<string, string>; // key: resultId, value: traceId
  currentFile: DriveFile | null;

  // Stream result actions
  addStreamResult: (resultId: string, result: ActionResult) => void;
  removeStreamResult: (resultId: string) => void;

  // TraceId management actions
  setTraceId: (resultId: string, traceId: string) => void;
  getTraceId: (resultId: string) => string | undefined;
  removeTraceId: (resultId: string) => void;

  // Individual update actions
  updateActionResult: (resultId: string, result: ActionResult) => void;
  removeActionResult: (resultId: string) => void;
  setResultActiveTab: (resultId: string, tab: ResultActiveTab) => void;
  startPolling: (resultId: string, version: number) => void;
  stopPolling: (resultId: string) => void;
  removePollingState: (resultId: string) => void;
  incrementErrorCount: (resultId: string) => void;
  resetErrorCount: (resultId: string) => void;
  updateLastPollTime: (resultId: string) => void;
  startTimeout: (resultId: string) => void;
  updateLastEventTime: (resultId: string) => void;
  clearTimeout: (resultId: string) => void;

  batchPollingStateUpdates: (
    updates: Array<{ resultId: string; state: Partial<PollingState> }>,
  ) => void;

  // Storage management
  updateLastUsedTimestamp: (resultId: string) => void;
  cleanupOldResults: () => void;

  // Current file management
  setCurrentFile: (file: DriveFile | null) => void;
}

export const defaultState = {
  resultMap: {},
  resultActiveTabMap: {},
  pollingStateMap: {},
  isBatchUpdateScheduled: false,
  streamResults: {},
  traceIdMap: {},
  currentFile: null,
};

const POLLING_STATE_INITIAL: PollingState = {
  notFoundErrorCount: 0,
  lastPollTime: 0,
  isPolling: false,
  version: 0,
  timeoutStartTime: null,
  lastEventTime: null,
};

// Create our custom storage with appropriate configuration
const actionResultStorage = createAutoEvictionStorage({
  maxSize: 1024 * 1024, // 1MB
  maxItems: 50,
});

// Optimization: use selective updates instead of full immer for simple property changes
export const useActionResultStore = create<ActionResultState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // Update the lastUsedAt timestamp for a specific result
      updateLastUsedTimestamp: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const newState = { ...state };

          // Update in resultMap if exists
          if (state.resultMap[resultId]) {
            newState.resultMap = {
              ...state.resultMap,
              [resultId]: {
                ...state.resultMap[resultId],
                lastUsedAt: now,
              },
            };
          }

          // Update in pollingStateMap if exists
          if (state.pollingStateMap[resultId]) {
            newState.pollingStateMap = {
              ...state.pollingStateMap,
              [resultId]: {
                ...state.pollingStateMap[resultId],
                lastUsedAt: now,
              },
            };
          }

          return newState;
        });
      },

      // Clean up old results that exceed the maximum or are too old
      // Note: This is less important now with our custom storage but kept for compatibility
      cleanupOldResults: () => {},

      updateActionResult: (resultId: string, result: ActionResult) => {
        // Shallow update to avoid deep copying the entire store
        const now = Date.now();
        set((state) => {
          const oldResult = state.resultMap[resultId];
          const oldVersion = oldResult?.version ?? 0;
          const newVersion = result.version ?? 0;

          // Skip update if we're trying to update with an older version
          if (oldResult && newVersion < oldVersion) {
            return state;
          }

          return {
            ...state,
            resultMap: {
              ...state.resultMap,
              [resultId]: {
                ...result,
                lastUsedAt: now,
              },
            },
          };
        });

        // Clean up old results after update
        get().cleanupOldResults();
      },

      // Remove action result from store
      removeActionResult: (resultId: string) => {
        set((state) => {
          const newResultMap = { ...state.resultMap };
          delete newResultMap[resultId];
          return {
            ...state,
            resultMap: newResultMap,
          };
        });
      },

      setResultActiveTab: (resultId: string, tab: ResultActiveTab) => {
        set((state) => ({
          ...state,
          resultActiveTabMap: { ...state.resultActiveTabMap, [resultId]: tab },
        }));
      },

      startPolling: (resultId: string, version: number) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                isPolling: true,
                version,
                lastPollTime: now,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      stopPolling: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                isPolling: false,
                timeoutStartTime: null,
                lastEventTime: null,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      removePollingState: (resultId: string) => {
        set((state) => {
          const newPollingStateMap = { ...state.pollingStateMap };
          delete newPollingStateMap[resultId];
          return {
            ...state,
            pollingStateMap: newPollingStateMap,
          };
        });
      },

      incrementErrorCount: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                notFoundErrorCount: currentPollingState.notFoundErrorCount + 1,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      resetErrorCount: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                notFoundErrorCount: 0,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      updateLastPollTime: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                lastPollTime: now,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      startTimeout: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId] || {
            ...POLLING_STATE_INITIAL,
          };

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                timeoutStartTime: now,
                lastEventTime: now,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      updateLastEventTime: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                lastEventTime: now,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      clearTimeout: (resultId: string) => {
        const now = Date.now();
        set((state) => {
          const currentPollingState = state.pollingStateMap[resultId];
          if (!currentPollingState) return state;

          return {
            ...state,
            pollingStateMap: {
              ...state.pollingStateMap,
              [resultId]: {
                ...currentPollingState,
                timeoutStartTime: null,
                lastEventTime: null,
                lastUsedAt: now,
              },
            },
          };
        });
      },

      // Batched update for multiple polling state changes at once
      batchPollingStateUpdates: (
        updates: Array<{ resultId: string; state: Partial<PollingState> }>,
      ) => {
        const now = Date.now();
        set((state) => {
          const newPollingStateMap = { ...state.pollingStateMap };

          for (const update of updates) {
            const { resultId, state: partialState } = update;
            const currentState = newPollingStateMap[resultId] || {
              ...POLLING_STATE_INITIAL,
            };

            newPollingStateMap[resultId] = {
              ...currentState,
              ...partialState,
              lastUsedAt: now,
            };
          }

          return {
            ...state,
            pollingStateMap: newPollingStateMap,
          };
        });

        // Clean up old results after batch updates
        get().cleanupOldResults();
      },

      // Stream result methods
      addStreamResult: (resultId: string, result: ActionResult) => {
        set((state) => ({
          ...state,
          streamResults: {
            ...state.streamResults,
            [resultId]: result,
          },
        }));
      },

      removeStreamResult: (resultId: string) => {
        set((state) => {
          const newStreamResults = { ...state.streamResults };
          delete newStreamResults[resultId];
          return {
            ...state,
            streamResults: newStreamResults,
          };
        });
      },

      // TraceId management methods
      setTraceId: (resultId: string, traceId: string) => {
        set((state) => ({
          ...state,
          traceIdMap: {
            ...state.traceIdMap,
            [resultId]: traceId,
          },
        }));
      },

      getTraceId: (resultId: string) => {
        return get().traceIdMap[resultId];
      },

      removeTraceId: (resultId: string) => {
        set((state) => {
          const newTraceIdMap = { ...state.traceIdMap };
          delete newTraceIdMap[resultId];
          return {
            ...state,
            traceIdMap: newTraceIdMap,
          };
        });
      },

      // Current file management methods
      setCurrentFile: (file: DriveFile | null) => {
        set((state) => ({
          ...state,
          currentFile: file,
        }));
      },
    }),
    {
      name: 'action-result-storage',
      storage: createJSONStorage(() => actionResultStorage),
      partialize: (state) => ({
        resultMap: state.resultMap,
        traceIdMap: state.traceIdMap,
      }),
    },
  ),
);

export const useActionResultStoreShallow = <T>(selector: (state: ActionResultState) => T) => {
  return useActionResultStore(useShallow(selector));
};
