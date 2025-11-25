import { Canvas, Document } from '@prisma/client';
import { User } from '@refly/openapi-schema';

type BaseEntity = {
  uid: string;
  stateStorageKey?: string;
};

type DocumentEntity = Document & BaseEntity;
type CanvasEntity = Canvas & BaseEntity;

type EntityTypeMap = {
  document: DocumentEntity;
  canvas: CanvasEntity;
};

export type CollabContext = {
  [K in keyof EntityTypeMap]: {
    user: User;
    entityType: K;
    entity: EntityTypeMap[K];
  };
}[keyof EntityTypeMap];

export const isDocumentContext = (
  context: CollabContext,
): context is Extract<CollabContext, { entityType: 'document' }> => {
  return context.entityType === 'document';
};

export const isCanvasContext = (
  context: CollabContext,
): context is Extract<CollabContext, { entityType: 'canvas' }> => {
  return context.entityType === 'canvas';
};
