import {
  Resource as ResourceModel,
  Canvas as CanvasModel,
  Project as ProjectModel,
  Reference as ReferenceModel,
} from '@prisma/client';
import {
  Resource,
  Canvas,
  ResourceType,
  IndexStatus,
  Project,
  Reference,
  ReferenceType,
  ReferenceMeta,
} from '@refly-packages/openapi-schema';
import { pick } from '@/utils';

export type FinalizeResourceParam = {
  resourceId: string;
  uid: string;
};

export type ParseReferenceExternalUrlParam = {
  referenceIds: string[];
};

export const projectPO2DTO = (project: ProjectModel): Project => {
  return {
    ...pick(project, ['projectId', 'title', 'description', 'shareCode']),
    createdAt: project.createdAt.toJSON(),
    updatedAt: project.updatedAt.toJSON(),
  };
};

export const resourcePO2DTO = (
  resource: ResourceModel & {
    order?: number;
    content?: string;
    projectIds?: string[];
  },
): Resource => {
  if (!resource) {
    return null;
  }
  return {
    ...pick(resource, ['resourceId', 'title', 'content', 'contentPreview', 'order', 'projectIds']),
    resourceType: resource.resourceType as ResourceType,
    indexStatus: resource.indexStatus as IndexStatus,
    storageSize: resource.storageSize.toString(),
    vectorSize: resource.vectorSize.toString(),
    data: JSON.parse(resource.meta),
    createdAt: resource.createdAt.toJSON(),
    updatedAt: resource.updatedAt.toJSON(),
  };
};

export const canvasPO2DTO = (
  canvas: CanvasModel & {
    content?: string;
  },
): Canvas => {
  if (!canvas) {
    return null;
  }
  const res: Canvas = {
    ...pick(canvas, [
      'canvasId',
      'projectId',
      'title',
      'content',
      'contentPreview',
      'shareCode',
      'readOnly',
    ]),
    createdAt: canvas.createdAt.toJSON(),
    updatedAt: canvas.updatedAt.toJSON(),
  };
  return res;
};

export interface ExtendedReferenceModel extends ReferenceModel {
  sourceMetaObj?: ReferenceMeta;
  targetMetaObj?: ReferenceMeta;
}

export const referencePO2DTO = (reference: ExtendedReferenceModel): Reference => {
  return {
    ...pick(reference, ['referenceId', 'sourceId', 'targetId']),
    sourceMeta: reference.sourceMetaObj ?? JSON.parse(reference.sourceMeta || '{}'),
    targetMeta: reference.targetMetaObj ?? JSON.parse(reference.targetMeta || '{}'),
    sourceType: reference.sourceType as ReferenceType,
    targetType: reference.targetType as ReferenceType,
  };
};
