import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MiscService } from '../misc/misc.service';
import { PrismaService } from '../common/prisma.service';
import { User } from '@prisma/client';
import { OPENAPI_UPLOAD_TTL_SECONDS } from './openapi.constants';
import { buildOpenapiStorageKey, generateOpenapiFileKey } from '../../utils/openapi-file-key';

export interface UploadedFileInfo {
  fileKey: string;
  fileName: string;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly miscService: MiscService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload multiple files for webhook/API use
   * Files are stored as temporary static files (not bound to a canvas)
   * Users should use storageKey in variable values and trigger run promptly
   */
  async uploadFiles(files: Express.Multer.File[], user: User): Promise<UploadedFileInfo[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    this.logger.log(`[FILE_UPLOAD] uid=${user.uid} fileCount=${files.length}`);

    const uploadPromises = files.map(async (file) => {
      try {
        const fileKey = generateOpenapiFileKey(user.uid, file.buffer);
        const storageKey = buildOpenapiStorageKey(user.uid, fileKey);
        const expiresAt = new Date(Date.now() + OPENAPI_UPLOAD_TTL_SECONDS * 1000);
        const existing = await this.prisma.staticFile.findFirst({
          where: { storageKey, uid: user.uid, deletedAt: null },
        });

        if (existing) {
          const contentType = file.mimetype || 'application/octet-stream';
          const fileExists = await this.miscService.fileStorageExists(
            storageKey,
            existing.visibility as 'private' | 'public',
          );
          if (!fileExists) {
            await this.miscService.uploadFile(user, { file, storageKey });
          }
          await this.prisma.staticFile.update({
            where: { pk: existing.pk },
            data: {
              expiredAt: expiresAt,
              originalName: file.originalname,
              contentType,
            },
          });

          return {
            fileKey,
            fileName: file.originalname,
          };
        }

        await this.miscService.uploadFile(user, { file, storageKey });
        await this.prisma.staticFile.updateMany({
          where: { storageKey, uid: user.uid, deletedAt: null },
          data: { expiredAt: expiresAt },
        });

        // Return only file metadata, NOT the public URL
        // This prevents the API from being abused as a free file hosting service
        return {
          fileKey,
          fileName: file.originalname,
        };
      } catch (error) {
        this.logger.error(`Failed to upload file ${file.originalname}: ${error.message}`);
        throw new BadRequestException(
          `Failed to upload file ${file.originalname}: ${error.message}`,
        );
      }
    });

    const results = await Promise.all(uploadPromises);

    this.logger.log(`[FILE_UPLOAD_SUCCESS] uid=${user.uid} uploadedCount=${results.length}`);

    return results;
  }
}
