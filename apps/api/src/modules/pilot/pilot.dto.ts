import {
  PilotSession as PilotSessionPO,
  PilotStep as PilotStepPO,
  ActionResult as ActionResultPO,
} from '@/generated/client';
import { actionResultPO2DTO } from '@/modules/action/action.dto';
import {
  PilotSession,
  PilotSessionStatus,
  PilotStep,
  PilotStepStatus,
  EntityType,
} from '@refly/openapi-schema';
import {} from '@refly/openapi-schema';

/**
 * Convert PilotSession PO to DTO
 */
export const pilotSessionPO2DTO = (session: PilotSessionPO): PilotSession => {
  return {
    sessionId: session.sessionId,
    title: session.title,
    input: JSON.parse(session.input),
    status: session.status as PilotSessionStatus,
    targetType: session.targetType as EntityType,
    targetId: session.targetId ?? '',
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
};

/**
 * Convert PilotStep PO to DTO
 */
export const pilotStepPO2DTO = (step: PilotStepPO, actionResult?: ActionResultPO): PilotStep => {
  return {
    stepId: step.stepId,
    name: step.name,
    epoch: step.epoch,
    entityId: step.entityId ?? undefined,
    entityType: step.entityType ?? undefined,
    status: step.status as PilotStepStatus,
    rawOutput: step.rawOutput ?? undefined,
    actionResult: actionResult ? actionResultPO2DTO(actionResult) : undefined,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  };
};
