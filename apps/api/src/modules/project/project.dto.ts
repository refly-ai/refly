import { Project } from '@refly/openapi-schema';
import {
  Project as ProjectModel,
  Canvas as CanvasModel,
  Document as DocumentModel,
  Resource as ResourceModel,
} from '@prisma/client';
import { pick } from '../../utils';

export const projectPO2DTO = (
  project: ProjectModel & {
    coverUrl?: string;
    canvases?: CanvasModel[];
    documents?: DocumentModel[];
    resources?: ResourceModel[];
  },
): Project => {
  return {
    ...pick(project, ['projectId', 'name', 'description', 'coverUrl', 'customInstructions']),
    createdAt: project.createdAt.toJSON(),
    updatedAt: project.updatedAt.toJSON(),
  };
};
