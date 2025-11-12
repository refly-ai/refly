import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  UpsertDriveFileRequest,
  DeleteDriveFileRequest,
  User,
  ListDriveFilesData,
  ListOrder,
} from '@refly/openapi-schema';
import { Prisma, DriveFile as DriveFileModel } from '../../generated/client';
import { genDriveFileID } from '@refly/utils';
import { ParamsError, DriveFileNotFoundError } from '@refly/errors';

@Injectable()
export class DriveService {
  private logger = new Logger(DriveService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * List drive files with pagination and filtering
   */
  async listDriveFiles(user: User, params: ListDriveFilesData['query']): Promise<DriveFileModel[]> {
    const { canvasId, order, page, pageSize } = params;
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required');
    }

    const where: Prisma.DriveFileWhereInput = {
      uid: user.uid,
      deletedAt: null,
      canvasId,
    };

    const driveFiles = await this.prisma.driveFile.findMany({
      where,
      orderBy: this.buildOrderBy(order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return driveFiles;
  }

  /**
   * Create or update a drive file
   */
  async upsertDriveFile(user: User, request: UpsertDriveFileRequest): Promise<DriveFileModel> {
    const { fileId, canvasId, name, type, content, externalUrl: _externalUrl } = request;

    // Calculate file size (simplified - in real implementation this would be more complex)
    const size = content ? Buffer.byteLength(content, 'utf8') : 0;

    // Generate summary (simplified - in real implementation this would use AI)
    const summary = content?.slice(0, 200) ?? 'No content';

    // Generate resultId and version (simplified)
    const resultId = genDriveFileID();
    const resultVersion = 1;

    let driveFile: DriveFileModel;

    if (fileId) {
      // Update existing file
      driveFile = await this.prisma.driveFile.update({
        where: { fileId, uid: user.uid },
        data: {
          canvasId,
          name,
          type,
          size,
          summary,
          resultId,
          resultVersion: 1,
        },
      });
    } else {
      // Create new file
      const newFileId = genDriveFileID();
      driveFile = await this.prisma.driveFile.create({
        data: {
          fileId: newFileId,
          uid: user.uid,
          canvasId,
          name,
          type,
          size: BigInt(size),
          summary,
          resultId,
          resultVersion,
        },
      });
    }

    return driveFile;
  }

  /**
   * Delete a drive file (soft delete)
   */
  async deleteDriveFile(user: User, request: DeleteDriveFileRequest): Promise<void> {
    const { fileId } = request;

    // Verify the file exists and belongs to the user
    const driveFile = await this.prisma.driveFile.findFirst({
      where: {
        fileId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!driveFile) {
      throw new DriveFileNotFoundError(`Drive file not found: ${fileId}`);
    }

    // Soft delete the file
    await this.prisma.driveFile.update({
      where: { fileId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Build order by clause from string format like "createdAt:desc"
   */
  private buildOrderBy(order: ListOrder): Prisma.DriveFileOrderByWithRelationInput {
    switch (order) {
      case 'creationAsc':
        return { createdAt: 'asc' };
      case 'creationDesc':
        return { createdAt: 'desc' };
      case 'updationAsc':
        return { updatedAt: 'asc' };
      case 'updationDesc':
        return { updatedAt: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}
