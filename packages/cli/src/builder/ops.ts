/**
 * Builder operations - add, update, remove, connect nodes
 */

import { BuilderSession, WorkflowNode, NodeSchema, Diff } from './schema.js';
import { invalidate, requireEditable } from './state.js';
import { BuilderError } from '../utils/errors.js';
import { ErrorCodes } from '../utils/output.js';

/**
 * Add a node to the draft
 */
export function addNode(
  session: BuilderSession,
  nodeData: unknown,
): { node: WorkflowNode; diff: Diff } {
  requireEditable(session);

  // Parse and validate node
  const node = NodeSchema.parse(nodeData);

  // Check for duplicate ID
  const existing = session.workflowDraft.nodes.find((n) => n.id === node.id);
  if (existing) {
    throw new BuilderError(
      ErrorCodes.DUPLICATE_NODE_ID,
      `Node with ID "${node.id}" already exists`,
      { nodeId: node.id },
      'Use a different node ID or update the existing node',
    );
  }

  // Add node
  session.workflowDraft.nodes.push(node);

  // Invalidate validation
  invalidate(session);

  const diff: Diff = {
    action: 'add',
    nodeId: node.id,
    after: node,
  };

  return { node, diff };
}

/**
 * Update an existing node
 */
export function updateNode(
  session: BuilderSession,
  nodeId: string,
  patch: Record<string, unknown>,
): { node: WorkflowNode; diff: Diff } {
  requireEditable(session);

  // Find node
  const index = session.workflowDraft.nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) {
    throw new BuilderError(
      ErrorCodes.NODE_NOT_FOUND,
      `Node "${nodeId}" not found`,
      { nodeId },
      'Check node ID with `refly builder status`',
    );
  }

  const before = { ...session.workflowDraft.nodes[index] };

  // Apply patch (except ID which cannot be changed)
  const updated = {
    ...before,
    ...patch,
    id: nodeId, // Preserve original ID
  };

  // Validate updated node
  const node = NodeSchema.parse(updated);
  session.workflowDraft.nodes[index] = node;

  // Invalidate validation
  invalidate(session);

  const diff: Diff = {
    action: 'update',
    nodeId: node.id,
    before,
    after: node,
  };

  return { node, diff };
}

/**
 * Remove a node from the draft
 */
export function removeNode(
  session: BuilderSession,
  nodeId: string,
): { removed: WorkflowNode; diff: Diff; cleanedDeps: string[] } {
  requireEditable(session);

  // Find node
  const index = session.workflowDraft.nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) {
    throw new BuilderError(
      ErrorCodes.NODE_NOT_FOUND,
      `Node "${nodeId}" not found`,
      { nodeId },
      'Check node ID with `refly builder status`',
    );
  }

  const removed = session.workflowDraft.nodes[index];

  // Remove the node
  session.workflowDraft.nodes.splice(index, 1);

  // Clean up dependencies referencing this node
  const cleanedDeps: string[] = [];
  for (const node of session.workflowDraft.nodes) {
    const depIndex = node.dependsOn.indexOf(nodeId);
    if (depIndex !== -1) {
      node.dependsOn.splice(depIndex, 1);
      cleanedDeps.push(node.id);
    }
  }

  // Invalidate validation
  invalidate(session);

  const diff: Diff = {
    action: 'remove',
    nodeId: nodeId,
    before: removed,
  };

  return { removed, diff, cleanedDeps };
}

/**
 * Connect two nodes (add dependency)
 */
export function connectNodes(
  session: BuilderSession,
  fromId: string,
  toId: string,
): { diff: Diff } {
  requireEditable(session);

  // Find both nodes
  const fromNode = session.workflowDraft.nodes.find((n) => n.id === fromId);
  const toNode = session.workflowDraft.nodes.find((n) => n.id === toId);

  if (!fromNode) {
    throw new BuilderError(ErrorCodes.NODE_NOT_FOUND, `Source node "${fromId}" not found`, {
      nodeId: fromId,
    });
  }

  if (!toNode) {
    throw new BuilderError(ErrorCodes.NODE_NOT_FOUND, `Target node "${toId}" not found`, {
      nodeId: toId,
    });
  }

  // Prevent self-connection
  if (fromId === toId) {
    throw new BuilderError(ErrorCodes.VALIDATION_ERROR, 'Cannot connect a node to itself', {
      nodeId: fromId,
    });
  }

  // Add dependency (toNode depends on fromNode)
  if (!toNode.dependsOn.includes(fromId)) {
    toNode.dependsOn.push(fromId);
  }

  // Invalidate validation
  invalidate(session);

  const diff: Diff = {
    action: 'connect',
    from: fromId,
    to: toId,
  };

  return { diff };
}

/**
 * Disconnect two nodes (remove dependency)
 */
export function disconnectNodes(
  session: BuilderSession,
  fromId: string,
  toId: string,
): { diff: Diff } {
  requireEditable(session);

  // Find target node
  const toNode = session.workflowDraft.nodes.find((n) => n.id === toId);

  if (!toNode) {
    throw new BuilderError(ErrorCodes.NODE_NOT_FOUND, `Target node "${toId}" not found`, {
      nodeId: toId,
    });
  }

  // Remove dependency
  const depIndex = toNode.dependsOn.indexOf(fromId);
  if (depIndex !== -1) {
    toNode.dependsOn.splice(depIndex, 1);
  }

  // Invalidate validation
  invalidate(session);

  const diff: Diff = {
    action: 'disconnect',
    from: fromId,
    to: toId,
  };

  return { diff };
}
