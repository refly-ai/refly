import {
  Resource as ResourceModel,
  Document as DocumentModel,
  Reference as ReferenceModel,
  StaticFile as StaticFileModel,
} from '@prisma/client';
import {
  Resource,
  ResourceType,
  IndexStatus,
  Reference,
  ReferenceType,
  ReferenceMeta,
  Document,
  EntityType,
  ResourceMeta,
} from '@refly-packages/openapi-schema';
import { pick } from '@/utils';

export interface ResourcePrepareResult {
  storageKey?: string;
  staticFile?: StaticFileModel;
  storageSize?: number;
  identifier?: string;
  indexStatus?: IndexStatus;
  contentPreview?: string;
  metadata?: ResourceMeta;
}

export type FinalizeResourceParam = {
  resourceId: string;
  uid: string;
};

export type DeleteKnowledgeEntityJobData = {
  uid: string;
  entityId: string;
  entityType: EntityType;
};

export const resourcePO2DTO = (
  resource: ResourceModel & {
    content?: string;
  },
): Resource => {
  if (!resource) {
    return null;
  }
  return {
    ...pick(resource, ['resourceId', 'title', 'content', 'contentPreview', 'rawFileKey']),
    resourceType: resource.resourceType as ResourceType,
    indexStatus: resource.indexStatus as IndexStatus,
    storageSize: resource.storageSize.toString(),
    vectorSize: resource.vectorSize.toString(),
    data: JSON.parse(resource.meta),
    createdAt: resource.createdAt.toJSON(),
    updatedAt: resource.updatedAt.toJSON(),
  };
};

export const documentPO2DTO = (
  doc: DocumentModel & {
    content?: string;
  },
): Document => {
  if (!doc) {
    return null;
  }
  const res: Document = {
    ...pick(doc, ['docId', 'title', 'content', 'contentPreview', 'shareCode', 'readOnly']),
    createdAt: doc.createdAt.toJSON(),
    updatedAt: doc.updatedAt.toJSON(),
  };
  return res;
};

export interface ExtendedReferenceModel extends ReferenceModel {
  sourceMeta?: ReferenceMeta;
  targetMeta?: ReferenceMeta;
}

export const referencePO2DTO = (reference: ExtendedReferenceModel): Reference => {
  return {
    ...pick(reference, ['referenceId', 'sourceId', 'targetId', 'sourceMeta', 'targetMeta']),
    sourceType: reference.sourceType as ReferenceType,
    targetType: reference.targetType as ReferenceType,
  };
};
