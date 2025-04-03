import {
  ActionResult,
  ActionStep,
  ActionType,
  EntityType,
  ModelTier,
} from '@refly-packages/openapi-schema';
import {
  ActionResult as ActionResultModel,
  ActionStep as ActionStepModel,
  ModelInfo as ModelInfoModel,
} from '@prisma/client';
import { pick } from '@/utils';
import { modelInfoPO2DTO } from '@/misc/misc.dto';

export type ActionDetail = ActionResultModel & {
  steps?: ActionStepModel[];
  modelInfo?: ModelInfoModel;
};

export function actionStepPO2DTO(step: ActionStepModel): ActionStep {
  return {
    ...pick(step, ['name', 'content', 'reasoningContent']),
    logs: JSON.parse(step.logs || '[]'),
    artifacts: JSON.parse(step.artifacts || '[]'),
    structuredData: JSON.parse(step.structuredData || '{}'),
    tokenUsage: JSON.parse(step.tokenUsage || '[]'),
  };
}

export function actionResultPO2DTO(result: ActionDetail): ActionResult {
  return {
    ...pick(result, ['resultId', 'version', 'title', 'targetId', 'status']),
    type: result.type as ActionType,
    tier: result.tier as ModelTier,
    targetType: result.targetType as EntityType,
    input: JSON.parse(result.input || '{}'),
    actionMeta: JSON.parse(result.actionMeta || '{}'),
    context: JSON.parse(result.context || '{}'),
    tplConfig: JSON.parse(result.tplConfig || '{}'),
    runtimeConfig: JSON.parse(result.runtimeConfig || '{}'),
    history: JSON.parse(result.history || '[]'),
    errors: JSON.parse(result.errors || '[]'),
    createdAt: result.createdAt.toJSON(),
    updatedAt: result.updatedAt.toJSON(),
    steps: result.steps?.map(actionStepPO2DTO),
    modelInfo: result.modelInfo ? modelInfoPO2DTO(result.modelInfo) : undefined,
  };
}
