import { Canvas as CanvasModel } from '@prisma/client';
import { Canvas, Entity } from '@refly-packages/openapi-schema';
import { pick } from '@/utils';

export interface SyncCanvasEntityJobData {
  canvasId: string;
}

export interface DeleteCanvasNodesJobData {
  entities: Entity[];
}

export interface AutoNameCanvasJobData {
  uid: string;
  canvasId: string;
}

export interface DuplicateCanvasJobData {
  uid: string;
  sourceCanvasId: string;
  targetCanvasId: string;
  title?: string;
  duplicateEntities?: boolean;
}

export function canvasPO2DTO(canvas: CanvasModel & { minimapUrl?: string }): Canvas {
  return {
    ...pick(canvas, ['canvasId', 'title', 'minimapUrl', 'minimapStorageKey']),
    createdAt: canvas.createdAt.toJSON(),
    updatedAt: canvas.updatedAt.toJSON(),
  };
}
