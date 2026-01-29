/**
 * refly workflow create - Create a workflow directly
 *
 * TODO: This command needs reimplementation. Currently not exposed in documentation.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

// Supported node types in simplified format
const SUPPORTED_NODE_TYPES = ['skill', 'agent'];

// Unsupported fields that indicate advanced format
const UNSUPPORTED_NODE_FIELDS = ['prompt', 'instruction', 'content', 'input'];

// Pattern for variable interpolation syntax
const VARIABLE_PATTERN = /\{\{[^}]+\}\}/;

interface SimpleNode {
  id: string;
  type: string;
  query?: string;
  toolsetKeys?: string[];
  dependsOn?: string[];
  [key: string]: unknown;
}

interface WorkflowSpec {
  nodes?: SimpleNode[];
  edges?: unknown[];
  version?: number;
  metadata?: unknown;
  [key: string]: unknown;
}

/**
 * Validate that the spec follows the simplified format.
 * Returns an error message if invalid, or null if valid.
 */
function validateSimplifiedSpec(spec: WorkflowSpec): string | null {
  // Check for unsupported top-level fields
  if (spec.version !== undefined) {
    return 'Field "version" is not supported in simplified format';
  }
  if (spec.metadata !== undefined) {
    return 'Field "metadata" is not supported in simplified format';
  }

  const nodes = spec.nodes;
  if (!nodes || !Array.isArray(nodes)) {
    return 'Spec must contain a "nodes" array';
  }

  if (nodes.length === 0) {
    return 'Spec must contain at least one node';
  }

  for (const node of nodes) {
    // Check required fields
    if (!node.id || typeof node.id !== 'string') {
      return 'Each node must have a string "id" field';
    }
    if (!node.type || typeof node.type !== 'string') {
      return `Node "${node.id}": must have a string "type" field`;
    }

    // Check node type
    if (node.type.startsWith('tool:')) {
      return `Node "${node.id}": type "tool:xxx" is not supported. Use type "skill" with toolsetKeys instead. Example: {"type":"skill","toolsetKeys":["${node.type.replace('tool:', '')}"]}`;
    }
    if (node.type === 'start') {
      return `Node "${node.id}": type "start" is not supported. Start node is automatically created`;
    }
    if (!SUPPORTED_NODE_TYPES.includes(node.type)) {
      return `Node "${node.id}": type "${node.type}" is not supported. Use one of: ${SUPPORTED_NODE_TYPES.join(', ')}`;
    }

    // Check for unsupported fields
    for (const field of UNSUPPORTED_NODE_FIELDS) {
      if (node[field] !== undefined) {
        if (field === 'prompt') {
          return `Node "${node.id}": field "prompt" is not supported. Use "query" instead`;
        }
        if (field === 'input') {
          return `Node "${node.id}": field "input" is not supported. Use top-level "query" and "toolsetKeys" instead`;
        }
        return `Node "${node.id}": field "${field}" is not supported in simplified format`;
      }
    }

    // Check for variable interpolation syntax
    if (node.query && typeof node.query === 'string' && VARIABLE_PATTERN.test(node.query)) {
      return `Node "${node.id}": variable syntax "{{...}}" is not supported in query field`;
    }

    // Validate toolsetKeys if present
    if (node.toolsetKeys !== undefined) {
      if (!Array.isArray(node.toolsetKeys)) {
        return `Node "${node.id}": "toolsetKeys" must be an array`;
      }
      for (const key of node.toolsetKeys) {
        if (typeof key !== 'string') {
          return `Node "${node.id}": each item in "toolsetKeys" must be a string`;
        }
      }
    }

    // Validate dependsOn if present
    if (node.dependsOn !== undefined) {
      if (!Array.isArray(node.dependsOn)) {
        return `Node "${node.id}": "dependsOn" must be an array`;
      }
      for (const dep of node.dependsOn) {
        if (typeof dep !== 'string') {
          return `Node "${node.id}": each item in "dependsOn" must be a string`;
        }
      }
    }
  }

  // Validate dependsOn references
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    if (node.dependsOn) {
      for (const dep of node.dependsOn) {
        if (!nodeIds.has(dep)) {
          return `Node "${node.id}": dependsOn references unknown node "${dep}"`;
        }
      }
    }
  }

  return null;
}

export const workflowCreateCommand = new Command('create')
  .description('Create a workflow from a spec')
  .requiredOption('--name <name>', 'Workflow name')
  .requiredOption('--spec <json>', 'Workflow spec as JSON')
  .option('--description <description>', 'Workflow description')
  .action(async (options) => {
    try {
      // Parse spec JSON
      // Supports both formats:
      // - Array shorthand: [node1, node2] -> { nodes: [node1, node2] }
      // - Full object: { nodes: [...], edges: [...] } -> as-is
      let spec: WorkflowSpec;
      try {
        const parsed = JSON.parse(options.spec);
        spec = Array.isArray(parsed) ? { nodes: parsed } : parsed;
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --spec', {
          hint:
            'Spec format: \'[{"id": "node1", "type": "skill", "query": "task description", "toolsetKeys": ["web_search"]}]\'\n' +
            'Or full format: \'{"nodes": [...], "edges": [...]}\'',
          suggestedFix: {
            field: '--spec',
            format: 'json-array | json-object',
            example:
              '[{"id": "node1", "type": "skill", "query": "task description", "toolsetKeys": ["web_search"]}]',
          },
        });
        return;
      }

      // Validate simplified format
      const validationError = validateSimplifiedSpec(spec);
      if (validationError) {
        fail(ErrorCodes.INVALID_INPUT, validationError, {
          hint: 'Use simplified format: [{"id":"node1","type":"skill","query":"...","toolsetKeys":["tool_name"],"dependsOn":["other_node"]}]',
          suggestedFix: {
            field: '--spec',
            format: 'json-array',
            example:
              '[{"id":"node1","type":"skill","query":"...","toolsetKeys":["tool_name"],"dependsOn":["other_node"]}]',
          },
        });
        return;
      }

      // Call API
      const result = await apiRequest<{
        workflowId: string;
        name: string;
        createdAt: string;
      }>('/v1/cli/workflow', {
        method: 'POST',
        body: {
          name: options.name,
          description: options.description,
          spec,
        },
      });

      ok('workflow.create', {
        message: 'Workflow created successfully',
        workflowId: result.workflowId,
        name: result.name,
        createdAt: result.createdAt,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
        return;
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to create workflow',
      );
    }
  });
