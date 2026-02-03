/**
 * refly workflow toolcalls - Get all tool calls for workflow execution
 *
 * Supports both workflowId (c-xxx) and runId (we-xxx).
 * - workflowId: gets tool calls for the latest run
 * - runId: gets tool calls for the specific run
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { buildWorkflowApiUrl, detectIdType } from './utils.js';

interface ToolCallDetail {
  callId: string;
  toolsetId: string;
  toolName: string;
  stepName?: string;
  nodeId?: string;
  nodeTitle?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'executing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
}

interface FileInfo {
  fileId: string;
  name: string;
  type: string;
  category?: string;
  size?: number;
  url?: string;
  source?: string;
  createdAt?: string;
}

interface NodeOutput {
  nodeId: string;
  nodeTitle: string;
  toolName: string;
  content?: string;
  files: FileInfo[];
}

interface WorkflowToolCallsResponse {
  runId: string;
  workflowId: string;
  totalCount: number;
  toolCalls: ToolCallDetail[];
  byStatus: {
    executing: number;
    completed: number;
    failed: number;
  };
  byToolset: Record<string, number>;
  byTool: Record<string, number>;
}

/**
 * Extract files and content from toolcall output
 */
function extractNodeOutputs(toolCalls: ToolCallDetail[]): NodeOutput[] {
  const outputs: NodeOutput[] = [];

  for (const call of toolCalls) {
    if (!call.output || call.status !== 'completed') continue;

    const output = call.output as Record<string, unknown>;
    const filesMap = new Map<string, FileInfo>(); // Use map to deduplicate by fileId
    let content: string | undefined;

    // Extract files from output.files array (primary source)
    if (Array.isArray(output.files)) {
      for (const f of output.files) {
        const file = f as Record<string, unknown>;
        if (file.fileId && !filesMap.has(String(file.fileId))) {
          filesMap.set(String(file.fileId), {
            fileId: String(file.fileId),
            name: String(file.name || ''),
            type: String(file.type || ''),
            category: file.category as string | undefined,
            size: file.size as number | undefined,
            url: file.url as string | undefined,
            source: file.source as string | undefined,
            createdAt: file.createdAt as string | undefined,
          });
        }
      }
    }

    // Extract files from output.data.fileId (single file case, only if not already found)
    if (output.data && typeof output.data === 'object') {
      const data = output.data as Record<string, unknown>;
      if (data.fileId && !filesMap.has(String(data.fileId))) {
        filesMap.set(String(data.fileId), {
          fileId: String(data.fileId),
          name: String(data.name || ''),
          type: String(data.type || ''),
          category: data.category as string | undefined,
          size: data.size as number | undefined,
          url: data.url as string | undefined,
          source: data.source as string | undefined,
          createdAt: data.createdAt as string | undefined,
        });
      }
    }

    // Extract content preview
    if (output.content) {
      content = String(output.content).slice(0, 500);
    } else if (output.data && typeof output.data === 'object') {
      const data = output.data as Record<string, unknown>;
      if (data.candidates && Array.isArray(data.candidates)) {
        // Gemini-style response
        const parts = (data.candidates[0] as Record<string, unknown>)?.content as Record<
          string,
          unknown
        >;
        if (parts?.parts && Array.isArray(parts.parts)) {
          const textPart = parts.parts.find(
            (p: Record<string, unknown>) => typeof p.text === 'string' && !p.thought,
          );
          if (textPart) {
            content = String((textPart as Record<string, unknown>).text).slice(0, 500);
          }
        }
      }
    }

    const files = Array.from(filesMap.values());
    if (files.length > 0 || content) {
      outputs.push({
        nodeId: call.nodeId || '',
        nodeTitle: call.nodeTitle || call.toolName,
        toolName: call.toolName,
        content,
        files,
      });
    }
  }

  return outputs;
}

export const workflowToolcallsCommand = new Command('toolcalls')
  .description('Get all tool calls for workflow execution')
  .argument('<id>', 'Workflow ID (c-xxx) or Run ID (we-xxx)')
  .option('--node-id <nodeId>', 'Filter by node ID')
  .option('--toolset-id <toolsetId>', 'Filter by toolset ID')
  .option('--tool-name <toolName>', 'Filter by tool name')
  .option('--status <status>', 'Filter by status (executing, completed, failed)')
  .option('--limit <limit>', 'Maximum number of results (default: 100)', '100')
  .option('--offset <offset>', 'Pagination offset (default: 0)', '0')
  .option('--raw', 'Disable output sanitization (show full tool outputs)')
  .option('--files', 'Show only files and content from each node (simplified output)')
  .option('--latest', 'With --files, only show files from the most recent toolcall')
  .action(async (id, options) => {
    try {
      const params = new URLSearchParams();
      if (options.nodeId) {
        params.set('nodeId', options.nodeId);
      }
      if (options.toolsetId) {
        params.set('toolsetId', options.toolsetId);
      }
      if (options.toolName) {
        params.set('toolName', options.toolName);
      }
      if (options.status) {
        params.set('status', options.status);
      }
      if (options.limit) {
        params.set('limit', options.limit);
      }
      if (options.offset) {
        params.set('offset', options.offset);
      }
      if (options.raw || options.files) {
        params.set('sanitizeForDisplay', 'false');
      }

      // Auto-detect ID type and build appropriate URL
      const idType = detectIdType(id);
      const url = buildWorkflowApiUrl(id, 'toolcalls', params);
      const result = await apiRequest<WorkflowToolCallsResponse>(url);

      // If --files option, return simplified output with only files and content
      if (options.files) {
        let nodeOutputs = extractNodeOutputs(result.toolCalls);

        // If --latest, only keep files from the most recent toolcall that has files
        if (options.latest && nodeOutputs.length > 0) {
          const lastWithFiles = nodeOutputs.filter((n) => n.files.length > 0).pop();
          nodeOutputs = lastWithFiles ? [lastWithFiles] : [];
        }

        const allFiles = nodeOutputs.flatMap((n) => n.files);

        ok('workflow.files', {
          runId: result.runId,
          workflowId: result.workflowId,
          files: allFiles,
          nodes: nodeOutputs,
        });
      }

      ok('workflow.toolcalls', {
        runId: result.runId,
        workflowId: result.workflowId,
        idType,
        totalCount: result.totalCount,
        toolCalls: result.toolCalls,
        summary: {
          byStatus: result.byStatus,
          byToolset: result.byToolset,
          byTool: result.byTool,
        },
      });
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
        error instanceof Error ? error.message : 'Failed to get workflow tool calls',
      );
    }
  });
