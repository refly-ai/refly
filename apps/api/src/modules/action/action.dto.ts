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
  ActionErrorType,
} from '@refly/openapi-schema';
import {
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

export function toolCallResultPO2DTO(toolCall: ToolCallResultModel): ToolCallResult {
  return {
    callId: toolCall.callId,
    uid: toolCall.uid,
    toolsetId: toolCall.toolsetId,
    toolName: toolCall.toolName,
    stepName: toolCall.stepName,
    input: safeParseJSON(toolCall.input || '{}'),
    output: safeParseJSON(toolCall.output || '{}'),
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
    files: result.files,
    toolsets: safeParseJSON(result.toolsets || '[]'),
    modelInfo: result.modelInfo,
  };
}
