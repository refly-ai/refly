/**
 * refly workflow status - Get workflow execution status with optional watch mode
 *
 * Smart diff output: Only outputs when status meaningfully changes to reduce
 * output volume for AI agent integration (e.g., Claude Code background tasks).
 */

import { Command } from 'commander';
import { ok, fail, print, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface NodeStatus {
  nodeId: string;
  nodeType: string;
  status: string;
  title: string;
  progress: number;
  errorMessage?: string;
  startTime?: string;
  endTime?: string;
}

interface WorkflowRunStatus {
  runId: string;
  workflowId: string;
  status: 'init' | 'executing' | 'finish' | 'failed';
  title: string;
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  nodeStatuses: NodeStatus[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Check if workflow status has meaningfully changed
 */
function hasStatusChanged(prev: WorkflowRunStatus | null, current: WorkflowRunStatus): boolean {
  if (!prev) return true;

  // Check overall status
  if (prev.status !== current.status) return true;

  // Check node counts
  if (prev.executedNodes !== current.executedNodes) return true;
  if (prev.failedNodes !== current.failedNodes) return true;

  // Check individual node statuses
  const prevNodeMap = new Map(prev.nodeStatuses.map((n) => [n.nodeId, n]));
  for (const node of current.nodeStatuses) {
    const prevNode = prevNodeMap.get(node.nodeId);
    if (!prevNode) return true;
    if (prevNode.status !== node.status) return true;
    // Only report progress changes if significant (>10%)
    if (Math.abs(prevNode.progress - node.progress) >= 10) return true;
  }

  return false;
}

/**
 * Get changed nodes for delta output
 */
function getChangedNodes(prev: WorkflowRunStatus | null, current: WorkflowRunStatus): NodeStatus[] {
  if (!prev) return current.nodeStatuses;

  const prevNodeMap = new Map(prev.nodeStatuses.map((n) => [n.nodeId, n]));
  const changedNodes: NodeStatus[] = [];

  for (const node of current.nodeStatuses) {
    const prevNode = prevNodeMap.get(node.nodeId);
    if (!prevNode) {
      changedNodes.push(node);
    } else if (
      prevNode.status !== node.status ||
      Math.abs(prevNode.progress - node.progress) >= 10
    ) {
      changedNodes.push(node);
    }
  }

  return changedNodes;
}

/**
 * Generate human-readable summary of status change
 */
function generateSummary(changedNodes: NodeStatus[]): string {
  if (changedNodes.length === 0) return '';

  const summaries: string[] = [];
  for (const node of changedNodes) {
    if (node.status === 'finish') {
      summaries.push(`Node '${node.title}' completed`);
    } else if (node.status === 'failed') {
      summaries.push(`Node '${node.title}' failed`);
    } else if (node.status === 'executing') {
      summaries.push(`Node '${node.title}' started`);
    }
  }

  return summaries.join('; ') || `${changedNodes.length} node(s) updated`;
}

/**
 * Detect ID type based on prefix
 * - workflowId: starts with 'c-' (canvas)
 * - runId: starts with 'we-' (workflow execution)
 */
function detectIdType(id: string): 'workflow' | 'run' {
  if (id.startsWith('we-')) {
    return 'run';
  }
  // Default to workflow (c- prefix or other)
  return 'workflow';
}

export const workflowStatusCommand = new Command('status')
  .description('Get detailed workflow execution status')
  .argument('<id>', 'Workflow ID (c-xxx) or Run ID (we-xxx)')
  .option('--watch', 'Watch mode: continuously poll until completion')
  .option('--interval <ms>', 'Poll interval in ms (default: 2000)', '2000')
  .option('--full', 'In watch mode, output full status every time (not just changes)')
  .action(async (id, options) => {
    try {
      // Validate poll interval
      const pollInterval = Number.parseInt(options.interval, 10);
      if (Number.isNaN(pollInterval) || pollInterval <= 0) {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid poll interval', {
          hint: 'Poll interval must be a positive number in milliseconds',
        });
      }

      // Auto-detect ID type and use appropriate endpoint
      const idType = detectIdType(id);
      const fetchStatus = async () => {
        if (idType === 'run') {
          // Use run-specific endpoint for runId (deprecated but functional)
          return await apiRequest<WorkflowRunStatus>(`/v1/cli/workflow/run/${id}`);
        }
        // Use workflow status endpoint for workflowId
        return await apiRequest<WorkflowRunStatus>(`/v1/cli/workflow/${id}/status`);
      };

      if (options.watch) {
        // Watch mode: poll until completion with smart diff output
        let prevStatus: WorkflowRunStatus | null = null;
        let status = await fetchStatus();

        // Always output initial status (full)
        print('workflow.status', {
          ...status,
          watching: true,
          isInitial: true,
        });
        prevStatus = status;

        while (status.status === 'init' || status.status === 'executing') {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          status = await fetchStatus();

          // Smart diff: only output if status has meaningfully changed
          if (options.full || hasStatusChanged(prevStatus, status)) {
            if (options.full) {
              // Full mode: output complete status every time
              print('workflow.status', {
                ...status,
                watching: true,
              });
            } else {
              // Smart diff mode: output delta with changed nodes only
              const changedNodes = getChangedNodes(prevStatus, status);
              print('workflow.progress', {
                runId: status.runId,
                status: status.status,
                progress: `${status.executedNodes}/${status.totalNodes}`,
                executedNodes: status.executedNodes,
                totalNodes: status.totalNodes,
                failedNodes: status.failedNodes,
                summary: generateSummary(changedNodes),
                changedNodes,
                watching: true,
              });
            }
            prevStatus = status;
          }
        }

        // Final output with ok() which exits the process
        ok('workflow.status', {
          ...status,
          watching: false,
          completed: true,
        });
      } else {
        // Single fetch
        const status = await fetchStatus();
        ok('workflow.status', status);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get workflow status',
      );
    }
  });
