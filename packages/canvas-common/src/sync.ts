import {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  CanvasTransaction,
  CanvasData,
  ModelInfo,
} from '@refly/openapi-schema';
import {
  genCanvasVersionId,
  genStartID,
  genNodeID,
  deepmerge,
  genNodeEntityId,
} from '@refly/utils';
import { deduplicateNodes, deduplicateEdges, prepareAddNode } from './utils';
import { MAX_STATE_TX_COUNT, MAX_VERSION_AGE } from './constants';

export interface InitEmptyCanvasOptions {
  /** Default model info for the initial skillResponse node */
  defaultModelInfo?: ModelInfo;
}

export const initEmptyCanvasState = (options?: InitEmptyCanvasOptions): CanvasState => {
  // Create a start node for the initial canvas
  const startNode: CanvasNode = {
    id: genNodeID(),
    type: 'start',
    position: { x: 0, y: 0 },
    data: {
      title: 'Start',
      entityId: genStartID(),
    },
    selected: false,
    dragging: false,
  };

  // Create a skillResponse node positioned horizontally to the right of the start node
  const skillResponseNode: CanvasNode = {
    id: genNodeID(),
    type: 'skillResponse',
    position: { x: 400, y: 0 },
    data: {
      title: '',
      entityId: genNodeEntityId('skillResponse'),
      metadata: {
        status: 'init',
        modelInfo: options?.defaultModelInfo,
      },
    },
    selected: false,
    dragging: false,
  };

  return {
    version: genCanvasVersionId(),
    nodes: [startNode, skillResponseNode],
    edges: [],
    transactions: [],
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

/**
 * Check if a new version should be created for a canvas state
 * @param state - The canvas state
 * @returns True if a new version should be created, false otherwise
 */
export const shouldCreateNewVersion = (state: CanvasState): boolean => {
  const lastTransaction = getLastTransaction(state);
  if (!lastTransaction) {
    return false;
  }

  const lastTransactionTs = lastTransaction.createdAt;
  const now = Date.now();

  return (
    (state.transactions?.length ?? 0) > MAX_STATE_TX_COUNT ||
    lastTransactionTs < now - MAX_VERSION_AGE
  );
};

export const applyCanvasTransaction = (
  data: CanvasData,
  tx: CanvasTransaction,
  options?: { reverse?: boolean },
): CanvasData => {
  // Start with a copy of the current state
  let newNodes = [...(data.nodes ?? [])];
  let newEdges = [...(data.edges ?? [])];

  // Helper to get reverse type and swap from/to
  const getReverseNodeDiff = (diff: (typeof tx.nodeDiffs)[number]) => {
    switch (diff.type) {
      case 'add':
        return { type: 'delete', id: diff.to?.id ?? diff.id };
      case 'delete':
        return { type: 'add', to: diff.from, id: diff.id };
      case 'update':
        return { type: 'update', id: diff.id, from: diff.to, to: diff.from };
      default:
        return diff;
    }
  };
  const getReverseEdgeDiff = (diff: (typeof tx.edgeDiffs)[number]) => {
    switch (diff.type) {
      case 'add':
        return { type: 'delete', id: diff.to?.id ?? diff.id };
      case 'delete':
        return { type: 'add', to: diff.from, id: diff.id };
      case 'update':
        return { type: 'update', id: diff.id, from: diff.to, to: diff.from };
      default:
        return diff;
    }
  };

  const nodeDiffs = options?.reverse ? tx.nodeDiffs.map(getReverseNodeDiff) : tx.nodeDiffs;
  const edgeDiffs = options?.reverse ? tx.edgeDiffs.map(getReverseEdgeDiff) : tx.edgeDiffs;

  // Apply node diffs
  for (const nodeDiff of nodeDiffs) {
    switch (nodeDiff.type) {
      case 'add':
        if (nodeDiff.to) {
          const nodeToAdd = nodeDiff.to as CanvasNode;
          // Check if node has parentResultId and auto-connect to parent
          const parentResultId = nodeToAdd.data?.metadata?.parentResultId;
          if (parentResultId && typeof parentResultId === 'string') {
            const { newEdges: parentEdges } = prepareAddNode({
              node: nodeToAdd,
              nodes: newNodes,
              edges: newEdges,
              connectTo: [{ type: 'skillResponse', entityId: parentResultId }],
              autoLayout: true,
            });
            newEdges.push(...parentEdges);
          }
          newNodes.push(nodeToAdd);
        }
        break;
      case 'update':
        newNodes = newNodes.map((node) => {
          if (node.id === nodeDiff.id && nodeDiff.to) {
            const updatedNode = deepmerge(node, nodeDiff.to);
            return updatedNode as CanvasNode;
          }
          return node;
        });
        break;
      case 'delete':
        newNodes = newNodes.filter((node) => node.id !== nodeDiff.id);
        break;
    }
  }

  // Apply edge diffs
  for (const edgeDiff of edgeDiffs) {
    switch (edgeDiff.type) {
      case 'add':
        if (edgeDiff.to) {
          newEdges.push(edgeDiff.to);
        }
        break;
      case 'update':
        newEdges = newEdges.map((edge) => {
          if (edge.id === edgeDiff.id && edgeDiff.to) {
            const updatedEdge = deepmerge(edge, edgeDiff.to);
            return updatedEdge;
          }
          return edge;
        });
        break;
      case 'delete':
        newEdges = newEdges.filter((edge) => edge.id !== edgeDiff.id);
        break;
    }
  }

  return {
    nodes: deduplicateNodes(newNodes),
    edges: deduplicateEdges(newEdges),
  };
};

/**
 * Topologically sort nodes so that parents always come before their children.
 * @param nodes - The array of CanvasNode
 * @returns Sorted array of CanvasNode
 */
function sortNodesByParent(nodes: CanvasNode[]): CanvasNode[] {
  // Build a map from id to node
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  // Track visited nodes
  const visited = new Set<string>();
  // Result array
  const result: CanvasNode[] = [];

  // Helper for DFS
  function visit(node: CanvasNode) {
    if (visited.has(node.id)) return;
    // Mark as visited BEFORE recursing to parent to prevent infinite loop on cycles
    visited.add(node.id);
    // Visit parent first if exists and is in the map
    if (node.parentId && nodeMap.has(node.parentId)) {
      visit(nodeMap.get(node.parentId)!);
    }
    result.push(node);
  }

  // Visit all nodes
  for (const node of nodes) {
    visit(node);
  }
  return result;
}

/**
 * Get actual canvas data from canvas initial state and replayed transactions
 * @param state - The canvas state
 * @returns The canvas data
 */
export const getCanvasDataFromState = (state: CanvasState): CanvasData => {
  if (!state) {
    return {
      nodes: [],
      edges: [],
    };
  }

  let currentData = {
    nodes: state.nodes,
    edges: state.edges,
  };

  for (const transaction of state.transactions ?? []) {
    if (!transaction.revoked && !transaction.deleted) {
      currentData = applyCanvasTransaction(currentData, transaction);
    }
  }

  // Ensure parentId is set and parents come before children
  const sortedNodes = sortNodesByParent(currentData.nodes ?? []);

  // Ensure hover and selected for edges are reset
  const normalizedEdges = (currentData.edges ?? []).map((edge) =>
    deepmerge(edge, { data: { hover: false, selected: false } }),
  );

  return {
    nodes: sortedNodes,
    edges: normalizedEdges,
  };
};

/**
 * Get the last transaction from canvas state
 * @param state - The canvas state
 * @returns The last transaction
 */
export const getLastTransaction = (state: CanvasState): CanvasTransaction | null => {
  if (!state.transactions?.length) {
    return null;
  }
  return state.transactions[state.transactions.length - 1];
};

export class CanvasConflictException extends Error {
  constructor(
    public readonly conflictType: 'version' | 'node' | 'edge',
    public readonly itemId?: string,
    public readonly state1Item?: CanvasNode | CanvasEdge,
    public readonly state2Item?: CanvasNode | CanvasEdge,
  ) {
    super(`Canvas conflict detected for ${conflictType} with id: ${itemId}`);
    this.name = 'CanvasConflictException';
  }
}

/**
 * Update canvas state with new transactions, used by server
 * @param state - The current canvas state
 * @param transactions - The new transactions
 * @returns The updated canvas state
 */
export const updateCanvasState = (
  state: CanvasState,
  transactions: CanvasTransaction[],
): CanvasState => {
  state.transactions ??= [];

  // Create a map for quick lookup of existing transactions by txId
  const txMap = new Map(state.transactions.map((tx) => [tx.txId, tx]));

  for (const transaction of transactions) {
    if (txMap.has(transaction.txId)) {
      // Replace the existing transaction with the new one
      const index = state.transactions.findIndex((tx) => tx.txId === transaction.txId);
      if (index !== -1) {
        state.transactions[index] = transaction;
      }
    } else {
      // Add the new transaction if it does not exist
      state.transactions.push(transaction);
    }
  }

  state.transactions.sort((a, b) => a.createdAt - b.createdAt);

  return state;
};

/**
 * Merge two canvas states with conflict detection
 * @param local Local canvas state
 * @param remote Remote canvas state
 * @returns Merged canvas state
 * @throws CanvasConflictException if conflicts are detected
 */
export const mergeCanvasStates = (local: CanvasState, remote: CanvasState): CanvasState => {
  // Rule 0: If versions are different, throw conflict exception
  if (local.version !== remote.version) {
    throw new CanvasConflictException('version');
  }

  // Rule 1: If version and transactions are completely the same, return either local or remote
  const localTxIds = new Set(local.transactions?.map((tx) => tx.txId) ?? []);
  const remoteTxIds = new Set(remote.transactions?.map((tx) => tx.txId) ?? []);

  // Check if transactions are exactly the same
  if (
    localTxIds.size === remoteTxIds.size &&
    [...localTxIds].every((txId) => remoteTxIds.has(txId))
  ) {
    return local; // Return local as they are identical
  }

  // Rule 2: Same version, different transactions
  // Find transactions that exist only in local or only in remote
  const localOnlyTxIds = new Set([...localTxIds].filter((txId) => !remoteTxIds.has(txId)));
  const remoteOnlyTxIds = new Set([...remoteTxIds].filter((txId) => !localTxIds.has(txId)));

  const localTxMap = new Map(local.transactions?.map((tx) => [tx.txId, tx]) ?? []);
  const remoteTxMap = new Map(remote.transactions?.map((tx) => [tx.txId, tx]) ?? []);

  // Check for conflicts - find object IDs that are modified by different transactions
  const localModifiedIds = new Set<string>();
  const remoteModifiedIds = new Set<string>();

  // Collect all modified object IDs from local-only transactions
  for (const txId of localOnlyTxIds) {
    const tx = localTxMap.get(txId);
    if (tx) {
      for (const nodeDiff of tx.nodeDiffs) {
        localModifiedIds.add(nodeDiff.id);
      }
      for (const edgeDiff of tx.edgeDiffs) {
        localModifiedIds.add(edgeDiff.id);
      }
    }
  }

  // Collect all modified object IDs from remote-only transactions
  for (const txId of remoteOnlyTxIds) {
    const tx = remoteTxMap.get(txId);
    if (tx) {
      for (const nodeDiff of tx.nodeDiffs) {
        remoteModifiedIds.add(nodeDiff.id);
      }
      for (const edgeDiff of tx.edgeDiffs) {
        remoteModifiedIds.add(edgeDiff.id);
      }
    }
  }

  // Check for conflicts - if same object ID is modified by both local and remote
  const conflictingIds = [...localModifiedIds].filter((id) => remoteModifiedIds.has(id));

  if (conflictingIds.length > 0) {
    // Rule 2.2: Same object IDs modified - throw conflict exception
    const conflictingId = conflictingIds[0];

    // Find the conflicting items
    let localItem: CanvasNode | CanvasEdge | undefined;
    let remoteItem: CanvasNode | CanvasEdge | undefined;
    let conflictType: 'node' | 'edge' = 'node';

    // Find local conflicting item
    for (const txId of localOnlyTxIds) {
      const tx = localTxMap.get(txId);
      if (tx) {
        const nodeDiff = tx.nodeDiffs.find((diff) => diff.id === conflictingId);
        if (nodeDiff) {
          localItem = (nodeDiff.to as CanvasNode) || (nodeDiff.from as CanvasNode);
          conflictType = 'node';
          break;
        }
        const edgeDiff = tx.edgeDiffs.find((diff) => diff.id === conflictingId);
        if (edgeDiff) {
          localItem = edgeDiff.to || edgeDiff.from;
          conflictType = 'edge';
          break;
        }
      }
    }

    // Find remote conflicting item
    for (const txId of remoteOnlyTxIds) {
      const tx = remoteTxMap.get(txId);
      if (tx) {
        const nodeDiff = tx.nodeDiffs.find((diff) => diff.id === conflictingId);
        if (nodeDiff) {
          remoteItem = (nodeDiff.to as CanvasNode) || (nodeDiff.from as CanvasNode);
          break;
        }
        const edgeDiff = tx.edgeDiffs.find((diff) => diff.id === conflictingId);
        if (edgeDiff) {
          remoteItem = edgeDiff.to || edgeDiff.from;
          break;
        }
      }
    }

    if (localItem && remoteItem) {
      throw new CanvasConflictException(conflictType, conflictingId, localItem, remoteItem);
    }
  }

  // Rule 2.1: Different object IDs modified - merge transactions
  const mergedTransactions: CanvasTransaction[] = [];

  // Add all transactions from local
  for (const tx of local.transactions ?? []) {
    mergedTransactions.push(tx);
  }

  // Add transactions that only exist in remote
  for (const txId of remoteOnlyTxIds) {
    const tx = remoteTxMap.get(txId);
    if (tx) {
      mergedTransactions.push(tx);
    }
  }

  // Sort by createdAt
  mergedTransactions.sort((a, b) => a.createdAt - b.createdAt);

  return {
    version: local.version, // Same version
    nodes: local.nodes, // Use local as base
    edges: local.edges, // Use local as base
    transactions: mergedTransactions,
    history: local.history, // Use local history
  };
};
