import { DriveFile as DriveFileModel } from '../../generated/client';
import { DriveFile } from '@refly/openapi-schema';
import { pick } from '../../utils';

/**
 * Transform DriveFile Prisma model to DriveFile DTO
 */
export function driveFilePO2DTO(driveFile: DriveFileModel): DriveFile {
  return {
    ...pick(driveFile, [
      'canvasId',
      'fileId',
      'name',
      'type',
      'summary',
      'resultId',
      'resultVersion',
    ]),
    size: Number(driveFile.size),
    createdAt: driveFile.createdAt.toJSON(),
    updatedAt: driveFile.updatedAt.toJSON(),
  };
}
