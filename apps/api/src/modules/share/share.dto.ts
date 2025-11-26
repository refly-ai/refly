import { ShareRecord as ShareRecordModel } from '@prisma/client';
import { CreateShareRequest, EntityType, ShareRecord, User } from '@refly/openapi-schema';
import { pick } from '@refly/utils';

export function shareRecordPO2DTO(shareRecord: ShareRecordModel): ShareRecord {
  return {
    ...pick(shareRecord, [
      'shareId',
      'entityId',
      'allowDuplication',
      'parentShareId',
      'templateId',
    ]),
    entityType: shareRecord.entityType as EntityType,
    createdAt: shareRecord.createdAt.toJSON(),
    updatedAt: shareRecord.updatedAt.toJSON(),
  };
}

export interface CreateShareJobData {
  user: Pick<User, 'uid'>;
  req: CreateShareRequest;
}

export interface ShareExtraData {
  vectorStorageKey: string;
}

export interface SharePageData {
  canvasId: string;
  page: {
    pageId: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  content: {
    nodeIds: string[];
  };
  nodeRelations: Array<{
    relationId: string;
    pageId: string;
    nodeId: string;
    nodeType: string;
    entityId: string;
    orderIndex: number;
    shareId?: string;
    nodeData: {
      metadata?: {
        shareId?: string;
      };
      [key: string]: unknown;
    };
  }>;
  pageConfig: {
    layout: string;
    theme: string;
  };
  snapshotTime: Date;
}
