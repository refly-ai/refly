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
  WorkflowVariable,
} from '@refly/openapi-schema';
import { RawCanvasData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
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
import {
  useGetCanvasDetail,
  useGetWorkflowVariables,
} from '@refly-packages/ai-workspace-common/queries';
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
  shareData?: RawCanvasData;
  lastUpdated?: number;
  workflow: {
    workflowVariables: WorkflowVariable[];
    workflowVariablesLoading: boolean;
    refetchWorkflowVariables: () => void;
  };

  // Workflow run shared state/actions across Canvas
  workflowRun?: {
    initialize: (startNodes?: string[]) => void;
    loading: boolean;
    executionId: string | null | undefined;
    workflowStatus?: any;
    isPolling?: boolean;
    pollingError?: any;
  };

  syncCanvasData: (options?: { syncRemote?: boolean }) => Promise<void>;
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
): Promise<CanvasTransaction[]> => {
  const { data, error } = await getClient().getCanvasTransactions({
    query: {
      canvasId,
      version,
      since: Date.now() - 5000, // 5 seconds ago
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
  workflowRun,
}: {
  canvasId: string;
  readonly?: boolean;
  children: React.ReactNode;
  workflowRun?: {
    initialize: (startNodes?: string[]) => void;
    loading: boolean;
    executionId: string | null | undefined;
    workflowStatus?: any;
    isPolling?: boolean;
    pollingError?: any;
  };
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

  const {
    data: workflowVariables,
    refetch: refetchWorkflowVariables,
    isLoading: workflowVariablesLoading,
  } = useGetWorkflowVariables({ query: { canvasId } }, undefined, {
    enabled: !!canvasId,
  });

  // Use the hook to fetch canvas data when in readonly mode
  const {
    data: canvasData,
    error: canvasError,
    loading: shareLoading,
  } = useFetchShareData<RawCanvasData>(readonly ? canvasId : undefined);

  // Check if it's a 404 error
  const shareNotFound = useMemo(() => {
    if (!canvasError) return false;
    return (
      canvasError.message.includes('404') ||
      canvasError.message.includes('Failed to fetch share data: 404')
    );
  }, [canvasError]);

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

  const handleCreateCanvasVersion = async (canvasId: string, state: CanvasState) => {
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
  };

  // Sync canvas state with remote
  const syncWithRemote = async (canvasId: string) => {
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

    const unsyncedTransactions = state?.transactions?.filter((tx) => !tx.syncedAt);

    if (!unsyncedTransactions?.length) {
      return;
    }

    const { error, data } = await getClient().syncCanvasState({
      body: {
        canvasId,
        version: state.version,
        transactions: unsyncedTransactions,
      },
    });

    if (!error && data?.success) {
      setSyncFailureCount(0);
      await update<CanvasState>(`canvas-state:${canvasId}`, (state) => ({
        ...state,
        nodes: state?.nodes ?? [],
        edges: state?.edges ?? [],
        transactions: state?.transactions?.map((tx) => ({
          ...tx,
          syncedAt: tx.syncedAt ?? Date.now(),
        })),
      }));
    } else {
      setSyncFailureCount((count) => count + 1);
    }
  };

  // Set up sync job that runs every 2 seconds
  useEffect(() => {
    if (!canvasId || readonly) return;

    const intervalId = setInterval(async () => {
      // Prevent multiple instances from running simultaneously
      if (isSyncingRemoteRef.current) return;

      const { canvasInitializedAt } = useCanvasStore.getState();
      const initTs = canvasInitializedAt[canvasId];

      // Only sync canvas data after canvas is ready for some time
      if (!initTs || Date.now() - initTs < SYNC_CANVAS_WAIT_INIT_TIME) {
        return;
      }

      isSyncingRemoteRef.current = true;
      try {
        await syncWithRemote(canvasId);
      } catch (error) {
        console.error('Canvas sync failed:', error);
      } finally {
        isSyncingRemoteRef.current = false;
      }
    }, SYNC_REMOTE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [canvasId]);

  const { getNodes, getEdges } = useReactFlow();

  // Sync canvas data to local state
  const syncCanvasData = useDebouncedCallback(async () => {
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
  }, SYNC_CANVAS_LOCAL_WAIT_TIME);

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

  const initialFetchCanvasState = useDebouncedCallback(async (canvasId: string) => {
    const localState = await get<CanvasState>(`canvas-state:${canvasId}`);

    // Only set loading when local state is not found
    let needLoading = false;
    if (!localState) {
      needLoading = true;
      setLoading(true);
    } else {
      updateCanvasDataFromState(localState);
    }

    const remoteState = await getCanvasState(canvasId);
    if (!remoteState) {
      return;
    }

    let finalState: CanvasState;
    if (!localState) {
      finalState = remoteState;
    } else {
      try {
        finalState = mergeCanvasStates(localState, remoteState);
      } catch (error) {
        if (error instanceof CanvasConflictException) {
          // Show conflict modal to user
          const userChoice = await handleConflictResolution(canvasId, {
            localState,
            remoteState,
          });
          logEvent('canvas::conflict_version', userChoice, {
            canvasId,
            source: 'initial_fetch',
            localVersion: localState.version,
            remoteVersion: remoteState.version,
          });

          if (userChoice === 'local') {
            // Use local state, and set it to remote
            finalState = localState;
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
  }, 10);

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

        // Pull new transactions from server
        const remoteTxs = await pollCanvasTransactions(canvasId, version);
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
      syncCanvasData.flush();

      // Clear canvas data
      setState({ nodes: [], edges: [] });
      setLoading(false);
      setCanvasInitialized(canvasId, false);
    };
  }, [canvasId, readonly, initialFetchCanvasState, syncCanvasData]);

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
        workflowRun,
        syncCanvasData: async (options?: { syncRemote?: boolean }) => {
          await syncCanvasData();
          syncCanvasData.flush();

          if (options?.syncRemote) {
            await syncWithRemote(canvasId);
          }
        },
        undo,
        redo,
        workflow: {
          workflowVariables: workflowVariables?.data ?? [],
          workflowVariablesLoading,
          refetchWorkflowVariables,
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
