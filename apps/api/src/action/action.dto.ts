import {
  InvokeActionRequest,
  ActionResult,
  ActionStep,
  ActionType,
  EntityType,
} from '@refly-packages/openapi-schema';
import { ActionResult as ActionResultModel, ActionStep as ActionStepModel } from '@prisma/client';
import { pick } from '@/utils';

export interface InvokeActionJobData extends InvokeActionRequest {
  uid: string;
  rawParam: string;
}

export function actionStepPO2DTO(step: ActionStepModel): ActionStep {
  return {
    ...pick(step, ['name', 'content']),
    artifacts: JSON.parse(step.artifacts || '[]'),
    structuredData: JSON.parse(step.structuredData || '{}'),
    tokenUsage: JSON.parse(step.tokenUsage || '[]'),
  };
}

export function actionResultPO2DTO(
  result: ActionResultModel & { steps?: ActionStepModel[] },
): ActionResult {
  return {
    ...pick(result, ['resultId', 'title', 'targetId', 'status']),
    type: result.type as ActionType,
    targetType: result.targetType as EntityType,
    actionMeta: JSON.parse(result.actionMeta || '{}'),
    context: JSON.parse(result.context || '{}'),
    tplConfig: JSON.parse(result.tplConfig || '{}'),
    history: JSON.parse(result.history || '[]'),
    logs: JSON.parse(result.logs || '[]'),
    errors: JSON.parse(result.errors || '[]'),
    createdAt: result.createdAt.toJSON(),
    updatedAt: result.updatedAt.toJSON(),
    steps: result.steps?.map(actionStepPO2DTO),
  };
}
