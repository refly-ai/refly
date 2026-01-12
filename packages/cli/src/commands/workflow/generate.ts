/**
 * refly workflow generate - Generate a workflow using AI from natural language
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

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
  .action(async (options) => {
    try {
      // Parse variables JSON if provided
      let variables: unknown[] | undefined;
      if (options.variables) {
        try {
          variables = JSON.parse(options.variables);
        } catch {
          fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --variables', {
            hint: 'Ensure the variables parameter is valid JSON',
          });
        }
      }

      // Build request body
      const body: Record<string, unknown> = {
        query: options.query,
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
        workflowId: result.workflowId,
        planId: result.planId,
        sessionId: result.sessionId,
        nodesCount: result.nodesCount,
        edgesCount: result.edgesCount,
        plan: {
          title: result.workflowPlan?.title,
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
      if (error instanceof CLIError) {
        fail(error.code, error.message, { details: error.details, hint: error.hint });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to generate workflow',
        {
          hint: 'The AI generation may have timed out. Try increasing --timeout or simplifying your query.',
        },
      );
    }
  });
