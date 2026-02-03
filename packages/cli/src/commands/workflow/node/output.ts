/**
 * refly workflow node output - Get node execution output content
 *
 * Supports both workflowId (c-xxx) and runId (we-xxx).
 * - workflowId: gets output for the latest run
 * - runId: gets output for the specific run
 *
 * This command retrieves the actual execution result/content of a node,
 * not just its definition.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../../utils/output.js';
import { apiRequest } from '../../../api/client.js';
import { CLIError } from '../../../utils/errors.js';
import { buildWorkflowApiUrl, detectIdType } from '../utils.js';

interface NodeOutputResponse {
  runId: string;
  workflowId: string;
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'waiting' | 'executing' | 'finish' | 'failed';
  content?: string;
  contentType?: string;
  outputTokens?: number;
  toolCalls?: Array<{
    callId: string;
    toolName: string;
    status: string;
    output?: unknown;
  }>;
  error?: {
    type: string;
    message: string;
  };
  timing?: {
    startTime?: string;
    endTime?: string;
    durationMs?: number;
  };
}

export const nodeOutputCommand = new Command('output')
  .description('Get node execution output content')
  .argument('<id>', 'Workflow ID (c-xxx) or Run ID (we-xxx)')
  .argument('<nodeId>', 'Node ID')
  .option('--include-tool-calls', 'Include tool call details in output')
  .option('--raw', 'Output raw content without formatting')
  .action(async (id, nodeId, options) => {
    try {
      const params = new URLSearchParams();
      if (options.includeToolCalls) {
        params.set('includeToolCalls', 'true');
      }
      if (options.raw) {
        params.set('raw', 'true');
      }

      // Auto-detect ID type and build appropriate URL
      const idType = detectIdType(id);
      const url = buildWorkflowApiUrl(id, `node/${nodeId}/output`, params);
      const result = await apiRequest<NodeOutputResponse>(url);

      ok('workflow.node.output', {
        runId: result.runId,
        workflowId: result.workflowId,
        idType,
        node: {
          id: result.nodeId,
          title: result.nodeTitle,
          type: result.nodeType,
          status: result.status,
        },
        output: {
          content: result.content,
          contentType: result.contentType,
          outputTokens: result.outputTokens,
        },
        toolCalls: result.toolCalls,
        error: result.error,
        timing: result.timing,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        // Replace placeholder with actual id in hint
        const hint = error.hint?.replace(/<workflowId>/g, id).replace(/<id>/g, id);
        fail(error.code, error.message, {
          details: error.details,
          hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node output',
        {
          hint: `Ensure the node has completed execution. Use \`refly workflow status ${id}\` to check.`,
        },
      );
    }
  });
