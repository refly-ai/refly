import {
  ActionResult,
  ActionStatus,
  ActionStep,
  ActionType,
  EntityType,
  ModelInfo,
  ModelTier,
  DriveFile,
  ToolCallResult,
  ActionMessage,
  ActionErrorType,
  ActionMessageType,
  ToolCallMeta,
} from '@refly/openapi-schema';
import {
  ActionMessage as ActionMessageModel,
  ActionResult as ActionResultModel,
  ActionStep as ActionStepModel,
  ToolCallResult as ToolCallResultModel,
} from '@prisma/client';
import { pick, safeParseJSON } from '@refly/utils';

type ActionStepDetail = ActionStepModel & {
  toolCalls?: ToolCallResultModel[];
};

export type ActionDetail = ActionResultModel & {
  steps?: ActionStepDetail[];
  messages?: ActionMessage[];
  files?: DriveFile[];
  modelInfo?: ModelInfo;
};

export function actionStepPO2DTO(step: ActionStepDetail): ActionStep {
  return {
    ...pick(step, ['name', 'content', 'reasoningContent']),
    logs: safeParseJSON(step.logs || '[]'),
    artifacts: safeParseJSON(step.artifacts || '[]'),
    structuredData: safeParseJSON(step.structuredData || '{}'),
    tokenUsage: safeParseJSON(step.tokenUsage || '[]'),
    toolCalls: step.toolCalls?.map(toolCallResultPO2DTO),
  };
}

export function actionMessagePO2DTO(message: ActionMessageModel): ActionMessage {
  return {
    ...pick(message, ['messageId', 'content', 'reasoningContent', 'usageMeta', 'toolCallId']),
    type: message.type as ActionMessageType,
    toolCallMeta: safeParseJSON(message.toolCallMeta || '{}') as ToolCallMeta,
    createdAt: message.createdAt.toJSON(),
    updatedAt: message.updatedAt.toJSON(),
  };
}

/**
 * Sanitize tool output for frontend display
 * Removes large content fields that are not needed for display
 */
function sanitizeToolOutput(
  toolName: string,
  output: Record<string, unknown>,
): Record<string, unknown> {
  // For read_file, remove the content field from data as it can be very large
  if (toolName === 'read_file' && output?.data && typeof output.data === 'object') {
    const data = output.data as Record<string, unknown>;
    if ('content' in data) {
      return {
        ...output,
        data: {
          ...data,
          content: '[Content omitted for display]',
        },
      };
    }
  }
  return output;
}

export function toolCallResultPO2DTO(toolCall: ToolCallResultModel): ToolCallResult {
  const rawOutput = safeParseJSON(toolCall.output || '{}');
  const output = sanitizeToolOutput(toolCall.toolName, rawOutput);

  return {
    callId: toolCall.callId,
    uid: toolCall.uid,
    toolsetId: toolCall.toolsetId,
    toolName: toolCall.toolName,
    stepName: toolCall.stepName,
    input: safeParseJSON(toolCall.input || '{}'),
    output,
    error: toolCall.error || '',
    status: toolCall.status as 'executing' | 'completed' | 'failed',
    createdAt: toolCall.createdAt.getTime(),
    updatedAt: toolCall.updatedAt.getTime(),
    deletedAt: toolCall.deletedAt?.getTime(),
  };
}

export function actionResultPO2DTO(result: ActionDetail): ActionResult {
  return {
    ...pick(result, [
      'resultId',
      'version',
      'title',
      'targetId',
      'pilotSessionId',
      'pilotStepId',
      'workflowExecutionId',
      'workflowNodeExecutionId',
      'actualProviderItemId',
      'isAutoModelRouted',
    ]),
    type: result.type as ActionType,
    tier: result.tier as ModelTier,
    targetType: result.targetType as EntityType,
    input: safeParseJSON(result.input || '{}'),
    status: result.status as ActionStatus,
    actionMeta: safeParseJSON(result.actionMeta || '{}'),
    context: safeParseJSON(result.context || '{}'),
    tplConfig: safeParseJSON(result.tplConfig || '{}'),
    runtimeConfig: safeParseJSON(result.runtimeConfig || '{}'),
    history: safeParseJSON(result.history || '[]'),
    errors: safeParseJSON(result.errors || '[]'),
    errorType: result.errorType as ActionErrorType,
    outputUrl: result.outputUrl,
    storageKey: result.storageKey,
    createdAt: result.createdAt.toJSON(),
    updatedAt: result.updatedAt.toJSON(),
    steps: result.steps?.map(actionStepPO2DTO),
    messages: result.messages,
    files: result.files,
    toolsets: safeParseJSON(result.toolsets || '[]'),
    modelInfo: result.modelInfo,
  };
}
