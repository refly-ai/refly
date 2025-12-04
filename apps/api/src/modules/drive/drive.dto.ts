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
 * @param driveFile - Prisma DriveFile model
 * @param origin - Server origin for generating content URL (e.g., 'https://api.example.com')
 */
export function driveFilePO2DTO(driveFile: DriveFileModel, origin?: string): DriveFile {
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
    url: origin ? `${origin}/v1/drive/file/content/${driveFile.fileId}` : undefined,
  };
}
