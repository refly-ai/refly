/**
 * Graph utilities for visualizing workflow DAG
 */

import { BuilderSession, WorkflowNode } from './schema.js';

export interface Edge {
  from: string;
  to: string;
}

export interface GraphOutput {
  nodes: Array<{
    id: string;
    type: string;
    dependsOn: string[];
  }>;
  edges: Edge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    rootNodes: string[];
    leafNodes: string[];
  };
}

/**
 * Generate graph representation of the workflow
 */
export function generateGraph(session: BuilderSession): GraphOutput {
  const nodes = session.workflowDraft.nodes;
  const edges: Edge[] = [];

  // Build edges from dependencies
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      edges.push({ from: depId, to: node.id });
    }
  }

  // Find root nodes (no dependencies)
  const rootNodes = nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);

  // Find leaf nodes (no one depends on them)
  const hasDependent = new Set<string>();
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      hasDependent.add(depId);
    }
  }
  const leafNodes = nodes.filter((n) => !hasDependent.has(n.id)).map((n) => n.id);

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      dependsOn: n.dependsOn,
    })),
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      rootNodes,
      leafNodes,
    },
  };
}

/**
 * Get topological order of nodes (for execution)
 */
export function getTopologicalOrder(nodes: WorkflowNode[]): string[] {
  const nodeMap = new Map<string, WorkflowNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      adjacency.get(depId)?.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes that have no dependencies
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    for (const dependent of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  return result;
}

/**
 * Generate ASCII representation of the graph
 */
export function generateAsciiGraph(session: BuilderSession): string {
  const graph = generateGraph(session);

  if (graph.nodes.length === 0) {
    return '(empty workflow)';
  }

  const lines: string[] = [];
  lines.push(`Workflow: ${session.workflowDraft.name}`);
  lines.push(`Nodes: ${graph.stats.nodeCount}, Edges: ${graph.stats.edgeCount}`);
  lines.push('');

  // Get execution order
  const order = getTopologicalOrder(session.workflowDraft.nodes);

  for (const nodeId of order) {
    const node = session.workflowDraft.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const isRoot = graph.stats.rootNodes.includes(nodeId);
    const isLeaf = graph.stats.leafNodes.includes(nodeId);

    let prefix = '  ';
    if (isRoot) prefix = '> ';
    if (isLeaf) prefix = '* ';

    const deps = node.dependsOn.length > 0 ? ` <- [${node.dependsOn.join(', ')}]` : '';
    lines.push(`${prefix}[${node.id}] ${node.type}${deps}`);
  }

  lines.push('');
  lines.push('Legend: > root, * leaf');

  return lines.join('\n');
}
