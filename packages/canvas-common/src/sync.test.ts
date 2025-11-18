import { describe, it, expect } from 'vitest';
import {
  initEmptyCanvasState,
  applyCanvasTransaction,
  getCanvasDataFromState,
  updateCanvasState,
  mergeCanvasStates,
  CanvasConflictException,
  shouldCreateNewVersion,
} from './sync';
import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  CanvasTransaction,
  CanvasNodeType,
  CanvasData,
  NodeDiff,
  EdgeDiff,
} from '@refly/openapi-schema';

const TEST_NODE_TYPE: CanvasNodeType = 'document';
const createNode = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  type: TEST_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { title: `Node ${id}`, entityId: id },
  ...extra,
});
const createEdge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<CanvasEdge> = {},
): CanvasEdge => ({
  id,
  source,
  target,
  type: 'default',
  ...extra,
});
const createTx = (
  id: string,
  nodeDiffs: NodeDiff[] = [],
  edgeDiffs: EdgeDiff[] = [],
  extra: Partial<CanvasTransaction> = {},
): CanvasTransaction => ({
  txId: id,
  createdAt: Date.now(),
  nodeDiffs,
  edgeDiffs,
  revoked: false,
  deleted: false,
  ...extra,
});

describe('initEmptyCanvasState', () => {
  it('should return a valid empty canvas state', () => {
    const state = initEmptyCanvasState();
    expect(state.nodes).toEqual([
      {
        type: 'start',
        id: expect.any(String),
        position: { x: 0, y: 0 },
        data: { title: 'Start', entityId: expect.any(String) },
        selected: false,
        dragging: false,
      },
      {
        type: 'skillResponse',
        id: expect.any(String),
        position: { x: 400, y: 0 },
        data: {
          title: 'skillResponse',
          entityId: expect.any(String),
          metadata: {
            status: 'init',
          },
        },
        selected: false,
        dragging: false,
      },
    ]);
    expect(state.edges).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.history).toEqual([]);
    expect(typeof state.version).toBe('string');
  });
});

describe('applyCanvasTransaction', () => {
  it('should add a node and edge', () => {
    const data: CanvasData = { nodes: [], edges: [] };
    const node = createNode('n1');
    const edge = createEdge('e1', 'n1', 'n2');
    const tx = createTx(
      'tx1',
      [{ type: 'add', id: 'n1', to: node }],
      [{ type: 'add', id: 'e1', to: edge }],
    );
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).toContainEqual(node);
    expect(result.edges).toContainEqual(edge);
  });
  it('should update a node', () => {
    const node = createNode('n1', { data: { title: 'Old', entityId: 'n1' } });
    const updated = { ...node, data: { ...node.data, title: 'New' } };
    const data: CanvasData = { nodes: [node], edges: [] };
    const tx = createTx('tx2', [{ type: 'update', id: 'n1', from: node, to: updated }]);
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).toContainEqual(updated);
  });
  it('should delete a node', () => {
    const node = createNode('n1');
    const data: CanvasData = { nodes: [node], edges: [] };
    const tx = createTx('tx3', [{ type: 'delete', id: 'n1', from: node }]);
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).not.toContainEqual(node);
  });
  it('should reverse a transaction', () => {
    const node = createNode('n1');
    const data: CanvasData = { nodes: [], edges: [] };
    const tx = createTx('tx4', [{ type: 'add', id: 'n1', to: node }]);
    const result = applyCanvasTransaction(data, tx, { reverse: true });
    expect(result.nodes).not.toContainEqual(node);
  });
});

describe('getCanvasDataFromState', () => {
  it('should replay transactions on initial state', () => {
    const node = createNode('n1');
    const tx = createTx('tx1', [{ type: 'add', id: 'n1', to: node }]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    expect(data.nodes).toContainEqual(node);
  });
  it('should skip revoked/deleted transactions', () => {
    const node = createNode('n1');
    const tx = createTx('tx1', [{ type: 'add', id: 'n1', to: node }], [], { revoked: true });
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    expect(data.nodes).not.toContainEqual(node);
  });
});

describe('getCanvasDataFromState - parent/child ordering', () => {
  it('should order parent before child for single parent-child', () => {
    const parent = createNode('p');
    const child = createNode('c', { parentId: 'p' });
    const tx1 = createTx('tx1', [
      { type: 'add', id: 'p', to: parent },
      { type: 'add', id: 'c', to: child },
    ]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    const parentIdx = data.nodes.findIndex((n) => n.id === 'p');
    const childIdx = data.nodes.findIndex((n) => n.id === 'c');
    expect(parentIdx).toBeLessThan(childIdx);
    expect(data.nodes[childIdx].parentId).toBe('p');
  });

  it('should order deep nested parents before children', () => {
    const root = createNode('root');
    const mid = createNode('mid', { parentId: 'root' });
    const leaf = createNode('leaf', { parentId: 'mid' });
    const tx = createTx('tx2', [
      { type: 'add', id: 'root', to: root },
      { type: 'add', id: 'mid', to: mid },
      { type: 'add', id: 'leaf', to: leaf },
    ]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    const idxRoot = data.nodes.findIndex((n) => n.id === 'root');
    const idxMid = data.nodes.findIndex((n) => n.id === 'mid');
    const idxLeaf = data.nodes.findIndex((n) => n.id === 'leaf');
    expect(idxRoot).toBeLessThan(idxMid);
    expect(idxMid).toBeLessThan(idxLeaf);
    expect(data.nodes[idxMid].parentId).toBe('root');
    expect(data.nodes[idxLeaf].parentId).toBe('mid');
  });

  it('should handle multiple roots and children', () => {
    const a = createNode('a');
    const b = createNode('b');
    const c = createNode('c', { parentId: 'a' });
    const d = createNode('d', { parentId: 'b' });
    const tx = createTx('tx3', [
      { type: 'add', id: 'a', to: a },
      { type: 'add', id: 'b', to: b },
      { type: 'add', id: 'c', to: c },
      { type: 'add', id: 'd', to: d },
    ]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    const idxA = data.nodes.findIndex((n) => n.id === 'a');
    const idxB = data.nodes.findIndex((n) => n.id === 'b');
    const idxC = data.nodes.findIndex((n) => n.id === 'c');
    const idxD = data.nodes.findIndex((n) => n.id === 'd');
    expect(idxA).toBeLessThan(idxC);
    expect(idxB).toBeLessThan(idxD);
    expect(data.nodes[idxC].parentId).toBe('a');
    expect(data.nodes[idxD].parentId).toBe('b');
  });

  it('should not infinite loop on cycle (cycle is not valid, but should not crash)', () => {
    const a = createNode('a', { parentId: 'b' });
    const b = createNode('b', { parentId: 'a' });
    const tx = createTx('tx4', [
      { type: 'add', id: 'a', to: a },
      { type: 'add', id: 'b', to: b },
    ]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    // Should not throw or hang
    const data = getCanvasDataFromState(state);
    expect(data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });
});

describe('updateCanvasState', () => {
  it('should add new transactions', () => {
    const tx = createTx('tx1');
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    const updated = updateCanvasState(state, [tx]);
    expect(updated.transactions).toContainEqual(tx);
  });
  it('should replace existing transactions by txId', () => {
    const tx1 = createTx('tx1', [{ type: 'add' as const, id: 'n1', to: createNode('n1') }]);
    const tx2 = {
      ...tx1,
      nodeDiffs: [{ type: 'delete' as const, id: 'n1', from: createNode('n1') }],
    };
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const updated = updateCanvasState(state, [tx2]);
    expect(updated.transactions?.find((t) => t.txId === 'tx1')?.nodeDiffs[0].type).toBe('delete');
  });
  it('should sort transactions by createdAt', () => {
    const tx1 = createTx('tx1', [], [], { createdAt: 2 });
    const tx2 = createTx('tx2', [], [], { createdAt: 1 });
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const updated = updateCanvasState(state, [tx2]);
    expect(updated.transactions?.[0].txId).toBe('tx2');
    expect(updated.transactions?.[1].txId).toBe('tx1');
  });
});

describe('mergeCanvasStates', () => {
  it('should return local if version and transactions are identical', () => {
    const tx = createTx('tx1');
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const remote = { ...local };
    expect(mergeCanvasStates(local, remote)).toBe(local);
  });
  it('should merge non-conflicting transactions', () => {
    const tx1 = createTx('tx1', [{ type: 'add', id: 'n1', to: createNode('n1') }]);
    const tx2 = createTx('tx2', [{ type: 'add', id: 'n2', to: createNode('n2') }]);
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx2],
      history: [],
    };
    const merged = mergeCanvasStates(local, remote);
    expect(merged.transactions).toHaveLength(2);
    expect(merged.transactions?.some((t) => t.txId === 'tx1')).toBe(true);
    expect(merged.transactions?.some((t) => t.txId === 'tx2')).toBe(true);
  });
  it('should throw CanvasConflictException for conflicting transactions', () => {
    const tx1 = createTx('tx1', [{ type: 'add', id: 'n1', to: createNode('n1') }]);
    const tx2 = createTx('tx2', [
      {
        type: 'update',
        id: 'n1',
        from: createNode('n1'),
        to: createNode('n1', { data: { title: 'Changed', entityId: 'n1' } }),
      },
    ]);
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx2],
      history: [],
    };
    expect(() => mergeCanvasStates(local, remote)).toThrow(CanvasConflictException);
  });
  it('should throw CanvasConflictException for version conflict', () => {
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v2',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    expect(() => mergeCanvasStates(local, remote)).toThrow(CanvasConflictException);
  });
});

describe('CanvasConflictException', () => {
  it('should set properties and message', () => {
    const node = createNode('n1');
    const err = new CanvasConflictException('node', 'n1', node, node);
    expect(err.conflictType).toBe('node');
    expect(err.itemId).toBe('n1');
    expect(err.state1Item).toBe(node);
    expect(err.state2Item).toBe(node);
    expect(err.message).toContain('Canvas conflict detected');
    expect(err.name).toBe('CanvasConflictException');
  });
});

describe('shouldCreateNewVersion', () => {
  it('should return false when no transactions exist', () => {
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(false);
  });

  it('should return false when transactions array is undefined', () => {
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: undefined,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(false);
  });

  it('should return true when transaction count exceeds MAX_STATE_TX_COUNT', () => {
    const transactions = Array.from({ length: 101 }, (_, i) =>
      createTx(`tx${i}`, [], [], { createdAt: Date.now() - i * 1000 }),
    );
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(true);
  });

  it('should return false when transaction count is exactly MAX_STATE_TX_COUNT', () => {
    const transactions = Array.from({ length: 100 }, (_, i) =>
      createTx(`tx${i}`, [], [], { createdAt: Date.now() - i * 1000 }),
    );
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(false);
  });

  it('should return true when last transaction is older than MAX_VERSION_AGE', () => {
    const oldTimestamp = Date.now() - (1000 * 60 * 60 + 1000); // 1 hour + 1 second ago
    const transactions = [createTx('tx1', [], [], { createdAt: oldTimestamp })];
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(true);
  });

  it('should return false when last transaction is exactly MAX_VERSION_AGE old', () => {
    const exactTimestamp = Date.now() - 1000 * 60 * 60; // Exactly 1 hour ago
    const transactions = [createTx('tx1', [], [], { createdAt: exactTimestamp })];
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(false);
  });

  it('should return false when last transaction is newer than MAX_VERSION_AGE', () => {
    const recentTimestamp = Date.now() - 1000 * 60 * 30; // 30 minutes ago
    const transactions = [createTx('tx1', [], [], { createdAt: recentTimestamp })];
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(false);
  });

  it('should return true when both conditions are met (count and age)', () => {
    const oldTimestamp = Date.now() - (1000 * 60 * 60 + 1000); // 1 hour + 1 second ago
    const transactions = Array.from({ length: 101 }, (_, i) =>
      createTx(`tx${i}`, [], [], { createdAt: oldTimestamp }),
    );
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(shouldCreateNewVersion(state)).toBe(true);
  });

  it('should handle transactions with different timestamps correctly', () => {
    const now = Date.now();
    const transactions = [
      createTx('tx1', [], [], { createdAt: now - 1000 }), // 1 second ago
      createTx('tx2', [], [], { createdAt: now - 2000 }), // 2 seconds ago
      createTx('tx3', [], [], { createdAt: now - 3000 }), // 3 seconds ago
    ];
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    // Should check the last transaction (tx3) which is 3 seconds ago
    expect(shouldCreateNewVersion(state)).toBe(false);
  });
});
