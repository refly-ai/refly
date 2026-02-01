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
  apiGetWorkflowVariables,
  apiUploadDriveFile,
  type WorkflowVariable,
  type WorkflowInfo,
} from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getWebUrl } from '../../config/config.js';
import { promptForFilePath, isInteractive } from '../../utils/prompt.js';
import { getFileCategoryByName } from '../../utils/file-type.js';
import {
  checkRequiredVariables,
  buildMissingVariablesError,
  variablesToObject,
} from '../../utils/variable-check.js';

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

  // 2. Fetch saved variable values from backend
  let savedVariables: WorkflowVariable[] = [];
  try {
    savedVariables = await apiGetWorkflowVariables(workflowId);
  } catch (_error) {
    // Continue without saved values
  }

  // 3. Find required resource variables
  const resourceVars = (workflow.variables ?? []).filter(
    (v) => v.variableType === 'resource' && v.required === true,
  );

  if (resourceVars.length === 0) {
    return [];
  }

  // 4. Filter out variables already provided in --input OR saved in backend with valid values
  // Also track variables with invalid format for better error messages
  const invalidFormatVars: Array<{ name: string; reason: string }> = [];

  // Helper to check if a variable has valid file value
  const hasValidFileValue = (variable: WorkflowVariable | undefined): boolean => {
    if (!variable) return false;
    const values = variable.value;
    if (!Array.isArray(values) || values.length === 0) return false;
    return values.some((val: any) => {
      const fileId = val?.resource?.fileId || val?.fileId;
      return typeof fileId === 'string' && fileId.length > 0;
    });
  };

  const missingVars = resourceVars.filter((v) => {
    // Find if this variable was provided in --input
    const providedInInput = existingInput.find(
      (input) =>
        (v.variableId && input.variableId === v.variableId) || (v.name && input.name === v.name),
    );

    // Find if this variable has saved value in backend
    const savedValue = savedVariables.find(
      (saved) =>
        (v.variableId && saved.variableId === v.variableId) || (v.name && saved.name === v.name),
    );

    // Check --input first (takes precedence)
    if (providedInInput) {
      if (hasValidFileValue(providedInInput)) {
        return false; // Valid value in --input
      }
      invalidFormatVars.push({
        name: v.name,
        reason: 'invalid format in --input',
      });
      // Continue to check saved value
    }

    // Check saved value from backend
    if (hasValidFileValue(savedValue)) {
      return false; // Valid value saved in backend
    }

    return true; // No valid value found
  });

  if (missingVars.length === 0) {
    return [];
  }

  // 4. Check if we can prompt
  if (noPrompt || !isInteractive()) {
    // Build helpful error message
    const missingNames = missingVars.map((v) => v.name);
    const formatIssues = invalidFormatVars.filter((f) => missingNames.includes(f.name));

    let message: string;
    let hint: string;

    if (formatIssues.length > 0) {
      // User provided values but format was wrong
      const details = formatIssues.map((f) => `  - ${f.name}: ${f.reason}`).join('\n');
      message = `Invalid format for file variables:\n${details}`;
      hint =
        'For file variables, use format: \'{"varName": "df-fileId"}\' or \'{"varName": [{"fileId": "df-xxx"}]}\'';
    } else {
      // Variables were not provided at all
      message = `Missing required file variables: ${missingNames.join(', ')}`;
      hint = 'Provide files via --input or run interactively without --no-prompt';
    }

    throw new CLIError(ErrorCodes.INVALID_INPUT, message, undefined, hint, {
      field: '--input',
      format: 'json-object',
      example: '{"fileVar": "df-fileId"}',
    });
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
          fileType: getFileCategoryByName(filePath, uploadResult.type),
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
 * Convert simple key-value input format to WorkflowVariable array.
 * Supports:
 *   - {"varName": "stringValue"} -> string variable
 *   - {"varName": "df-xxx"} -> file variable (auto-detect by fileId prefix)
 *   - {"varName": [{"fileId": "df-xxx"}]} -> file variable
 *   - {"varName": [{"type": "file", "fileId": "df-xxx"}]} -> file variable
 */
function convertKeyValueToVariables(
  obj: Record<string, unknown>,
  workflow?: WorkflowInfo,
): WorkflowVariable[] {
  const variables: WorkflowVariable[] = [];

  for (const [name, rawValue] of Object.entries(obj)) {
    // Find variable definition from workflow if available
    const varDef = workflow?.variables?.find((v) => v.name === name || v.variableId === name);
    const isResourceVar = varDef?.variableType === 'resource';

    // Determine if this looks like a file value
    const looksLikeFileId = typeof rawValue === 'string' && rawValue.startsWith('df-');
    const looksLikeFileArray =
      Array.isArray(rawValue) &&
      rawValue.length > 0 &&
      typeof rawValue[0] === 'object' &&
      rawValue[0] !== null &&
      ('fileId' in rawValue[0] || 'type' in rawValue[0]);

    if (isResourceVar || looksLikeFileId || looksLikeFileArray) {
      // Handle as file/resource variable
      let fileValues: Array<{ type: string; resource: { fileId: string } }> = [];

      if (typeof rawValue === 'string') {
        // Simple fileId string: "df-xxx"
        fileValues = [
          {
            type: 'resource',
            resource: { fileId: rawValue },
          },
        ];
      } else if (Array.isArray(rawValue)) {
        // Array format: [{"fileId": "df-xxx"}] or [{"type": "file", "fileId": "df-xxx"}]
        fileValues = rawValue.map((item: any) => ({
          type: 'resource',
          resource: { fileId: item.fileId || item.resource?.fileId || '' },
        }));
      }

      variables.push({
        variableId: varDef?.variableId,
        name: varDef?.name || name,
        variableType: 'resource',
        value: fileValues,
        required: varDef?.required,
      });
    } else {
      // Handle as string variable
      let value: Array<{ type: string; text?: string }> = [];

      if (typeof rawValue === 'string') {
        value = [{ type: 'text', text: rawValue }];
      } else if (Array.isArray(rawValue)) {
        value = rawValue;
      }

      variables.push({
        variableId: varDef?.variableId,
        name: varDef?.name || name,
        variableType: 'string',
        value,
        required: varDef?.required,
      });
    }
  }

  return variables;
}

/**
 * Main workflow execution logic
 */
async function runWorkflow(workflowId: string, options: any): Promise<void> {
  // Fetch workflow info early for variable type detection
  let workflow: WorkflowInfo | undefined;
  try {
    workflow = await apiGetWorkflow(workflowId);
  } catch {
    // Continue without workflow info, validation will happen on server
  }

  // Parse input JSON to extract variables
  let inputVars: WorkflowVariable[] = [];
  try {
    const parsed = JSON.parse(options?.input ?? '{}');
    // Support multiple formats:
    // 1. Array format: [{variableId, name, value}, ...]
    // 2. Object with variables: {variables: [...]}
    // 3. Simple key-value: {"varName": "value", "fileVar": "df-xxx"}
    if (Array.isArray(parsed)) {
      inputVars = parsed;
    } else if (parsed.variables && Array.isArray(parsed.variables)) {
      inputVars = parsed.variables;
    } else if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      // Simple key-value format - convert to WorkflowVariable array
      inputVars = convertKeyValueToVariables(parsed, workflow);
    }
  } catch {
    fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
      hint:
        'Ensure the input is valid JSON. Supported formats:\n' +
        '  - Simple: \'{"varName": "value", "fileVar": "df-xxx"}\'\n' +
        '  - Array: \'[{"name": "varName", "value": [...]}]\'',
      suggestedFix: {
        field: '--input',
        format: 'json-object | json-array',
        example: '{"varName": "value", "fileVar": "df-xxx"}',
      },
    });
    return; // TypeScript flow control
  }

  // Check required variables when noPrompt is true (for agent/script usage)
  // This provides a recoverable error with all missing variables info
  if (options?.noPrompt && workflow?.variables) {
    const inputObject = variablesToObject(inputVars);
    const checkResult = checkRequiredVariables(workflow.variables, inputObject);

    if (!checkResult.valid) {
      const errorPayload = buildMissingVariablesError(
        'workflow',
        workflowId,
        workflow.name,
        checkResult,
      );
      fail(ErrorCodes.MISSING_VARIABLES, errorPayload.message, {
        details: errorPayload.details,
        hint: errorPayload.hint,
        suggestedFix: errorPayload.suggestedFix,
        recoverable: errorPayload.recoverable,
      });
    }
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
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to run workflow',
      );
    }
  });
