/**
 * refly workflow run node-result - Get node execution result
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

interface ToolCallResult {
  callId: string;
  toolsetId: string;
  toolName: string;
  stepName?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'executing' | 'completed' | 'failed';
  error?: string;
}

interface NodeStep {
  name: string;
  content: string;
  reasoningContent?: string;
  tokenUsage?: TokenUsage[];
  toolCalls?: ToolCallResult[];
}

interface NodeMessage {
  messageId: string;
  type: string;
  content: string;
  reasoningContent?: string;
}

interface NodeResult {
  resultId: string;
  version: number;
  title: string;
  status: string;
  steps?: NodeStep[];
  messages?: NodeMessage[];
  errors?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export const workflowRunNodeResultCommand = new Command('node-result')
  .description('Get node execution result')
  .argument('<resultId>', 'Node result ID')
  .option('--include-steps', 'Include detailed step information')
  .option('--include-messages', 'Include chat messages')
  .option('--include-tool-calls', 'Include tool call details')
  .action(async (resultId, options) => {
    try {
      const result = await apiRequest<NodeResult>(`/v1/cli/action/result?resultId=${resultId}`);

      // Calculate total token usage from all steps
      let totalTokenUsage: { input: number; output: number; reasoning: number } | undefined;
      if (result.steps?.length) {
        totalTokenUsage = { input: 0, output: 0, reasoning: 0 };
        for (const step of result.steps) {
          if (step.tokenUsage?.length) {
            for (const usage of step.tokenUsage) {
              totalTokenUsage.input += usage.inputTokens || 0;
              totalTokenUsage.output += usage.outputTokens || 0;
              totalTokenUsage.reasoning += usage.reasoningTokens || 0;
            }
          }
        }
      }

      // Get the last step content as the main result content
      const lastStep = result.steps?.[result.steps.length - 1];
      const content = lastStep?.content;

      // Format output based on options
      const output: Record<string, unknown> = {
        resultId: result.resultId,
        version: result.version,
        title: result.title,
        status: result.status,
        content,
        tokenUsage: totalTokenUsage,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      if (options.includeSteps && result.steps) {
        output.steps = result.steps.map((step, index) => ({
          stepIndex: index,
          name: step.name,
          content: step.content,
          reasoningContent: step.reasoningContent,
          toolCallsCount: step.toolCalls?.length ?? 0,
        }));
      }

      if (options.includeToolCalls && result.steps) {
        // Collect all tool calls from all steps
        const allToolCalls: unknown[] = [];
        for (const step of result.steps) {
          if (step.toolCalls?.length) {
            for (const tc of step.toolCalls) {
              allToolCalls.push({
                callId: tc.callId,
                toolName: tc.toolName,
                status: tc.status,
                error: tc.error,
              });
            }
          }
        }
        output.toolCalls = allToolCalls;
      }

      if (options.includeMessages && result.messages) {
        output.messages = result.messages.map((msg) => ({
          messageId: msg.messageId,
          type: msg.type,
          content: msg.content,
        }));
      }

      if (result.errors?.length) {
        output.errors = result.errors;
      }

      ok('workflow.run.node-result', output);
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
        error instanceof Error ? error.message : 'Failed to get node result',
      );
    }
  });
