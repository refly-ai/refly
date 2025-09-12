import {
  ActionResult,
  ActionStatus,
  ActionStep,
  ActionType,
  EntityType,
  ModelInfo,
  ModelTier,
} from '@refly/openapi-schema';
import {
  ActionResult as ActionResultModel,
  ActionStep as ActionStepModel,
} from '../../generated/client';
import { pick, safeParseJSON } from '@refly/utils';

export type ActionDetail = ActionResultModel & {
  steps?: ActionStepModel[];
  modelInfo?: ModelInfo;
};

export function actionStepPO2DTO(step: ActionStepModel): ActionStep {
  return {
    ...pick(step, ['name', 'content', 'reasoningContent']),
    logs: safeParseJSON(step.logs || '[]'),
    artifacts: safeParseJSON(step.artifacts || '[]'),
    structuredData: safeParseJSON(step.structuredData || '{}'),
    tokenUsage: safeParseJSON(step.tokenUsage || '[]'),
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
    outputUrl: result.outputUrl,
    storageKey: result.storageKey,
    createdAt: result.createdAt.toJSON(),
    updatedAt: result.updatedAt.toJSON(),
    steps: result.steps?.map(actionStepPO2DTO),
    toolsets: safeParseJSON(result.toolsets || '[]'),
    modelInfo: result.modelInfo,
  };
}
