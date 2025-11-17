import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import mime from 'mime';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  UpsertDriveFileRequest,
  DeleteDriveFileRequest,
  User,
  ListDriveFilesData,
  ListOrder,
  BatchCreateDriveFilesRequest,
  DriveFile,
} from '@refly/openapi-schema';
import { Prisma, DriveFile as DriveFileModel } from '../../generated/client';
import { genDriveFileID, getFileCategory } from '@refly/utils';
import { ParamsError, DriveFileNotFoundError } from '@refly/errors';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer } from '../../utils';
import { driveFilePO2DTO } from './drive.dto';

interface FileProcessedResult {
  contentType: string;
  size: bigint;
}

@Injectable()
export class DriveService {
  private logger = new Logger(DriveService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(OSS_INTERNAL) private internalOss: ObjectStorageService,
  ) {}

  private generateStorageKey(user: User, file: { canvasId: string; name: string }): string {
    const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');
    return `${prefix}/${user.uid}/${file.canvasId}/${file.name}`;
  }

  /**
   * Download file from URL and return buffer
   * @param url - The URL to download from
   * @returns Buffer containing the downloaded data
   */
  private async downloadFileFromUrl(url: string): Promise<Buffer> {
    if (!url) {
      throw new ParamsError('URL is required');
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Failed to download file from URL: ${url}`, error);
      throw new ParamsError(`Unable to download file from URL: ${url}`);
    }
  }

  /**
   * Process drive file content and store it in object storage
   * @param user - User information
   * @param canvasId - Canvas ID
   * @param filename - File name
   * @param input - File input data
   * @returns File processed result
   */
  private async processDriveFileContent(
    user: User,
    canvasId: string,
    filename: string,
    input: {
      content?: string;
      storageKey?: string;
      externalUrl?: string;
    },
  ): Promise<FileProcessedResult> {
    const { content, storageKey, externalUrl } = input;

    // Generate drive storage path
    const driveStorageKey = this.generateStorageKey(user, { canvasId, name: filename });

    let buffer: Buffer;
    let size: bigint;
    let contentType: string;

    if (content !== undefined) {
      // Case 1: Direct content upload
      buffer = Buffer.from(content, 'utf8');
      size = BigInt(buffer.length);
      contentType = 'text/plain';

      await this.internalOss.putObject(driveStorageKey, buffer);
    } else if (storageKey) {
      const staticFile = await this.prisma.staticFile.findFirst({
        select: { contentType: true },
        where: { storageKey },
      });
      // Case 2: Transfer from existing storage key
      const stream = await this.internalOss.getObject(storageKey);
      if (!stream) {
        throw new ParamsError(`Source file not found: ${storageKey}`);
      }

      buffer = await streamToBuffer(stream);
      size = BigInt(buffer.length);
      contentType = staticFile.contentType ?? 'application/octet-stream';

      await this.internalOss.putObject(driveStorageKey, buffer, {
        'Content-Type': contentType,
      });
    } else if (externalUrl) {
      // Case 3: Download from external URL
      buffer = await this.downloadFileFromUrl(externalUrl);
      size = BigInt(buffer.length);

      // Determine content type based on file extension or default to binary
      contentType = mime.getType(filename) ?? 'application/octet-stream';
      await this.internalOss.putObject(driveStorageKey, buffer, {
        'Content-Type': contentType,
      });
    } else {
      throw new ParamsError('Either content, storageKey, or externalUrl must be provided');
    }

    return { contentType, size };
  }

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

  async getDriveFileDetail(user: User, fileId: string): Promise<DriveFile> {
    const driveFile = await this.prisma.driveFile.findFirst({
      where: { fileId, uid: user.uid, deletedAt: null },
    });
    if (!driveFile) {
      throw new DriveFileNotFoundError(`Drive file not found: ${fileId}`);
    }

    let content = driveFile.summary;

    // If file type is text/plain, retrieve actual content from minio storage
    if (driveFile.type === 'text/plain') {
      try {
        // Generate drive storage path
        const driveStorageKey = this.generateStorageKey(user, driveFile);

        const readable = await this.internalOss.getObject(driveStorageKey);
        if (readable) {
          const buffer = await streamToBuffer(readable);
          content = buffer.toString('utf8');
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve text content for file ${fileId}:`, error);
        // Fall back to summary if content retrieval fails
        content = driveFile.summary;
      }
    }

    return {
      ...driveFilePO2DTO(driveFile),
      content,
    };
  }

  /**
   * Generates drive file URLs based on configured payload mode
   * @param user - The user requesting the URLs
   * @param files - Array of drive files to generate URLs for
   * @returns Array of URLs (either base64 data URLs or signed URLs depending on config)
   */
  async generateDriveFileUrls(user: User, files: DriveFile[]): Promise<string[]> {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    let fileMode = this.config.get('drive.payloadMode');
    if (fileMode === 'url' && !this.config.get('static.private.endpoint')) {
      this.logger.warn('Private static endpoint is not configured, fallback to base64 mode');
      fileMode = 'base64';
    }

    this.logger.log(`Generating drive file URLs in ${fileMode} mode for ${files.length} files`);

    try {
      if (fileMode === 'base64') {
        const urls = await Promise.all(
          files.map(async (file) => {
            const driveStorageKey = this.generateStorageKey(user, file);

            try {
              const data = await this.internalOss.getObject(driveStorageKey);
              const chunks: Buffer[] = [];

              for await (const chunk of data) {
                chunks.push(chunk);
              }

              const buffer = Buffer.concat(chunks);
              const base64 = buffer.toString('base64');
              const contentType = file.type ?? 'application/octet-stream';

              return `data:${contentType};base64,${base64}`;
            } catch (error) {
              this.logger.error(
                `Failed to generate base64 for drive file ${file.fileId}: ${error.stack}`,
              );
              return '';
            }
          }),
        );
        return urls.filter(Boolean);
      }

      // URL mode - generate signed URLs for private drive files
      return await Promise.all(
        files.map(async (file) => {
          const driveStorageKey = this.generateStorageKey(user, file);

          try {
            const expiry = Number(this.config.get<number>('drive.presignExpiry') ?? 300);
            const signedUrl = await this.internalOss.presignedGetObject(driveStorageKey, expiry);
            return signedUrl;
          } catch (error) {
            this.logger.error(
              `Failed to generate signed URL for drive file ${file.fileId}: ${error.stack}`,
            );
            return '';
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error generating drive file URLs:', error);
      return [];
    }
  }

  /**
   * Batch create drive files
   */
  async batchCreateDriveFiles(
    user: User,
    request: BatchCreateDriveFilesRequest,
  ): Promise<DriveFileModel[]> {
    const { files } = request;

    if (!files?.length) {
      return [];
    }

    // Process each file to prepare data for bulk creation
    const driveFilesData: Prisma.DriveFileCreateManyInput[] = [];

    // Process files sequentially to handle async operations
    for (const fileRequest of files) {
      const { canvasId, name, type, content, storageKey, externalUrl } = fileRequest;

      // Process file content and store in object storage
      let processedResult: FileProcessedResult | undefined;
      if (content !== undefined || storageKey || externalUrl) {
        processedResult = await this.processDriveFileContent(user, canvasId, name, {
          content,
          storageKey,
          externalUrl,
        });
      }

      // Generate fileId
      const fileId = genDriveFileID();

      const createData: Prisma.DriveFileCreateManyInput = {
        fileId,
        uid: user.uid,
        canvasId,
        name,
        type,
        category: getFileCategory(processedResult?.contentType ?? 'text/plain'),
      };

      if (processedResult) {
        createData.size = processedResult.size;
        createData.type = processedResult.contentType;
      } else {
        createData.size = 0n;
      }

      driveFilesData.push(createData);
    }

    // Bulk create all drive files
    return this.prisma.driveFile.createManyAndReturn({
      data: driveFilesData,
    });
  }

  /**
   * Create or update a drive file
   */
  async upsertDriveFile(user: User, request: UpsertDriveFileRequest): Promise<DriveFileModel> {
    const {
      fileId,
      canvasId,
      name,
      type,
      content,
      storageKey,
      externalUrl,
      resultId,
      resultVersion,
    } = request;

    // Process file content and store in object storage
    let processedResult: FileProcessedResult | undefined;
    if (content !== undefined || storageKey || externalUrl) {
      processedResult = await this.processDriveFileContent(user, canvasId, name, {
        content,
        storageKey,
        externalUrl,
      });
    }

    // Generate summary (simplified - in real implementation this would use AI)
    const summary = content?.slice(0, 200);

    let driveFile: DriveFileModel;

    if (fileId) {
      // Update existing file
      const updateData: Prisma.DriveFileUpdateInput = {
        canvasId,
        name,
        type,
        summary,
        resultId,
        resultVersion,
      };

      if (processedResult) {
        updateData.size = processedResult.size;
        updateData.type = processedResult.contentType;
      }

      driveFile = await this.prisma.driveFile.update({
        where: { fileId, uid: user.uid },
        data: updateData,
      });
    } else {
      // Create new file
      const newFileId = genDriveFileID();
      const createData: Prisma.DriveFileCreateInput = {
        fileId: newFileId,
        uid: user.uid,
        canvasId,
        name,
        type,
        category: getFileCategory(processedResult?.contentType ?? 'text/plain'),
        summary,
        resultId,
        resultVersion,
      };

      if (processedResult) {
        createData.size = processedResult.size;
        createData.type = processedResult.contentType;
      }

      driveFile = await this.prisma.driveFile.create({
        data: createData,
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
   * Get drive file stream for serving file content
   */
  async getDriveFileStream(
    user: User,
    fileId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: { uid: true, canvasId: true, name: true, type: true },
      where: { fileId, uid: user.uid, deletedAt: null },
    });

    if (!driveFile) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    // Generate drive storage path
    const driveStorageKey = this.generateStorageKey(user, driveFile);

    const readable = await this.internalOss.getObject(driveStorageKey);
    if (!readable) {
      throw new NotFoundException(`File content not found: ${fileId}`);
    }

    const data = await streamToBuffer(readable);

    return {
      data,
      contentType: driveFile.type || 'application/octet-stream',
      filename: driveFile.name,
    };
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
