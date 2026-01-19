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
  installToolsUrl?: string;
}

interface ToolsStatusResult {
  authorized: boolean;
  unauthorizedTools: Array<{
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

/**
 * Prompt user for confirmation with y/N defaulting to N
 */
async function confirmAction(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} (y/N): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Poll tools status until all tools are authorized or timeout
 */
async function pollToolsStatus(
  workflowId: string,
  maxWaitTime: number = 15 * 60 * 1000, // 15 minutes
  pollInterval = 2000, // 2 seconds
): Promise<boolean> {
  const startTime = Date.now();

  console.log('\nWaiting for tool authorization...');
  console.log('This may take a few minutes. You can complete the authorization in your browser.');

  let previousRemainingCount = -1; // Track previous count to only log when it changes

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const result = await apiRequest<ToolsStatusResult>(
        `/v1/cli/workflow/${workflowId}/tools-status`,
      );

      if (result.authorized) {
        console.log('\n✅ All required tools are now authorized!');
        return true;
      }

      const remainingCount = result.unauthorizedTools.length;
      if (remainingCount !== previousRemainingCount) {
        console.log(
          `⏳ Still waiting... ${remainingCount} tool${remainingCount > 1 ? 's' : ''} remaining to authorize.`,
        );
        previousRemainingCount = remainingCount;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.log(`\n⚠️  Failed to check authorization status: ${(error as Error).message}`);
      console.log('Continuing to wait...');
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  console.log('\n⏰ Timeout waiting for tool authorization.');
  return false;
}

const promptToOpenBrowser = async (installUrl: string): Promise<boolean> => {
  const isInteractive = process.stdin?.isTTY ?? false;
  if (!isInteractive) {
    return false;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `${installUrl}\nOpen browser to view workflow tools? (y/N) > `,
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
};

const buildInstallUrl = (workflowId: string): string => {
  const webUrl = getWebUrl();
  return `${webUrl}/workflow/${workflowId}/install-tools`;
};

/**
 * Main workflow execution logic
 */
async function runWorkflow(workflowId: string, options: any): Promise<void> {
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
    const installUrl = buildInstallUrl(workflowId);
    const shouldOpenBrowser = await promptToOpenBrowser(installUrl);

    if (shouldOpenBrowser) {
      try {
        await open(installUrl);
        console.log('✅ Browser opened successfully!');
        console.log('');
        console.log('Please install any required tools in your browser.');
        console.log('You can close the browser tab and return here when done.');
        console.log('');

        // 开始轮询工具授权状态
        const allAuthorized = await pollToolsStatus(workflowId);

        if (allAuthorized) {
          // 二次确认是否立即运行workflow
          console.log('');
          const shouldRunNow = await confirmAction(
            'All required tools are authorized now. Run workflow now?',
          );

          if (shouldRunNow) {
            console.log('');
            console.log('Running workflow...');
            // 递归调用自身，但此时应该不会有未授权工具了
            return await runWorkflow(workflowId, options);
          } else {
            console.log('');
            console.log('Workflow is ready to run. You can run it later with:');
            console.log(`  refly workflow run ${workflowId}`);
            return;
          }
        } else {
          // 轮询超时
          console.log('');
          console.log(
            'Authorization timed out. You can try again later or install tools manually:',
          );
          console.log(`  ${installUrl}`);
          console.log('');
          console.log('Then run the workflow with:');
          console.log(`  refly workflow run ${workflowId}`);
          process.exit(1);
        }
      } catch {
        console.log('❌ Could not open browser automatically.');
        console.log('Please visit this URL manually:');
        console.log(`  ${installUrl}`);
        process.exit(1);
      }
    }

    fail(ErrorCodes.EXECUTION_FAILED, `Workflow contains unauthorized tools: ${toolNames}`, {
      hint: 'Open browser to view all workflow tools and install the ones you need',
      details: {
        installUrl,
        unauthorizedTools: unauthorizedTools.map((tool) => ({
          name: tool.toolset?.name ?? 'Unknown tool',
          type: tool.toolset?.type ?? 'unknown',
          referencedNodes: Array.isArray(tool.referencedNodes) ? tool.referencedNodes.length : 0,
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
}

export const workflowRunCommand = new Command('run')
  .description('Start a workflow execution')
  .argument('<workflowId>', 'Workflow ID to run')
  .option('--input <json>', 'Input variables as JSON', '{}')
  .option('--from-node <nodeId>', 'Start workflow execution from a specific node (Run From Here)')
  .action(async (workflowId, options) => {
    try {
      await runWorkflow(workflowId, options);
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
