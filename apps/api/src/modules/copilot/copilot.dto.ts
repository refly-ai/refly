import { CopilotSession } from '@refly/openapi-schema';
import { CopilotSession as CopilotSessionPO } from '@prisma/client';
import { pick } from '../../utils';
import { ActionDetail, actionResultPO2DTO } from '../action/action.dto';

/**
 * Convert CopilotSession PO to DTO
 */
export const copilotSessionPO2DTO = (
  session: CopilotSessionPO & { results: ActionDetail[] },
): CopilotSession => {
  return {
    ...pick(session, ['sessionId', 'title', 'canvasId']),
    createdAt: session.createdAt.toJSON(),
    updatedAt: session.updatedAt.toJSON(),
    results: session.results?.map((result) => actionResultPO2DTO(result)),
  };
};
