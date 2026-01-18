/**
 * refly workflow run - Start a workflow execution
 */

import { Command } from 'commander';
import open from 'open';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getWebUrl } from '../../config/config.js';

interface RunResult {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted' | 'init';
  startedAt: string;
  unauthorizedTools?: Array<{
    toolset: {
      type: string;
      id: string;
      name: string;
      builtin?: boolean;
      toolset?: {
        key?: string;
      };
      mcpServer?: {
        name?: string;
      };
    };
    referencedNodes: Array<{
      id: string;
      entityId: string;
      title: string;
      type: string;
    }>;
  }>;
}

const promptToOpenBrowser = async (installUrl: string): Promise<boolean> => {
  const isInteractive = process.stdin?.isTTY ?? false;
  if (!isInteractive) {
    return false;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `${installUrl}\nOpen browser to install required tools? (y/N) > `,
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
};

const buildInstallUrl = (workflowId: string, toolKeys: string[]): string => {
  const baseUrl = getWebUrl();
  const safeKeys = Array.isArray(toolKeys) ? toolKeys.filter((key) => Boolean(key)) : [];
  const query = safeKeys.length > 0 ? `?tools=${encodeURIComponent(safeKeys.join(','))}` : '';
  return `${baseUrl}/workflow/${workflowId}/install-tools${query}`;
};

export const workflowRunCommand = new Command('run')
  .description('Start a workflow execution')
  .argument('<workflowId>', 'Workflow ID to run')
  .option('--input <json>', 'Input variables as JSON', '{}')
  .option('--from-node <nodeId>', 'Start workflow execution from a specific node (Run From Here)')
  .action(async (workflowId, options) => {
    try {
      // Parse input JSON
      let input: unknown;
      try {
        input = JSON.parse(options?.input ?? '{}');
      } catch {
        fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
          hint: 'Ensure the input is valid JSON',
        });
      }

      // Build request body with optional startNodes
      const body: { input?: unknown; startNodes?: string[] } = { input };
      if (options?.fromNode) {
        body.startNodes = [options?.fromNode];
      }

      const result = await apiRequest<RunResult>(`/v1/cli/workflow/${workflowId}/run`, {
        method: 'POST',
        body,
      });

      // Check if there are unauthorized tools
      const unauthorizedTools = Array.isArray(result?.unauthorizedTools)
        ? result.unauthorizedTools
        : [];

      if (unauthorizedTools.length > 0) {
        const toolNames = unauthorizedTools
          .map((tool) => tool.toolset?.name ?? 'Unknown tool')
          .join(', ');
        const toolKeys = unauthorizedTools
          .map((tool) => tool.toolset?.toolset?.key ?? tool.toolset?.name ?? '')
          .filter((key) => Boolean(key));
        const installUrl = buildInstallUrl(workflowId, toolKeys);
        const shouldOpenBrowser = await promptToOpenBrowser(installUrl);

        if (shouldOpenBrowser) {
          try {
            await open(installUrl);
          } catch {
            // Ignore browser open errors and continue with CLI error output
          }
        }

        fail(ErrorCodes.EXECUTION_FAILED, `Workflow contains unauthorized tools: ${toolNames}`, {
          hint: 'Please install and authorize these tools before running the workflow',
          details: {
            installUrl,
            unauthorizedTools: unauthorizedTools.map((tool) => ({
              name: tool.toolset?.name ?? 'Unknown tool',
              type: tool.toolset?.type ?? 'unknown',
              referencedNodes: Array.isArray(tool.referencedNodes)
                ? tool.referencedNodes.length
                : 0,
            })),
          },
        });
      }

      ok('workflow.run', {
        message: options?.fromNode
          ? `Workflow run started from node ${options?.fromNode}`
          : 'Workflow run started',
        runId: result.runId,
        workflowId: result.workflowId,
        status: result.status,
        startNode: options?.fromNode || undefined,
        startedAt: result.startedAt,
        nextStep: `Check status with \`refly workflow status ${workflowId}\``,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run workflow',
      );
    }
  });
