import { ShareRecord as ShareRecordModel } from '../../generated/client';
import { EntityType, ShareRecord } from '@refly/openapi-schema';
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
