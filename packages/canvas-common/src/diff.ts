import {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasTransaction,
  NodeDiff,
  EdgeDiff,
} from '@refly/openapi-schema';
import { genTransactionId } from '@refly/utils';

const NODE_DIFF_IGNORE_KEYS = ['id', 'selected', 'dragging', 'style.zIndex'];
const EDGE_DIFF_IGNORE_KEYS = ['id', 'data.hover'];

/**
 * Deep compare two objects excluding the 'id' and other fields that are not relevant
 */
const deepCompareExcludingId = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepCompareExcludingId(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1).filter((key) => key !== 'id' && key !== 'selected');
  const keys2 = Object.keys(obj2).filter((key) => key !== 'id' && key !== 'selected');

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepCompareExcludingId(obj1[key], obj2[key])) return false;
  }

  return true;
};

const shouldIgnoreKey = (type: 'node' | 'edge', key: string, parentKeys?: string[]): boolean => {
  const actualKey = parentKeys ? `${parentKeys.join('.')}.${key}` : key;
  if (type === 'node') {
    return NODE_DIFF_IGNORE_KEYS.includes(actualKey);
  } else {
    return EDGE_DIFF_IGNORE_KEYS.includes(actualKey);
  }
};

/**
 * Calculate only the changed fields between two objects
 * @param from - Original object
 * @param to - Target object
 * @returns Object containing only the changed fields, or null if no changes
 */
const calculateFieldDiff = (
  type: 'node' | 'edge',
  from: any,
  to: any,
  parentKeys?: string[],
): { before: any; after: any } | null => {
  if (!from || !to || typeof from !== 'object' || typeof to !== 'object') {
    return {
      before: from,
      after: to,
    };
  }

  const beforeDiff: any = {};
  const afterDiff: any = {};
  let hasChanges = false;

  // Get all keys from both objects, excluding 'id' and 'selected'
  const allKeys = new Set([
    ...Object.keys(from).filter((key) => !shouldIgnoreKey(type, key, parentKeys)),
    ...Object.keys(to).filter((key) => !shouldIgnoreKey(type, key, parentKeys)),
  ]);

  for (const key of allKeys) {
    const fromValue = from[key];
    const toValue = to[key];

    // If field doesn't exist in 'from' but exists in 'to', it's a new field
    if (!(key in from) && key in to) {
      beforeDiff[key] = undefined;
      afterDiff[key] = toValue;
      hasChanges = true;
    }
    // If field exists in 'from' but not in 'to', it's being deleted
    else if (key in from && !(key in to)) {
      beforeDiff[key] = fromValue;
      afterDiff[key] = undefined;
      hasChanges = true;
    }
    // If field exists in both, compare values
    else if (!deepCompareExcludingId(fromValue, toValue)) {
      // For nested objects, we need to handle them properly
      if (
        typeof fromValue === 'object' &&
        typeof toValue === 'object' &&
        fromValue !== null &&
        toValue !== null
      ) {
        const nestedDiff = calculateFieldDiff(type, fromValue, toValue, [
          ...(parentKeys ?? []),
          key,
        ]);
        if (nestedDiff) {
          beforeDiff[key] = nestedDiff.before;
          afterDiff[key] = nestedDiff.after;
          hasChanges = true;
        }
      } else {
        beforeDiff[key] = fromValue;
        afterDiff[key] = toValue;
        hasChanges = true;
      }
    }
  }

  return hasChanges ? { before: beforeDiff, after: afterDiff } : null;
};

/**
 * Calculate the diff (transaction) between two canvas states
 * @param from - Original canvas state
 * @param to - Target canvas state
 * @returns Canvas transaction containing the diff, or null if no changes
 */
export const calculateCanvasStateDiff = (
  from: CanvasData,
  to: CanvasData,
): CanvasTransaction | null => {
  const nodeDiffs: NodeDiff[] = [];
  const edgeDiffs: EdgeDiff[] = [];

  // Create lookup maps for efficient comparison
  const fromNodesMap = new Map<string, CanvasNode>();
  const toNodesMap = new Map<string, CanvasNode>();
  const fromEdgesMap = new Map<string, CanvasEdge>();
  const toEdgesMap = new Map<string, CanvasEdge>();

  // Populate the lookup maps
  for (const node of from.nodes) {
    fromNodesMap.set(node.id, node);
  }
  for (const node of to.nodes) {
    toNodesMap.set(node.id, node);
  }
  for (const edge of from.edges) {
    fromEdgesMap.set(edge.id, edge);
  }
  for (const edge of to.edges) {
    toEdgesMap.set(edge.id, edge);
  }

  // Process node diffs
  const allNodeIds = new Set([...fromNodesMap.keys(), ...toNodesMap.keys()]);
  for (const nodeId of allNodeIds) {
    // Always ignore ghost nodes
    if (nodeId.startsWith('ghost-')) {
      continue;
    }

    const fromNode = fromNodesMap.get(nodeId);
    const toNode = toNodesMap.get(nodeId);

    if (!fromNode && toNode) {
      // Node was added
      nodeDiffs.push({
        id: nodeId,
        type: 'add',
        to: { ...toNode, selected: undefined }, // the selected field should not be initialized and tracked
      });
    } else if (fromNode && !toNode) {
      // Node was deleted
      nodeDiffs.push({
        id: nodeId,
        type: 'delete',
        from: fromNode,
      });
    } else if (fromNode && toNode) {
      // Node exists in both states, check if it was modified
      if (!deepCompareExcludingId(fromNode, toNode)) {
        const fieldDiff = calculateFieldDiff('node', fromNode, toNode);
        if (fieldDiff) {
          nodeDiffs.push({
            id: nodeId,
            type: 'update',
            from: fieldDiff.before,
            to: fieldDiff.after,
          });
        }
      }
    }
  }

  // Process edge diffs
  const allEdgeIds = new Set([...fromEdgesMap.keys(), ...toEdgesMap.keys()]);
  for (const edgeId of allEdgeIds) {
    // Always ignore temp edges
    if (edgeId.startsWith('temp-edge-')) {
      continue;
    }

    const fromEdge = fromEdgesMap.get(edgeId);
    const toEdge = toEdgesMap.get(edgeId);

    if (!fromEdge && toEdge) {
      // Edge was added
      edgeDiffs.push({
        id: edgeId,
        type: 'add',
        to: toEdge,
      });
    } else if (fromEdge && !toEdge) {
      // Edge was deleted
      edgeDiffs.push({
        id: edgeId,
        type: 'delete',
        from: fromEdge,
      });
    } else if (fromEdge && toEdge) {
      // Edge exists in both states, check if it was modified
      if (!deepCompareExcludingId(fromEdge, toEdge)) {
        const fieldDiff = calculateFieldDiff('edge', fromEdge, toEdge);
        if (fieldDiff) {
          edgeDiffs.push({
            id: edgeId,
            type: 'update',
            from: fieldDiff.before,
            to: fieldDiff.after,
          });
        }
      }
    }
  }

  if (!nodeDiffs.length && !edgeDiffs.length) {
    return null;
  }

  return {
    txId: genTransactionId(),
    nodeDiffs,
    edgeDiffs,
    createdAt: Date.now(),
  };
};
