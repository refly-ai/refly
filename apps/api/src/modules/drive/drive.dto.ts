import { DriveFile as DriveFileModel } from '@prisma/client';
import type {
  DriveFile,
  DriveFileSource,
  DriveFileCategory,
  DriveFileScope,
} from '@refly/openapi-schema';
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
      'scope',
      'summary',
      'variableId',
      'resultId',
      'resultVersion',
      'storageKey',
    ]),
    source: driveFile.source as DriveFileSource,
    scope: driveFile.scope as DriveFileScope,
    category: driveFile.category as DriveFileCategory,
    size: Number(driveFile.size),
    createdAt: driveFile.createdAt.toJSON(),
    updatedAt: driveFile.updatedAt.toJSON(),
  };
}
