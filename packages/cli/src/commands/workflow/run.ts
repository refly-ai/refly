/**
 * refly workflow run - Start a workflow execution
 */

import { Command } from 'commander';
import open from 'open';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as path from 'node:path';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import {
  apiRequest,
  apiGetWorkflow,
  apiUploadDriveFile,
  type WorkflowVariable,
  type WorkflowInfo,
} from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getWebUrl } from '../../config/config.js';
import { promptForFilePath, isInteractive } from '../../utils/prompt.js';
import { determineFileType } from '../../utils/file-type.js';

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
 * Resource value structure for file variables
 */
interface ResourceValue {
  type: 'resource';
  resource: {
    name: string;
    fileType: string;
    fileId: string;
    storageKey: string;
  };
}

/**
 * Collect file variables interactively by prompting for file paths.
 * Only prompts for required resource variables that don't have values in existingInput.
 *
 * @param workflowId - The workflow ID to fetch variables from
 * @param existingInput - Variables already provided via --input
 * @param noPrompt - If true, fail instead of prompting for missing required variables
 * @returns Array of workflow variables with uploaded file bindings
 */
async function collectFileVariables(
  workflowId: string,
  existingInput: WorkflowVariable[],
  noPrompt: boolean,
): Promise<WorkflowVariable[]> {
  // 1. Fetch workflow details to get variable definitions
  let workflow: WorkflowInfo;
  try {
    workflow = await apiGetWorkflow(workflowId);
  } catch (_error) {
    // If we can't fetch the workflow, let the run endpoint handle it
    return [];
  }

  // 2. Find required resource variables
  const resourceVars = (workflow.variables ?? []).filter(
    (v) => v.variableType === 'resource' && v.required === true,
  );

  if (resourceVars.length === 0) {
    return [];
  }

  // 3. Filter out variables already provided in --input
  // Check by both variableId and name for maximum compatibility
  const providedIds = new Set(existingInput.map((v) => v.variableId).filter(Boolean));
  const providedNames = new Set(existingInput.map((v) => v.name).filter(Boolean));

  const missingVars = resourceVars.filter((v) => {
    // Variable is provided if its ID or name matches
    if (v.variableId && providedIds.has(v.variableId)) return false;
    if (v.name && providedNames.has(v.name)) return false;
    return true;
  });

  if (missingVars.length === 0) {
    return [];
  }

  // 4. Check if we can prompt
  if (noPrompt || !isInteractive()) {
    const names = missingVars.map((v) => v.name).join(', ');
    throw new CLIError(
      ErrorCodes.INVALID_INPUT,
      `Missing required file variables: ${names}`,
      undefined,
      'Provide files via --input or run interactively without --no-prompt',
    );
  }

  // 5. Prompt for each variable
  console.log('');
  console.log('This workflow requires file inputs:');
  const uploadedVars: WorkflowVariable[] = [];

  for (const variable of missingVars) {
    const filePath = await promptForFilePath(
      variable.name,
      variable.resourceTypes ?? ['document'],
      true,
    );

    if (!filePath) {
      // This shouldn't happen for required variables, but just in case
      continue;
    }

    // Upload file
    const filename = path.basename(filePath);
    process.stdout.write(`  Uploading ${filename}...`);

    try {
      const uploadResult = await apiUploadDriveFile(filePath, workflowId);
      console.log(' done');

      // Build variable binding with resource value
      const resourceValue: ResourceValue = {
        type: 'resource',
        resource: {
          name: uploadResult.name,
          fileType: determineFileType(filePath, uploadResult.type),
          fileId: uploadResult.fileId,
          storageKey: uploadResult.storageKey,
        },
      };

      uploadedVars.push({
        variableId: variable.variableId,
        name: variable.name,
        variableType: 'resource',
        value: [resourceValue],
        required: variable.required,
        isSingle: variable.isSingle,
        resourceTypes: variable.resourceTypes,
      });
    } catch (error) {
      console.log(' failed');
      throw new CLIError(
        ErrorCodes.API_ERROR,
        `Failed to upload file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'Check your network connection and try again',
      );
    }
  }

  console.log('');
  return uploadedVars;
}

/**
 * Main workflow execution logic
 */
async function runWorkflow(workflowId: string, options: any): Promise<void> {
  // Parse input JSON to extract variables
  let inputVars: WorkflowVariable[] = [];
  try {
    const parsed = JSON.parse(options?.input ?? '{}');
    // Support both { variables: [...] } and raw array format
    if (Array.isArray(parsed)) {
      inputVars = parsed;
    } else if (parsed.variables && Array.isArray(parsed.variables)) {
      inputVars = parsed.variables;
    }
  } catch {
    fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
      hint: 'Ensure the input is valid JSON, e.g., {"variables":[...]}',
    });
    return; // TypeScript flow control
  }

  // Collect file variables interactively (if needed)
  const uploadedVars = await collectFileVariables(
    workflowId,
    inputVars,
    options?.noPrompt ?? false,
  );

  // Merge: uploaded vars first, then input vars (input takes precedence)
  const allVars = [...uploadedVars, ...inputVars];

  // Build request body with variables and optional startNodes
  const body: { variables?: WorkflowVariable[]; startNodes?: string[] } = {};
  if (allVars.length > 0) {
    body.variables = allVars;
  }
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

        // start polling tool authorization status
        const allAuthorized = await pollToolsStatus(workflowId);

        if (allAuthorized) {
          // confirm again whether to run the workflow immediately
          console.log('');
          const shouldRunNow = await confirmAction(
            'All required tools are authorized now. Run workflow now?',
          );

          if (shouldRunNow) {
            console.log('');
            console.log('Running workflow...');
            // recursively call itself, but there should be no unauthorized tools now
            return await runWorkflow(workflowId, options);
          } else {
            console.log('');
            console.log('Workflow is ready to run. You can run it later with:');
            console.log(`  refly workflow run ${workflowId}`);
            return;
          }
        } else {
          // poll timeout
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
  .option('--no-prompt', 'Disable interactive prompts (fail if required variables are missing)')
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
