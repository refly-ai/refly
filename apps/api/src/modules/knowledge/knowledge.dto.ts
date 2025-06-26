import {
  Resource as ResourceModel,
  Document as DocumentModel,
  Reference as ReferenceModel,
  StaticFile as StaticFileModel,
} from '../../generated/client';
import {
  Resource,
  ResourceType,
  IndexStatus,
  IndexError,
  Reference,
  ReferenceType,
  ReferenceMeta,
  Document,
  EntityType,
  ResourceMeta,
} from '@refly/openapi-schema';
import { pick } from '../../utils';
import { safeParseJSON } from '@refly/utils';

export interface ResourcePrepareResult {
  storageKey?: string;
  staticFile?: StaticFileModel;
  storageSize?: number;
  identifier?: string;
  indexStatus?: IndexStatus;
  indexError?: IndexError;
  contentPreview?: string;
  metadata?: ResourceMeta;
}

export type DocumentDetail = DocumentModel & {
  content?: string;
};

export type ResourceDetail = ResourceModel & {
  content?: string;
  downloadURL?: string;
};

export type FinalizeResourceParam = {
  resourceId: string;
  uid: string;
};

export type DeleteKnowledgeEntityJobData = {
  uid: string;
  entityId: string;
  entityType: EntityType;
};

export type PostDeleteKnowledgeEntityJobData = {
  uid: string;
  entityId: string;
  entityType: EntityType;
};

export const resourcePO2DTO = (resource: ResourceDetail): Resource => {
  if (!resource) {
    return null;
  }
  return {
    ...pick(resource, [
      'resourceId',
      'title',
      'content',
      'contentPreview',
      'rawFileKey',
      'downloadURL',
    ]),
    resourceType: resource.resourceType as ResourceType,
    indexStatus: resource.indexStatus as IndexStatus,
    indexError: resource.indexError ? safeParseJSON(resource.indexError) : undefined,
    storageSize: resource.storageSize.toString(),
    vectorSize: resource.vectorSize.toString(),
    data: safeParseJSON(resource.meta),
    createdAt: resource.createdAt.toJSON(),
    updatedAt: resource.updatedAt.toJSON(),
  };
};

export const documentPO2DTO = (doc: DocumentDetail): Document => {
  if (!doc) {
    return null;
  }
  const res: Document = {
    ...pick(doc, ['docId', 'title', 'content', 'contentPreview', 'readOnly']),
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
