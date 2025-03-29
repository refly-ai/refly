import { Project } from '@refly-packages/openapi-schema';
import {
  Project as ProjectModel,
  Canvas as CanvasModel,
  Document as DocumentModel,
  Resource as ResourceModel,
} from '@prisma/client';
import { canvasPO2DTO } from '@/canvas/canvas.dto';
import { resourcePO2DTO } from '@/knowledge/knowledge.dto';
import { documentPO2DTO } from '@/knowledge/knowledge.dto';
import { pick } from '@/utils';

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
    canvases: project.canvases?.map((canvas) => canvasPO2DTO(canvas)),
    documents: project.documents?.map((document) => documentPO2DTO(document)),
    resources: project.resources?.map((resource) => resourcePO2DTO(resource)),
  };
};
