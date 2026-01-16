/**
 * DAG validation for workflow drafts
 */

import { BuilderSession, ValidationResult, WorkflowNode, BuilderState } from './schema.js';
import { saveSession } from './store.js';

interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

/**
 * Validate a workflow draft
 */
export function validateDraft(session: BuilderSession): ValidationResult {
  const errors: ValidationError[] = [];
  const nodes = session.workflowDraft.nodes;

  // 1. Check workflow name
  if (!session.workflowDraft.name || session.workflowDraft.name.trim() === '') {
    errors.push({
      code: 'MISSING_NAME',
      message: 'Workflow name is required',
    });
  }

  // 2. Check for empty nodes
  if (nodes.length === 0) {
    errors.push({
      code: 'EMPTY_WORKFLOW',
      message: 'Workflow must have at least one node',
    });
  }

  // 3. Check node ID uniqueness
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node ID: ${node.id}`,
        nodeId: node.id,
      });
    }
    nodeIds.add(node.id);
  }

  // 4. Check required fields
  for (const node of nodes) {
    if (!node.id || node.id.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'Node ID is required',
        details: { node },
      });
    }

    if (!node.type || node.type.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_TYPE',
        message: 'Node type is required',
        nodeId: node.id,
      });
    }
  }

  // 5. Check dependency references
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      if (!nodeIds.has(depId)) {
        errors.push({
          code: 'MISSING_DEPENDENCY',
          message: `Node "${node.id}" depends on non-existent node "${depId}"`,
          nodeId: node.id,
          details: { missingDep: depId },
        });
      }

      // Check self-reference
      if (depId === node.id) {
        errors.push({
          code: 'SELF_REFERENCE',
          message: `Node "${node.id}" cannot depend on itself`,
          nodeId: node.id,
        });
      }
    }
  }

  // 6. Cycle detection
  const cycleResult = detectCycles(nodes);
  if (cycleResult.hasCycle) {
    errors.push({
      code: 'CYCLE_DETECTED',
      message: `Circular dependency detected: ${cycleResult.cycle?.join(' -> ')}`,
      details: { cycle: cycleResult.cycle },
    });
  }

  // Build result
  const result: ValidationResult = {
    ok: errors.length === 0,
    errors,
  };

  // Update session
  session.validation = result;
  if (result.ok && session.state === BuilderState.DRAFT) {
    session.state = BuilderState.VALIDATED;
  }
  saveSession(session);

  return result;
}

/**
 * Detect cycles in the DAG using DFS
 */
function detectCycles(nodes: WorkflowNode[]): { hasCycle: boolean; cycle?: string[] } {
  const nodeMap = new Map<string, WorkflowNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): string[] | null {
    if (recursionStack.has(nodeId)) {
      // Found cycle - extract cycle path
      const cycleStart = path.indexOf(nodeId);
      return [...path.slice(cycleStart), nodeId];
    }

    if (visited.has(nodeId)) {
      return null;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const depId of node.dependsOn) {
        const cycle = dfs(depId);
        if (cycle) {
          return cycle;
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return null;
  }

  for (const node of nodes) {
    const cycle = dfs(node.id);
    if (cycle) {
      return { hasCycle: true, cycle };
    }
  }

  return { hasCycle: false };
}

/**
 * Check if a node type is valid
 * TODO: Fetch and cache valid types from API
 */
export function isValidNodeType(type: string): boolean {
  // For Phase 1, accept any non-empty type
  // In Phase 2, this should validate against refly node types
  return type.trim().length > 0;
}
