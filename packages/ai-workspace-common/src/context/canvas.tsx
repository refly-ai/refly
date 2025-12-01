import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { get, set, update } from 'idb-keyval';
import { Modal, Radio } from 'antd';
import { ModalFunc } from 'antd/es/modal/confirm';
import { Node, Edge, useStoreApi, InternalNode, useReactFlow } from '@xyflow/react';
import { adoptUserNodes, updateConnectionLookup } from '@xyflow/system';
import {
  CanvasEdge,
  CanvasNode,
  CanvasState,
  CanvasTransaction,
  VersionConflict,
  SharedCanvasData,
  InitializeWorkflowRequest,
  WorkflowExecutionStatus,
} from '@refly/openapi-schema';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  getCanvasDataFromState,
  mergeCanvasStates,
  CanvasConflictException,
  purgeContextItems,
  calculateCanvasStateDiff,
  getLastTransaction,
  shouldCreateNewVersion,
} from '@refly/canvas-common';
import { useCanvasStore, useCanvasStoreShallow } from '@refly/stores';
import { useDebouncedCallback } from 'use-debounce';
import { IContextItem } from '@refly/common-types';
import { useGetCanvasDetail } from '@refly-packages/ai-workspace-common/queries';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { logEvent } from '@refly/telemetry-web';

// Wait time for syncCanvasData to be called
const SYNC_CANVAS_LOCAL_WAIT_TIME = 200;

// Wait time for syncCanvasData to be called after canvas is initialized
const SYNC_CANVAS_WAIT_INIT_TIME = 300;

// Remote sync interval
const SYNC_REMOTE_INTERVAL = 2000;

// Poll remote interval
const POLL_TX_INTERVAL = 3000;

// Max number of sync failures before showing the blocking modal
const CANVAS_SYNC_FAILURE_COUNT_THRESHOLD = 5;

interface CanvasContextType {
  canvasId: string;
  readonly: boolean;
  loading: boolean;
  shareLoading: boolean;
  syncFailureCount: number;
  shareNotFound?: boolean;
  shareData?: SharedCanvasData;
  lastUpdated?: number;
  workflow: {
    initializeWorkflow: (param: InitializeWorkflowRequest) => Promise<boolean>;
    isInitializing: boolean;
    executionId?: string;
    workflowStatus?: WorkflowExecutionStatus;
    isPolling: boolean;
    pollingError: any;
  };

  forceSyncState: (options?: { syncRemote?: boolean }) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// HTTP interface to get canvas state
const getCanvasState = async (canvasId: string): Promise<CanvasState | undefined> => {
  const { data } = await getClient().getCanvasState({ query: { canvasId } });
  return data?.data;
};

// Poll canvas transactions from server
const pollCanvasTransactions = async (
  canvasId: string,
  version: string,
  since: number,
): Promise<CanvasTransaction[]> => {
  const { data, error } = await getClient().getCanvasTransactions({
    query: {
      canvasId,
      version,
      since,
    },
  });
  if (error) {
    throw error;
  }
  return data?.data ?? [];
};

const setCanvasState = async (canvasId: string, state: CanvasState) => {
  await getClient().setCanvasState({
    body: { canvasId, state },
  });
};

const createCanvasVersion = async (canvasId: string, state: CanvasState) => {
  const { data } = await getClient().createCanvasVersion({
    body: { canvasId, state },
  });
  return data?.data;
};

const CanvasContext = createContext<CanvasContextType | null>(null);

const getInternalState = ({
  nodes,
  edges,
  nodeLookup = new Map<string, InternalNode>(),
  parentLookup = new Map(),
  connectionLookup = new Map(),
  edgeLookup = new Map(),
}: {
  nodes?: Node[];
  edges?: Edge[];
  nodeLookup?: Map<string, InternalNode>;
  parentLookup?: Map<string, any>;
  connectionLookup?: Map<string, any>;
  edgeLookup?: Map<string, any>;
} = {}) => {
  updateConnectionLookup(connectionLookup, edgeLookup, edges ?? []);
  const cleanedNodes = nodes?.filter((node) => !!node) ?? [];

  if (cleanedNodes.length > 0) {
    adoptUserNodes(cleanedNodes, nodeLookup, parentLookup, {
      elevateNodesOnSelect: false,
    });
  }

  return {
    nodes: cleanedNodes,
    edges,
  };
};

export const CanvasProvider = ({
  canvasId,
  readonly = false,
  children,
}: {
  canvasId: string;
  readonly?: boolean;
  children: React.ReactNode;
}) => {
  const { t } = useTranslation();
  const [modal, contextHolder] = Modal.useModal();
  const [lastUpdated, setLastUpdated] = useState<number>();
  const [loading, setLoading] = useState(false);

  const [syncFailureCount, setSyncFailureCount] = useState(0);

  const warningModalRef = useRef<ReturnType<ModalFunc> | null>(null);

  useEffect(() => {
    if (syncFailureCount > CANVAS_SYNC_FAILURE_COUNT_THRESHOLD) {
      if (!warningModalRef.current) {
        warningModalRef.current = modal.warning({
          title: t('canvas.syncFailure.title'),
          content: t('canvas.syncFailure.content'),
          centered: true,
          okText: t('canvas.syncFailure.reload'),
          cancelText: t('common.cancel'),
          onOk: () => {
            window.location.reload();
          },
        });
      }
    } else {
      if (warningModalRef.current) {
        warningModalRef.current.destroy();
        warningModalRef.current = null;
      }
    }
  }, [syncFailureCount, modal, t]);

  const isSyncingRemoteRef = useRef(false); // Lock for syncWithRemote
  const isSyncingLocalRef = useRef(false); // Lock for syncCanvasData

  const { setState, getState } = useStoreApi();
  const { setCanvasTitle, setCanvasInitialized } = useCanvasStoreShallow((state) => ({
    setCanvasTitle: state.setCanvasTitle,
    setCanvasInitialized: state.setCanvasInitialized,
  }));

  const { data: canvasDetail } = useGetCanvasDetail({ query: { canvasId } }, undefined, {
    enabled: !readonly && !!canvasId,
  });

  // Use the hook to fetch canvas data when in readonly mode
  const {
    data: canvasData,
    error: canvasError,
    loading: shareLoading,
  } = useFetchShareData<SharedCanvasData>(readonly ? canvasId : undefined);

  // Check if it's a 404 error
  const shareNotFound = useMemo(() => {
    if (!readonly || shareLoading || !canvasError) return false;
    return (
      !canvasData ||
      canvasError.message.includes('404') ||
      canvasError.message.includes('Failed to fetch share data: 404')
    );
  }, [canvasError, canvasData, shareLoading, readonly]);

  // Set canvas data from API response when in readonly mode
  useEffect(() => {
    if (readonly) {
      if (!canvasData) return;
      const { nodeLookup, parentLookup, connectionLookup, edgeLookup } = getState();
      const { nodes, edges } = canvasData;
      const internalState = getInternalState({
        nodes: nodes && Array.isArray(nodes) ? (nodes as unknown as Node[]) : [],
        edges: edges && Array.isArray(edges) ? (edges as unknown as Edge[]) : [],
        nodeLookup,
        parentLookup,
        connectionLookup,
        edgeLookup,
      });
      setState(internalState);
    } else {
      if (!canvasDetail?.data?.title) return;
      setCanvasTitle(canvasId, canvasDetail.data.title);
    }
  }, [readonly, canvasData, canvasDetail, canvasId]);

  const handleConflictResolution = useCallback(
    (canvasId: string, conflict: VersionConflict): Promise<'local' | 'remote'> => {
      const { localState, remoteState } = conflict;

      const localModifiedTs = getLastTransaction(localState)?.createdAt ?? localState.updatedAt;
      const remoteModifiedTs = getLastTransaction(remoteState)?.createdAt ?? remoteState.updatedAt;

      const localModified = localModifiedTs
        ? dayjs(localModifiedTs).format('YYYY-MM-DD HH:mm:ss')
        : t('common.unknown');
      const remoteModified = remoteModifiedTs
        ? dayjs(remoteModifiedTs).format('YYYY-MM-DD HH:mm:ss')
        : t('common.unknown');

      return new Promise((resolve) => {
        let selected: 'local' | 'remote' = 'local';
        modal.confirm({
          title: t('canvas.conflict.title'),
          centered: true,
          content: (
            <div>
              <p className="mb-2">{t('canvas.conflict.content')}</p>
              <Radio.Group
                options={[
                  {
                    label: t('canvas.conflict.local', { time: localModified }),
                    value: 'local',
                  },
                  {
                    label: t('canvas.conflict.remote', { time: remoteModified }),
                    value: 'remote',
                  },
                ]}
                defaultValue="local"
                onChange={(e) => {
                  selected = e.target.value;
                }}
              />
            </div>
          ),
          okText: t('common.confirm'),
          cancelText: t('common.cancel'),
          onOk: async () => {
            if (selected === 'local') {
              await setCanvasState(canvasId, localState);
            }
            resolve(selected);
          },
          onCancel: () => {
            resolve('remote'); // Default to remote if cancelled
          },
        });
      });
    },
    [],
  );

  const handleCreateCanvasVersion = useCallback(
    async (canvasId: string, state: CanvasState) => {
      try {
        const result = await createCanvasVersion(canvasId, state);
        if (!result) {
          // Fallback: verify if server already created the new version
          const remoteState = await getCanvasState(canvasId);
          if (remoteState && remoteState.version !== state.version) {
            return remoteState;
          }
          return;
        }

        const { conflict, newState } = result;

        let finalState: CanvasState | undefined;

        if (conflict) {
          const userChoice = await handleConflictResolution(canvasId, conflict);
          logEvent('canvas::conflict_version', userChoice, {
            canvasId,
            source: 'create_new_version',
            localVersion: conflict.localState.version,
            remoteVersion: conflict.remoteState.version,
          });

          if (userChoice === 'local') {
            finalState = conflict.localState;
          } else {
            finalState = conflict.remoteState;
          }
        } else if (newState) {
          finalState = newState;
        }

        return finalState;
      } catch {
        // Network error may occur while server actually succeeded; verify by fetching remote state
        try {
          const remoteState = await getCanvasState(canvasId);
          if (remoteState && remoteState.version !== state.version) {
            return remoteState;
          }
        } catch (_) {
          // Intentionally ignore; will retry on next sync tick
        }
        return;
      }
    },
    [handleConflictResolution],
  );

  // Sync canvas state with remote
  const syncWithRemote = useCallback(
    async (transactions?: CanvasTransaction[]) => {
      // Prevent multiple concurrent sync operations
      if (isSyncingRemoteRef.current) {
        return;
      }

      isSyncingRemoteRef.current = true;

      try {
        const state = await get<CanvasState>(`canvas-state:${canvasId}`);
        if (!state) {
          return;
        }

        // If the number of transactions is greater than the threshold, create a new version
        if (shouldCreateNewVersion(state)) {
          const finalState = await handleCreateCanvasVersion(canvasId, state);
          if (finalState) {
            await set(`canvas-state:${canvasId}`, finalState);
          }
          return;
        }

        const toSync = transactions ?? state?.transactions?.filter((tx) => !tx?.syncedAt) ?? [];

        if (!toSync?.length) {
          return;
        }

        const { error, data } = await getClient().syncCanvasState({
          body: {
            canvasId,
            version: state.version,
            transactions: toSync,
          },
        });

        if (!error && data?.success) {
          setSyncFailureCount(0);

          // Create a map of txId to syncedAt from the returned transactions
          const syncedTransactions = data?.data?.transactions ?? [];
          const syncedAtMap = new Map<string, number>();

          for (const tx of syncedTransactions) {
            if (tx?.txId && tx?.syncedAt) {
              syncedAtMap.set(tx.txId, tx.syncedAt);
            }
          }

          await update<CanvasState>(`canvas-state:${canvasId}`, (current) => ({
            ...current,
            nodes: current?.nodes ?? [],
            edges: current?.edges ?? [],
            transactions: current?.transactions?.map((tx) => ({
              ...tx,
              syncedAt: syncedAtMap.get(tx.txId) ?? tx.syncedAt,
            })),
          }));
        } else {
          setSyncFailureCount((count) => count + 1);
        }
      } finally {
        isSyncingRemoteRef.current = false;
      }
    },
    [canvasId, handleCreateCanvasVersion],
  );

  // Set up sync job that runs every 2 seconds
  useEffect(() => {
    if (!canvasId || readonly) return;

    const intervalId = setInterval(async () => {
      const { canvasInitializedAt } = useCanvasStore.getState();
      const initTs = canvasInitializedAt[canvasId];

      // Only sync canvas data after canvas is ready for some time
      if (!initTs || Date.now() - initTs < SYNC_CANVAS_WAIT_INIT_TIME) {
        return;
      }

      try {
        await syncWithRemote();
      } catch (error) {
        console.error('Canvas sync failed:', error);
      }
    }, SYNC_REMOTE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [canvasId, readonly, syncWithRemote]);

  const { getNodes, getEdges } = useReactFlow();

  // Core local sync logic extracted for reuse
  const doLocalSync = useCallback(async () => {
    // Prevent multiple concurrent sync operations
    if (isSyncingLocalRef.current) {
      return;
    }

    const { canvasInitializedAt } = useCanvasStore.getState();
    const initTs = canvasInitializedAt[canvasId];

    // Only sync canvas data after canvas is ready for some time
    if (!initTs || Date.now() - initTs < SYNC_CANVAS_WAIT_INIT_TIME) {
      return;
    }

    isSyncingLocalRef.current = true;

    try {
      const nodes = getNodes() as CanvasNode[];
      const edges = getEdges() as CanvasEdge[];

      // Purge context items from nodes
      const purgedNodes: CanvasNode[] = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...node.data?.metadata,
            contextItems: purgeContextItems(node.data?.metadata?.contextItems as IContextItem[]),
          },
        },
      }));

      const currentState = await get(`canvas-state:${canvasId}`);
      const currentStateData = getCanvasDataFromState(currentState);

      const diff = calculateCanvasStateDiff(currentStateData, {
        nodes: purgedNodes,
        edges,
      });

      if (diff) {
        await update<CanvasState>(`canvas-state:${canvasId}`, (state) => ({
          ...state,
          nodes: state?.nodes ?? [],
          edges: state?.edges ?? [],
          transactions: [...(state?.transactions?.filter((tx) => !tx.revoked) ?? []), diff],
        }));
      }
    } finally {
      isSyncingLocalRef.current = false;
    }
  }, [canvasId, getNodes, getEdges]);

  // Debounced version for normal usage
  const syncCanvasDataDebounced = useDebouncedCallback(async () => {
    await doLocalSync();
  }, SYNC_CANVAS_LOCAL_WAIT_TIME);

  // A queue to ensure immediate local syncs run sequentially
  const localSyncQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Immediate local sync that is awaitable and ordered
  const syncLocalNow = useCallback(async () => {
    const next = async () => doLocalSync();
    const queued = localSyncQueueRef.current.then(next, next);
    // Replace the queue with the in-flight promise
    localSyncQueueRef.current = queued.catch(() => {});
    await queued;
  }, [doLocalSync]);

  // Function to update canvas data from state
  const updateCanvasDataFromState = useCallback(
    (state: CanvasState) => {
      const { nodeLookup, parentLookup, connectionLookup, edgeLookup } = getState();
      const { nodes, edges } = getCanvasDataFromState(state);

      const internalState = getInternalState({
        nodes: nodes && Array.isArray(nodes) ? (nodes as unknown as Node[]) : [],
        edges: edges && Array.isArray(edges) ? (edges as unknown as Edge[]) : [],
        nodeLookup,
        parentLookup,
        connectionLookup,
        edgeLookup,
      });
      setState(internalState);
      setLastUpdated(Date.now());
    },
    [getState, setState],
  );

  const initialFetchCanvasState = useDebouncedCallback(
    async (canvasId: string) => {
      const localState = await get<CanvasState>(`canvas-state:${canvasId}`);

      // Only set loading when local state is not found
      let needLoading = false;
      if (!localState) {
        needLoading = true;
        setLoading(true);
      } else {
        updateCanvasDataFromState(localState);
      }

      let remoteState: CanvasState | undefined;
      try {
        remoteState = await getCanvasState(canvasId);
      } catch (error) {
        console.error('Failed to fetch canvas state from remote:', error);
        // On error, fallback to local state if available
        if (needLoading) {
          setLoading(false);
        }
        if (localState) {
          setCanvasInitialized(canvasId, true);
        }
        return;
      }

      if (!remoteState) {
        // Remote state is not available, clear loading and use local state only
        if (needLoading) {
          setLoading(false);
        }
        // If we have local state, initialize the canvas with it
        if (localState) {
          setCanvasInitialized(canvasId, true);
        }
        return;
      }

      // If local has transactions that remote is missing (same version), push them first
      let latestLocalState = localState;
      if (latestLocalState?.version === remoteState?.version) {
        const remoteTxIds = new Set(remoteState?.transactions?.map((tx) => tx?.txId) ?? []);
        const missingLocalTxs =
          latestLocalState?.transactions?.filter(
            (tx) => !!tx?.txId && !tx?.revoked && !remoteTxIds.has(tx.txId),
          ) ?? [];
        if (missingLocalTxs.length > 0) {
          try {
            await syncWithRemote(missingLocalTxs);
            latestLocalState = await get<CanvasState>(`canvas-state:${canvasId}`);
          } catch {
            // Intentionally ignore push errors here; we will rely on merge or later sync cycles
          }
        }
      }

      let finalState: CanvasState;
      if (!latestLocalState) {
        finalState = remoteState;
      } else {
        try {
          finalState = mergeCanvasStates(latestLocalState, remoteState);
        } catch (error) {
          if (error instanceof CanvasConflictException) {
            // Show conflict modal to user
            const userChoice = await handleConflictResolution(canvasId, {
              localState: latestLocalState,
              remoteState,
            });
            logEvent('canvas::conflict_version', userChoice, {
              canvasId,
              source: 'initial_fetch',
              localVersion: latestLocalState.version,
              remoteVersion: remoteState.version,
            });

            if (userChoice === 'local') {
              // Use local state, and set it to remote
              finalState = latestLocalState;
            } else {
              // Use remote state, and overwrite local state
              finalState = remoteState;
            }
          } else {
            console.error('Failed to merge canvas states:', error);
            finalState = remoteState;
          }
        }
      }

      updateCanvasDataFromState(finalState);

      await set(`canvas-state:${canvasId}`, finalState);

      if (needLoading) {
        setLoading(false);
      }

      setCanvasInitialized(canvasId, true);
    },
    10,
    { leading: true, trailing: false },
  );

  const undo = useCallback(async () => {
    const currentState = await get(`canvas-state:${canvasId}`);
    const transactions = currentState?.transactions;
    if (Array.isArray(transactions) && transactions.length > 0) {
      // Find the last transaction where revoked is false
      for (let i = transactions.length - 1; i >= 0; i--) {
        if (!transactions[i]?.revoked) {
          transactions[i].revoked = true;
          transactions[i].syncedAt = undefined;
          await set(`canvas-state:${canvasId}`, currentState);
          updateCanvasDataFromState(currentState);
          break;
        }
      }
    }
  }, [canvasId, updateCanvasDataFromState]);

  const redo = useCallback(async () => {
    const currentState = await get(`canvas-state:${canvasId}`);
    const transactions = currentState?.transactions;
    if (Array.isArray(transactions) && transactions.length > 0) {
      // Find the first transaction where revoked is true
      for (let i = 0; i < transactions.length; i++) {
        if (transactions[i]?.revoked) {
          transactions[i].revoked = false;
          transactions[i].syncedAt = undefined;
          await set(`canvas-state:${canvasId}`, currentState);
          updateCanvasDataFromState(currentState);
          break;
        }
      }
    }
  }, [canvasId, updateCanvasDataFromState]);

  // Poll server transactions and merge to local state
  useEffect(() => {
    if (readonly || !canvasId) return;

    let polling = true;
    let intervalId: NodeJS.Timeout | null = null;
    let pollCount = 0;

    const poll = async () => {
      if (!polling) return;
      try {
        // Get local CanvasState
        const localState = await get<CanvasState>(`canvas-state:${canvasId}`);
        if (!localState) {
          // If local state is not found, skip this poll
          return;
        }

        const { canvasInitialized } = useCanvasStore.getState();
        if (!canvasInitialized[canvasId]) {
          return;
        }

        const version = localState?.version ?? '';
        const localTxIds = new Set(localState?.transactions?.map((tx) => tx.txId) ?? []);

        pollCount += 1;

        // Pull new transactions from server
        const since = Date.now() - 60000; // 1 minute ago
        const remoteTxs = await pollCanvasTransactions(canvasId, version, since);
        setSyncFailureCount(0);

        // Filter out transactions that already exist locally
        const newTxs = remoteTxs?.filter((tx) => !localTxIds.has(tx.txId)) ?? [];
        if (newTxs.length > 0) {
          // Merge transactions to local state
          const updatedState = {
            ...localState,
            transactions: [...(localState.transactions ?? []), ...newTxs],
          };
          updatedState.transactions.sort((a, b) => a.createdAt - b.createdAt);
          await set(`canvas-state:${canvasId}`, updatedState);
          updateCanvasDataFromState(updatedState);
        }

        // Every 5 polls, run a full consistency check with since=0
        if (pollCount % 5 === 0) {
          const fullRemoteTxs = await pollCanvasTransactions(canvasId, version, 0);
          setSyncFailureCount(0);

          const remoteAllTxIds = new Set(fullRemoteTxs?.map((tx) => tx?.txId) ?? []);
          const missingLocalTxs = Array.isArray(localState?.transactions)
            ? localState.transactions.filter(
                (tx) => !!tx?.txId && !tx?.revoked && !remoteAllTxIds.has(tx.txId),
              )
            : [];

          if (missingLocalTxs.length > 0) {
            try {
              await syncWithRemote(missingLocalTxs);
            } catch (_) {
              // Intentionally ignore push errors here; rely on later sync cycles
            }
          }
        }
      } catch (err) {
        console.error('[pollCanvasTransactions] failed:', err);
        setSyncFailureCount((count) => count + 1);
      }
    };

    intervalId = setInterval(poll, POLL_TX_INTERVAL);

    return () => {
      polling = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [canvasId, readonly, updateCanvasDataFromState]);

  // Cleanup on unmount
  useEffect(() => {
    if (readonly) return;

    setSyncFailureCount(0);
    initialFetchCanvasState(canvasId);

    return () => {
      // Cancel pending debounced calls to prevent race conditions
      initialFetchCanvasState.cancel();
      syncCanvasDataDebounced.flush();

      // Clear canvas data
      setState({ nodes: [], edges: [] });
      setLoading(false);
      setCanvasInitialized(canvasId, false);
    };
    // Note: Excluding debounced function references from deps to prevent
    // unnecessary re-runs. These functions internally capture their deps
    // through closures and don't need to trigger effect re-execution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, readonly]);

  // Force sync canvas state to remote or local
  const forceSyncState = useCallback(
    async (options?: { syncRemote?: boolean }) => {
      if (options?.syncRemote) {
        // Ensure latest local state is persisted before remote sync
        await syncLocalNow();
        await syncWithRemote();
      } else {
        // Schedule debounced local sync for performance
        await syncCanvasDataDebounced();
      }
    },
    [canvasId, syncLocalNow, syncWithRemote, syncCanvasDataDebounced],
  );

  const {
    initializeWorkflow,
    isInitializing,
    executionId,
    workflowStatus,
    isPolling,
    pollingError,
  } = useInitializeWorkflow(canvasId, forceSyncState);

  return (
    <CanvasContext.Provider
      value={{
        loading,
        canvasId,
        readonly,
        shareLoading,
        shareNotFound,
        syncFailureCount,
        shareData: canvasData ?? undefined,
        lastUpdated,
        forceSyncState,
        undo,
        redo,
        workflow: {
          initializeWorkflow,
          isInitializing,
          executionId,
          workflowStatus,
          isPolling,
          pollingError,
        },
      }}
    >
      {contextHolder}
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvasContext = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
};
