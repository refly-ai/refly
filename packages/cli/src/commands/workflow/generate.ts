/**
 * refly workflow generate - Generate a workflow using AI from natural language
 *
 * Includes auto-cleanup: if generation fails (timeout/error), attempts to find
 * and delete any partially created workflow to avoid orphaned resources.
 */

import { Command } from 'commander';
import { ok, fail, print, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getWebUrl } from '../../config/config.js';

interface GenerateWorkflowResponse {
  workflowId: string;
  canvasId: string;
  sessionId: string;
  resultId: string;
  planId: string;
  workflowPlan: {
    title: string;
    tasks: Array<{
      id: string;
      title: string;
      prompt: string;
      toolsets?: string[];
      dependentTasks?: string[];
    }>;
    variables?: Array<{
      variableId: string;
      name: string;
      description: string;
      variableType: string;
      required?: boolean;
    }>;
  };
  nodesCount: number;
  edgesCount: number;
}

interface WorkflowListItem {
  name: string;
  link: string;
  createdAt: string;
}

interface WorkflowListResponse {
  workflows: WorkflowListItem[];
  total: number;
}

/**
 * Extract workflow ID from link URL
 * e.g., "http://localhost:5173/workflow/c-xxx" -> "c-xxx"
 */
function extractWorkflowId(link: string): string | null {
  const match = link.match(/\/workflow\/(c-[a-z0-9]+)$/);
  return match ? match[1] : null;
}

/**
 * Cleanup orphaned workflows created after startTime that match the query
 * This handles cases where the API created a workflow but CLI timed out
 */
async function cleanupOrphanedWorkflows(
  startTime: number,
  query: string,
): Promise<{ deleted: string[]; errors: string[] }> {
  const deleted: string[] = [];
  const errors: string[] = [];

  try {
    // Get recent workflows
    const listResult = await apiRequest<WorkflowListResponse>('/v1/cli/workflow/list', {
      timeout: 10000,
    });

    if (!listResult.workflows?.length) {
      return { deleted, errors };
    }

    // Find workflows created after startTime with matching name
    // Use first 30 chars of query for matching (workflow names are truncated)
    const queryPrefix = query.substring(0, 30).toLowerCase();

    for (const workflow of listResult.workflows) {
      const createdAt = new Date(workflow.createdAt).getTime();

      // Only check workflows created after our request started
      if (createdAt < startTime) {
        continue;
      }

      // Check if name contains query prefix (case-insensitive)
      const nameLower = workflow.name.toLowerCase();
      if (nameLower.includes(queryPrefix) || nameLower.includes('workflow:')) {
        const workflowId = extractWorkflowId(workflow.link);
        if (workflowId) {
          try {
            await apiRequest(`/v1/cli/workflow/${workflowId}`, {
              method: 'DELETE',
              timeout: 5000,
            });
            deleted.push(workflowId);
          } catch {
            errors.push(workflowId);
          }
        }
      }
    }
  } catch {
    // Silently fail cleanup - don't block the main error
  }

  return { deleted, errors };
}

export const workflowGenerateCommand = new Command('generate')
  .description('Generate a workflow using AI from natural language description')
  .requiredOption('--query <query>', 'Natural language description of the workflow')
  .option('--canvas-id <canvasId>', 'Optional canvas ID (to update existing workflow)')
  .option('--project-id <projectId>', 'Optional project ID')
  .option('--model-id <modelItemId>', 'Optional model ID to use for generation')
  .option('--locale <locale>', 'Output language locale (e.g., en, zh)')
  .option('--timeout <ms>', 'Timeout in milliseconds (default: 300000)', '300000')
  .option('--variables <json>', 'Predefined workflow variables as JSON')
  .option('--skip-default-nodes', 'Skip creating default nodes (start + skillResponse)')
  .option('--no-cleanup', 'Disable auto-cleanup of orphaned workflows on failure')
  .action(async (options) => {
    // Record start time for cleanup logic
    const startTime = Date.now();
    const query = options.query as string;

    try {
      // Parse variables JSON if provided
      let variables: unknown[] | undefined;
      if (options.variables) {
        try {
          variables = JSON.parse(options.variables);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --variables', {
            hint:
              'Variables format: \'[{"name": "varName", "variableType": "string", "description": "desc", "required": true}]\'\n' +
              'Variable types: "string" (text input) or "resource" (file input)',
            suggestedFix: {
              field: '--variables',
              format: 'json-array',
              example:
                '[{"name": "varName", "variableType": "string", "description": "desc", "required": true}]',
            },
          });
        }
      }

      // Build request body
      const body: Record<string, unknown> = {
        query,
        timeout: Number.parseInt(options.timeout, 10),
      };

      if (options.canvasId) body.canvasId = options.canvasId;
      if (options.projectId) body.projectId = options.projectId;
      if (options.modelId) body.modelItemId = options.modelId;
      if (options.locale) body.locale = options.locale;
      if (variables) body.variables = variables;
      if (options.skipDefaultNodes) body.skipDefaultNodes = true;

      // Call API - this may take a while as it invokes AI
      const result = await apiRequest<GenerateWorkflowResponse>('/v1/cli/workflow/generate', {
        method: 'POST',
        body,
        timeout: Number.parseInt(options.timeout, 10) + 30000, // Add buffer for API processing
      });

      // Format output
      ok('workflow.generate', {
        message: 'Workflow generated successfully',
        url: `${getWebUrl()}/workflow/${result.workflowId}`,
        title: result.workflowPlan?.title,
        nodesCount: result.nodesCount,
        workflowId: result.workflowId,
        planId: result.planId,
        sessionId: result.sessionId,
        plan: {
          tasksCount: result.workflowPlan?.tasks?.length ?? 0,
          variablesCount: result.workflowPlan?.variables?.length ?? 0,
          tasks: result.workflowPlan?.tasks?.map((t) => ({
            id: t.id,
            title: t.title,
            toolsets: t.toolsets,
          })),
        },
      });
    } catch (error) {
      // Auto-cleanup orphaned workflows on failure (unless disabled)
      let cleanupResult: { deleted: string[]; errors: string[] } | null = null;
      if (options.cleanup !== false) {
        cleanupResult = await cleanupOrphanedWorkflows(startTime, query);
        if (cleanupResult.deleted.length > 0) {
          print('workflow.cleanup', {
            message: 'Cleaned up orphaned workflow(s) created during failed generation',
            deleted: cleanupResult.deleted,
            hint: 'Use --no-cleanup to disable this behavior',
          });
        }
      }

      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: { ...error.details, cleanedUp: cleanupResult?.deleted },
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to generate workflow',
        {
          hint: 'The AI generation may have timed out. Try increasing --timeout or simplifying your query.',
          details: { cleanedUp: cleanupResult?.deleted },
        },
      );
    }
  });
