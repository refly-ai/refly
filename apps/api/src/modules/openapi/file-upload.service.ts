import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DriveService } from '../drive/drive.service';
import { User } from '@prisma/client';

export interface UploadedFileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly OPENAPI_CANVAS_ID = 'openapi-upload';

  constructor(private readonly driveService: DriveService) {}

  /**
   * Upload multiple files for webhook/API use
   * Files are stored in OSS_EXTERNAL but URLs are NOT returned to prevent abuse
   * Users should use file IDs in webhook calls, not direct URLs
   */
  async uploadFiles(files: Express.Multer.File[], user: User): Promise<UploadedFileInfo[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    this.logger.log(`[FILE_UPLOAD] uid=${user.uid} fileCount=${files.length}`);

    const uploadPromises = files.map(async (file) => {
      try {
        // Upload file using DriveService
        const driveFile = await this.driveService.uploadAndCreateFile(
          user,
          file,
          this.OPENAPI_CANVAS_ID,
        );

        // Return only file metadata, NOT the public URL
        // This prevents the API from being abused as a free file hosting service
        return {
          fileId: driveFile.fileId,
          fileName: driveFile.name,
          fileSize: driveFile.size || 0,
          contentType: driveFile.type,
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
