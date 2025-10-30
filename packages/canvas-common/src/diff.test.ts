import { describe, it, expect } from 'vitest';
import { calculateCanvasStateDiff } from './diff';
import type { CanvasData, CanvasNode, CanvasEdge, CanvasNodeType } from '@refly/openapi-schema';

// Use a valid CanvasNodeType for tests
const TEST_NODE_TYPE: CanvasNodeType = 'document';

// Helper to create a minimal CanvasNode
const createNode = (id: string, metadata: Record<string, any> = {}): CanvasNode => ({
  id,
  type: TEST_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { title: `Node ${id}`, entityId: id, metadata },
});

// Helper to create a minimal CanvasEdge
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

describe('calculateCanvasStateDiff', () => {
  it('should return null if there are no changes', () => {
    const from: CanvasData = { nodes: [createNode('1')], edges: [] };
    const to: CanvasData = { nodes: [createNode('1')], edges: [] };
    expect(calculateCanvasStateDiff(from, to)).toBeNull();
  });

  it('should properly handle undefined fields', () => {
    const from: CanvasData = {
      nodes: [createNode('1', { x: undefined })],
      edges: [],
    };
    const to: CanvasData = {
      nodes: [createNode('1', {})],
      edges: [],
    };
    expect(calculateCanvasStateDiff(from, to)).toBeNull();
  });

  it('should detect node addition', () => {
    const from: CanvasData = { nodes: [], edges: [] };
    const to: CanvasData = { nodes: [createNode('1')], edges: [] };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.nodeDiffs).toHaveLength(1);
    expect(diff?.nodeDiffs?.[0]).toMatchObject({ id: '1', type: 'add' });
  });

  it('should detect node deletion', () => {
    const from: CanvasData = { nodes: [createNode('1')], edges: [] };
    const to: CanvasData = { nodes: [], edges: [] };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.nodeDiffs).toHaveLength(1);
    expect(diff?.nodeDiffs?.[0]).toMatchObject({ id: '1', type: 'delete' });
  });

  it('should detect node update', () => {
    const from: CanvasData = {
      nodes: [createNode('1', { data: { title: 'Node 1', entityId: '1', contentPreview: 'A' } })],
      edges: [],
    };
    const to: CanvasData = {
      nodes: [createNode('1', { data: { title: 'Node 1', entityId: '1', contentPreview: 'B' } })],
      edges: [],
    };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.nodeDiffs).toHaveLength(1);
    expect(diff?.nodeDiffs?.[0]).toMatchObject({ id: '1', type: 'update' });
    expect(diff?.nodeDiffs?.[0]?.from).toBeDefined();
    expect(diff?.nodeDiffs?.[0]?.to).toBeDefined();
  });

  it('should detect edge addition', () => {
    const from: CanvasData = { nodes: [], edges: [] };
    const to: CanvasData = { nodes: [], edges: [createEdge('e1', '1', '2')] };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.edgeDiffs).toHaveLength(1);
    expect(diff?.edgeDiffs?.[0]).toMatchObject({ id: 'e1', type: 'add' });
  });

  it('should detect edge deletion', () => {
    const from: CanvasData = { nodes: [], edges: [createEdge('e1', '1', '2')] };
    const to: CanvasData = { nodes: [], edges: [] };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.edgeDiffs).toHaveLength(1);
    expect(diff?.edgeDiffs?.[0]).toMatchObject({ id: 'e1', type: 'delete' });
  });

  it('should not detect edge update', () => {
    const from: CanvasData = {
      nodes: [],
      edges: [createEdge('e1', '1', '2', { type: 'default' })],
    };
    const to: CanvasData = { nodes: [], edges: [createEdge('e1', '1', '2', { type: 'custom' })] };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff).toBeNull();
  });

  it('should ignore ghost nodes and temp edges', () => {
    const from: CanvasData = {
      nodes: [createNode('ghost-1'), createNode('1')],
      edges: [createEdge('temp-edge-1', '1', '2'), createEdge('e1', '1', '2')],
    };
    const to: CanvasData = {
      nodes: [
        createNode('ghost-1'),
        createNode('1', { data: { title: 'Node 1', entityId: '1', contentPreview: 'B' } }),
      ],
      edges: [createEdge('temp-edge-1', '1', '2'), createEdge('e1', '1', '2', { type: 'custom' })],
    };
    const diff = calculateCanvasStateDiff(from, to);
    // Only the real node and edge should be diffed
    expect(diff?.nodeDiffs).toHaveLength(1);
    expect(diff?.nodeDiffs?.[0].id).toBe('1');
    expect(diff?.edgeDiffs).toHaveLength(0);
  });

  it('should handle nested array diff', () => {
    const from: CanvasData = {
      nodes: [
        createNode('1', {
          content: ['hello'],
        }),
      ],
      edges: [],
    };
    const to: CanvasData = {
      nodes: [
        createNode('1', {
          content: ['world'],
        }),
      ],
      edges: [],
    };
    const diff = calculateCanvasStateDiff(from, to);
    expect(diff?.nodeDiffs).toEqual([
      {
        id: '1',
        type: 'update',
        from: { data: { metadata: { content: ['hello'] } } },
        to: { data: { metadata: { content: ['world'] } } },
      },
    ]);
    expect(diff?.edgeDiffs).toHaveLength(0);
  });
});
