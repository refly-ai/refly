import {
  PilotSession as PilotSessionPO,
  PilotStep as PilotStepPO,
  ActionResult as ActionResultPO,
} from '../../generated/client';
import { actionResultPO2DTO } from '../action/action.dto';
import { pick } from '../../utils';
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
    ...pick(session, [
      'sessionId',
      'title',
      'input',
      'status',
      'targetType',
      'targetId',
      'currentEpoch',
      'maxEpoch',
    ]),
    input: JSON.parse(session.input),
    targetType: session.targetType as EntityType,
    status: session.status as PilotSessionStatus,
    createdAt: session.createdAt.toJSON(),
    updatedAt: session.updatedAt.toJSON(),
  };
};

/**
 * Convert PilotStep PO to DTO
 */
export const pilotStepPO2DTO = (step: PilotStepPO, actionResult?: ActionResultPO): PilotStep => {
  return {
    ...pick(step, ['stepId', 'name', 'epoch', 'entityId', 'entityType', 'status', 'rawOutput']),
    status: step.status as PilotStepStatus,
    rawOutput: step.rawOutput ?? undefined,
    actionResult: actionResult ? actionResultPO2DTO(actionResult) : undefined,
    createdAt: step.createdAt.toJSON(),
    updatedAt: step.updatedAt.toJSON(),
  };
};
