/**
 * refly workflow result - Get action result by resultId
 *
 * Fetches detailed action result information directly by resultId (ar-xxx).
 * This is useful when you have a resultId from workflow detail and want to
 * see the full execution output including steps, tool calls, and messages.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiGetActionResult, ActionResultResponse } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface ResultOutputOptions {
  includeSteps?: boolean;
  includeMessages?: boolean;
  includeToolCalls?: boolean;
  raw?: boolean;
}

function formatResult(result: ActionResultResponse, options: ResultOutputOptions) {
  const output: Record<string, unknown> = {
    resultId: result.resultId,
    version: result.version,
    title: result.title,
    type: result.type,
    status: result.status,
  };

  // Include workflow context if available
  if (result.workflowExecutionId) {
    output.workflowExecutionId = result.workflowExecutionId;
  }
  if (result.workflowNodeExecutionId) {
    output.workflowNodeExecutionId = result.workflowNodeExecutionId;
  }

  // Include timing
  output.timing = {
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };

  // Include errors if any
  if (result.errors && result.errors.length > 0) {
    output.errors = result.errors;
  }
  if (result.errorType) {
    output.errorType = result.errorType;
  }

  // Include output URL if available
  if (result.outputUrl) {
    output.outputUrl = result.outputUrl;
  }

  // Include files if any
  if (result.files && result.files.length > 0) {
    output.files = result.files;
  }

  // Include model info if available
  if (result.modelInfo) {
    output.modelInfo = result.modelInfo;
  }

  // Include steps if requested
  if (options.includeSteps && result.steps) {
    if (options.raw) {
      output.steps = result.steps;
    } else {
      // Summarize steps for display
      output.steps = result.steps.map((step) => ({
        name: step.name,
        contentPreview:
          step.content?.substring(0, 200) +
          (step.content && step.content.length > 200 ? '...' : ''),
        toolCallsCount: step.toolCalls?.length || 0,
        ...(options.includeToolCalls && step.toolCalls
          ? {
              toolCalls: step.toolCalls.map((tc) => ({
                callId: tc.callId,
                toolName: tc.toolName,
                status: tc.status,
                ...(options.raw ? { input: tc.input, output: tc.output } : {}),
                ...(tc.error ? { error: tc.error } : {}),
              })),
            }
          : {}),
      }));
    }
  }

  // Include messages if requested
  if (options.includeMessages && result.messages) {
    if (options.raw) {
      output.messages = result.messages;
    } else {
      // Summarize messages for display
      output.messages = result.messages.map((msg) => ({
        messageId: msg.messageId,
        type: msg.type,
        contentPreview:
          msg.content?.substring(0, 200) + (msg.content && msg.content.length > 200 ? '...' : ''),
        createdAt: msg.createdAt,
      }));
    }
  }

  return output;
}

export const workflowResultCommand = new Command('result')
  .description('Get action result by resultId')
  .argument('<resultId>', 'Action result ID (ar-xxx)')
  .option('--include-steps', 'Include execution steps')
  .option('--include-messages', 'Include action messages')
  .option('--include-tool-calls', 'Include tool call details (requires --include-steps)')
  .option('--raw', 'Show full content without truncation')
  .action(async (resultId, options) => {
    try {
      // Validate resultId format
      if (!resultId.startsWith('ar-') && !resultId.startsWith('start-')) {
        return fail(ErrorCodes.INVALID_INPUT, `Invalid resultId format: ${resultId}`, {
          hint: 'Result ID should start with "ar-" or "start-"',
          suggestedFix: {
            field: 'resultId',
            format: 'ar-xxx or start-xxx',
            example: 'ar-cq18zd4qr97nbla1tu1rqqmd',
          },
        });
      }

      const result = await apiGetActionResult(resultId);

      const formattedResult = formatResult(result, {
        includeSteps: options.includeSteps,
        includeMessages: options.includeMessages,
        includeToolCalls: options.includeToolCalls,
        raw: options.raw,
      });

      ok('workflow.result', formattedResult);
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
        error instanceof Error ? error.message : 'Failed to get action result',
      );
    }
  });
