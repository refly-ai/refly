import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import mime from 'mime';
import pLimit from 'p-limit';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import {
  UpsertDriveFileRequest,
  DeleteDriveFileRequest,
  User,
  ListDriveFilesData,
  ListOrder,
  DriveFile,
  DriveFileCategory,
  DriveFileSource,
} from '@refly/openapi-schema';
import { Prisma, DriveFile as DriveFileModel } from '@prisma/client';
import { genDriveFileID, getFileCategory, pick } from '@refly/utils';
import { ParamsError, DriveFileNotFoundError } from '@refly/errors';
import { ObjectStorageService, OSS_INTERNAL, OSS_EXTERNAL } from '../common/object-storage';
import { streamToBuffer } from '../../utils';
import { driveFilePO2DTO } from './drive.dto';
import path from 'node:path';

export interface ExtendedUpsertDriveFileRequest extends UpsertDriveFileRequest {
  buffer?: Buffer;
}

interface ProcessedUpsertDriveFileResult extends ExtendedUpsertDriveFileRequest {
  driveStorageKey: string;
  category: DriveFileCategory;
  size: bigint;
}

type ListDriveFilesParams = ListDriveFilesData['query'] &
  Prisma.DriveFileWhereInput & {
    includeContent?: boolean;
  };

@Injectable()
export class DriveService {
  private logger = new Logger(DriveService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(OSS_INTERNAL) private internalOss: ObjectStorageService,
    @Inject(OSS_EXTERNAL) private externalOss: ObjectStorageService,
    private redis: RedisService,
  ) {}

  /**
   * Build S3 path for drive files (user uploaded files)
   * Used for user uploaded files and manual resources
   * @returns drive/{uid}/{canvasId}/{name}
   */
  buildS3DrivePath(uid: string, canvasId: string, name = ''): string {
    const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');
    return [prefix, uid, canvasId, name].filter(Boolean).join('/');
  }

  private generateStorageKey(
    user: User,
    file: { canvasId: string; name: string; scope?: string; source?: string },
  ): string {
    const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');

    if (file.scope === 'archive') {
      if (file.source === 'variable') {
        return `${prefix}/${user.uid}/${file.canvasId}-archive/${file.name}.archive.${Date.now()}`;
      } else if (file.source === 'agent') {
        return `${prefix}/${user.uid}/${file.canvasId}-archive/${file.name}.archive.${Date.now()}`;
      }
    }

    return `${prefix}/${user.uid}/${file.canvasId}/${file.name}`;
  }

  /**
   * Generate a unique filename by adding a random suffix if the name conflicts with existing files
   * @param baseName - Original filename
   * @param existingNames - Set of existing filenames
   * @returns Unique filename
   */
  private generateUniqueFileName(baseName: string, existingNames: Set<string>): string {
    if (!existingNames.has(baseName)) {
      return baseName;
    }

    // Extract name and extension
    const lastDotIndex = baseName.lastIndexOf('.');
    let nameWithoutExt: string;
    let extension: string;

    if (lastDotIndex > 0) {
      nameWithoutExt = baseName.substring(0, lastDotIndex);
      extension = baseName.substring(lastDotIndex); // includes the dot
    } else {
      nameWithoutExt = baseName;
      extension = '';
    }

    // Generate random suffix until we find a unique name
    let attempts = 0;
    while (attempts < 100) {
      // Prevent infinite loop
      const randomSuffix = Math.random().toString(36).substring(2, 7); // 5-character random string
      const newName = `${nameWithoutExt}-${randomSuffix}${extension}`;

      if (!existingNames.has(newName)) {
        return newName;
      }
      attempts++;
    }

    // Fallback: use timestamp if random generation fails
    const timestamp = Date.now();
    return `${nameWithoutExt}-${timestamp}${extension}`;
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

  async archiveFiles(
    user: User,
    canvasId: string,
    conditions: {
      source?: DriveFileSource;
      variableId?: string;
      resultId?: string;
    },
  ): Promise<void> {
    this.logger.log(
      `Archiving files - uid: ${user.uid}, canvasId: ${canvasId}, conditions: ${JSON.stringify(conditions)}`,
    );

    const files = await this.prisma.driveFile.findMany({
      select: { canvasId: true, fileId: true, name: true, storageKey: true },
      where: { canvasId, scope: 'present', uid: user.uid, ...conditions },
    });

    if (!files.length) {
      this.logger.log(
        `No files found to archive - uid: ${user.uid}, canvasId: ${canvasId}, conditions: ${JSON.stringify(conditions)}`,
      );
      return;
    }

    this.logger.log(
      `Found ${files.length} files to archive: ${files.map((f) => f.name).join(', ')}`,
    );

    // Get concurrency limit from config or use default
    const concurrencyLimit = this.config.get<number>('drive.archiveConcurrencyLimit') ?? 10;

    this.logger.log(
      `Starting concurrent archiving of ${files.length} files with concurrency limit: ${concurrencyLimit}`,
    );

    // Create a limit function to control concurrency
    const limit = pLimit(concurrencyLimit);

    // Process all files concurrently with limited concurrency
    const archivePromises = files.map((file) =>
      limit(async () => {
        try {
          const originalStorageKey = file.storageKey ?? this.generateStorageKey(user, file);
          const archiveStorageKey = this.generateStorageKey(user, {
            canvasId,
            name: file.name,
            scope: 'archive',
            source: conditions.source === 'variable' ? 'variable' : 'agent',
          });

          // Update database record
          await this.prisma.driveFile.update({
            where: { fileId: file.fileId },
            data: {
              scope: 'archive',
              storageKey: archiveStorageKey,
            },
          });

          // Move object in storage
          await this.internalOss.moveObject(originalStorageKey, archiveStorageKey);

          this.logger.debug(`Successfully archived file ${file.fileId} to ${archiveStorageKey}`);
          return { success: true, fileId: file.fileId };
        } catch (error) {
          this.logger.error(`Failed to archive file ${file.fileId}: ${error}`);
          return { success: false, fileId: file.fileId, error: error.message };
        }
      }),
    );

    // Wait for all files to complete
    const results = await Promise.allSettled(archivePromises);

    // Count successful and failed operations
    const totalProcessed = results.filter(
      (result) => result.status === 'fulfilled' && result.value.success,
    ).length;
    const totalErrors = results.filter(
      (result) =>
        result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success),
    ).length;

    this.logger.log(
      `Archive operation completed: ${totalProcessed} files archived, ${totalErrors} errors`,
    );
  }

  /**
   * Process drive file content and store it in object storage
   * @param user - User information
   * @param requests - Array of drive file requests to process
   * @returns Array of file processed results
   */
  private async batchProcessDriveFileRequests(
    user: User,
    canvasId: string,
    requests: ExtendedUpsertDriveFileRequest[],
    options?: {
      archiveFiles?: boolean;
    },
  ): Promise<ProcessedUpsertDriveFileResult[]> {
    // Acquire lock to prevent concurrent file processing for the same canvas
    const lockKey = `drive:canvas:${canvasId}`;
    const releaseLock = await this.redis.waitLock(lockKey);

    try {
      const presentFiles = await this.prisma.driveFile.findMany({
        select: { name: true },
        where: { canvasId, scope: 'present', deletedAt: null },
      });

      // Create a set of existing filenames for quick lookup
      const existingFileNames = new Set(presentFiles.map((file) => file.name));

      const results: ProcessedUpsertDriveFileResult[] = [];

      // Process each request in the batch
      for (const request of requests) {
        const { canvasId, name, content, storageKey, externalUrl, buffer } = request;

        // Generate unique filename to avoid conflicts
        const uniqueName = this.generateUniqueFileName(name, existingFileNames);
        existingFileNames.add(uniqueName); // Add to set to prevent future conflicts in this batch

        // Skip requests that don't have content to process
        if (content === undefined && !storageKey && !externalUrl) {
          continue;
        }

        let source = request.source;
        if (request.variableId) {
          source = 'variable';
        } else if (request.resultId) {
          source = 'agent';
        }

        // Generate drive storage path
        const driveStorageKey = this.generateStorageKey(user, {
          canvasId,
          name: uniqueName,
          source,
          scope: 'present',
        });

        let rawData: Buffer;
        let size: bigint;

        if (buffer) {
          // Case 0: Buffer upload
          rawData = buffer;
          size = BigInt(rawData.length);
        } else if (content !== undefined) {
          // Case 1: Direct content upload
          rawData = Buffer.from(content, 'utf8');
          size = BigInt(rawData.length);
          request.type = 'text/plain';
        } else if (storageKey) {
          // Case 2: Transfer from existing storage key
          let objectInfo = await this.internalOss.statObject(storageKey);
          if (!objectInfo) {
            throw new ParamsError(`Source file not found: ${storageKey}`);
          }

          if (storageKey !== driveStorageKey) {
            objectInfo = await this.internalOss.duplicateFile(storageKey, driveStorageKey);
          }

          size = BigInt(objectInfo?.size ?? 0);
          request.type =
            objectInfo?.metaData?.['Content-Type'] ??
            mime.getType(name) ??
            'application/octet-stream';
        } else if (externalUrl) {
          // Case 3: Download from external URL
          rawData = await this.downloadFileFromUrl(externalUrl);
          size = BigInt(rawData.length);

          // Determine content type based on file extension or default to binary
          request.type = mime.getType(name) ?? 'application/octet-stream';
        }

        if (options?.archiveFiles) {
          if (request.variableId) {
            await this.archiveFiles(user, canvasId, {
              source: 'variable',
              variableId: request.variableId,
            });
          } else if (request.resultId) {
            await this.archiveFiles(user, canvasId, {
              source: 'agent',
              resultId: request.resultId,
            });
          }
        }

        if (rawData) {
          await this.internalOss.putObject(driveStorageKey, rawData, {
            'Content-Type': request.type,
          });
        }

        results.push({
          ...request,
          name: uniqueName,
          driveStorageKey,
          size,
          source,
          category: getFileCategory(request.type),
        });
      }

      return results;
    } finally {
      // Always release the lock
      await releaseLock();
    }
  }

  /**
   * List drive files with pagination and filtering
   */
  async listDriveFiles(user: User, params: ListDriveFilesParams): Promise<DriveFile[]> {
    const { order, page, pageSize, includeContent } = params;

    const where: Prisma.DriveFileWhereInput = {
      uid: user.uid,
      deletedAt: null,
      ...pick(params, ['canvasId', 'source', 'scope', 'resultId', 'resultVersion', 'variableId']),
    };

    const driveFiles = await this.prisma.driveFile.findMany({
      where,
      orderBy: this.buildOrderBy(order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    if (includeContent) {
      return Promise.all(
        driveFiles.map((file) => this.getDriveFileDetail(user, file.fileId, file)),
      );
    }
    return driveFiles.map(driveFilePO2DTO);
  }

  async getDriveFileDetail(user: User, fileId: string, file?: DriveFileModel): Promise<DriveFile> {
    const driveFile =
      file ??
      (await this.prisma.driveFile.findFirst({
        where: { fileId, uid: user.uid, deletedAt: null },
      }));
    if (!driveFile) {
      throw new DriveFileNotFoundError(`Drive file not found: ${fileId}`);
    }

    let content = driveFile.summary;

    // If file type is text/plain, retrieve actual content from minio storage
    if (driveFile.type === 'text/plain') {
      try {
        const driveStorageKey = driveFile.storageKey ?? this.generateStorageKey(user, driveFile);
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
    request: {
      canvasId: string;
      files: ExtendedUpsertDriveFileRequest[];
    },
  ): Promise<DriveFile[]> {
    const { canvasId, files } = request;

    if (!files?.length) {
      this.logger.log('[DriveService] batchCreateDriveFiles: No files to create');
      return [];
    }

    const processedRequests = await this.batchProcessDriveFileRequests(user, canvasId, files, {
      archiveFiles: true,
    });

    // Process each file to prepare data for bulk creation
    const driveFilesData: Prisma.DriveFileCreateManyInput[] = processedRequests.map((req) => {
      return {
        ...pick(req, ['canvasId', 'name', 'source', 'size', 'resultId', 'resultVersion']),
        fileId: genDriveFileID(),
        uid: user.uid,
        scope: 'present',
        category: req.category,
        type: req.type,
        storageKey: req.driveStorageKey,
      };
    });

    this.logger.log(
      `[DriveService] batchCreateDriveFiles: Inserting ${driveFilesData.length} records to database`,
    );
    if (driveFilesData.length > 0) {
      const sample = driveFilesData[0];
      this.logger.log(
        `[DriveService] batchCreateDriveFiles: Sample record - name: ${sample.name}, resultId: ${sample.resultId || 'N/A'}, resultVersion: ${sample.resultVersion || 'N/A'}, size: ${sample.size}`,
      );
    }

    // Bulk create all drive files
    const createdFiles = await this.prisma.driveFile.createManyAndReturn({
      data: driveFilesData,
    });
    return createdFiles.map(driveFilePO2DTO);
  }

  /**
   * Create a new drive file
   */
  async createDriveFile(user: User, request: ExtendedUpsertDriveFileRequest): Promise<DriveFile> {
    const { canvasId } = request;
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for create operation');
    }

    const processedResults = await this.batchProcessDriveFileRequests(user, canvasId, [request], {
      archiveFiles: true,
    });
    const processedReq = processedResults[0];

    if (!processedReq) {
      throw new ParamsError('No file content to process');
    }

    const newFileId = genDriveFileID();
    const createData: Prisma.DriveFileCreateInput = {
      fileId: newFileId,
      uid: user.uid,
      ...pick(processedReq, [
        'canvasId',
        'name',
        'size',
        'source',
        'summary',
        'resultId',
        'resultVersion',
      ]),
      scope: 'present',
      category: processedReq.category,
      type: processedReq.type,
      storageKey: processedReq.driveStorageKey,
    };

    const createdFile = await this.prisma.driveFile.create({
      data: createData,
    });
    return driveFilePO2DTO(createdFile);
  }

  /**
   * Update an existing drive file
   */
  async updateDriveFile(user: User, request: ExtendedUpsertDriveFileRequest): Promise<DriveFile> {
    const { canvasId, fileId } = request;
    if (!canvasId || !fileId) {
      throw new ParamsError('Canvas ID and file ID are required for update operation');
    }

    const processedResults = await this.batchProcessDriveFileRequests(user, canvasId, [request]);
    const processedReq = processedResults[0];

    const updateData: Prisma.DriveFileUpdateInput = {
      ...pick(request, [
        'name',
        'type',
        'summary',
        'variableId',
        'resultId',
        'resultVersion',
        'source',
      ]),
      ...(processedReq
        ? {
            ...pick(processedReq, ['type', 'size', 'category']),
            storageKey: processedReq.driveStorageKey,
          }
        : {}),
    };

    const updatedFile = await this.prisma.driveFile.update({
      where: { fileId, uid: user.uid },
      data: updateData,
    });
    return driveFilePO2DTO(updatedFile);
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

    // Soft delete the file in database
    await this.prisma.driveFile.update({
      where: { fileId },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.internalOss.removeObject(driveFile.storageKey, true);
  }

  /**
   * Duplicate a drive file to a new canvas
   */
  async duplicateDriveFile(
    user: User,
    sourceFile: DriveFile & { storageKey?: string | null },
    newCanvasId: string,
    newFileId?: string,
  ): Promise<DriveFile> {
    const fileId = newFileId ?? genDriveFileID();

    const newStorageKey = this.generateStorageKey(user, {
      ...sourceFile,
      canvasId: newCanvasId,
    });

    if (this.internalOss.statObject(sourceFile.storageKey)) {
      this.internalOss.duplicateFile(sourceFile.storageKey, newStorageKey);
    } else if (this.externalOss.statObject(sourceFile.storageKey)) {
      const stream = await this.externalOss.getObject(sourceFile.storageKey);
      this.internalOss.putObject(newStorageKey, stream);
    } else {
      throw new Error(
        `Failed to copy file ${sourceFile.fileId} to ${newStorageKey}: source file not found`,
      );
    }

    // Create new drive file record with same metadata but new IDs
    // Note: publicURL is NOT copied - the new file will only have storageKey
    const duplicatedFile = await this.prisma.driveFile.create({
      data: {
        fileId: fileId,
        uid: user.uid,
        canvasId: newCanvasId,
        name: sourceFile.name,
        type: sourceFile.type,
        category: sourceFile.category,
        size: BigInt(sourceFile.size || 0),
        source: sourceFile.source,
        scope: sourceFile.scope,
        storageKey: newStorageKey,
        summary: sourceFile.summary ?? null,
        variableId: sourceFile.variableId ?? null,
        resultId: sourceFile.resultId ?? null,
        resultVersion: sourceFile.resultVersion ?? null,
      },
    });

    this.logger.log(
      `Duplicated drive file record from ${sourceFile.fileId} to ${fileId} for canvas ${newCanvasId}`,
    );

    return driveFilePO2DTO(duplicatedFile);
  }

  /**
   * Get drive file stream for serving file content
   * Supports both user-owned files and shared files
   */
  async getDriveFileStream(
    user: User,
    fileId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // First try to find the file owned by the current user
    let driveFile = await this.prisma.driveFile.findFirst({
      select: { uid: true, canvasId: true, name: true, type: true, storageKey: true },
      where: { fileId, uid: user.uid, deletedAt: null },
    });

    // If not found, check if it's a shared file
    if (!driveFile) {
      driveFile = await this.prisma.driveFile.findFirst({
        select: { uid: true, canvasId: true, name: true, type: true, storageKey: true },
        where: { fileId, deletedAt: null },
      });

      // Verify the share exists and is not deleted
      const shareRecord = await this.prisma.shareRecord.findFirst({
        where: { shareId: driveFile.canvasId, deletedAt: null },
      });

      if (!shareRecord) {
        throw new NotFoundException(`Shared file not found: ${fileId}`);
      }

      this.logger.log(
        `Serving shared file ${fileId} from share ${driveFile.canvasId} to user ${user.uid}`,
      );
    }

    // Generate drive storage path
    const driveStorageKey = driveFile.storageKey ?? this.generateStorageKey(user, driveFile);

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
   * Publish a drive file to public OSS for sharing
   * Copies the file from internal OSS to external OSS and returns the public URL
   * Creates a new storage key for the public file to avoid conflicts with internal file deletion
   */
  async publishDriveFile(storageKey: string, fileId: string): Promise<string> {
    if (!storageKey || !fileId) {
      return '';
    }

    if ((await this.externalOss.statObject(storageKey))?.size > 0) {
      // File already exists in external OSS
      return;
    }

    try {
      // Copy file from internal to external OSS
      const stream = await this.internalOss.getObject(storageKey);
      await this.externalOss.putObject(storageKey, stream);
    } catch (error) {
      this.logger.error(`Failed to publish drive file ${storageKey}: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Get public drive file content for serving via public endpoint
   * Used by the public file endpoint to serve shared files
   */
  async getPublicFileContent(fileId: string): Promise<{
    data: Buffer;
    contentType: string;
    filename: string;
  }> {
    try {
      const driveFile = await this.prisma.driveFile.findFirst({
        select: {
          type: true,
          storageKey: true,
        },
        where: { fileId },
      });

      const storageKey = driveFile.storageKey;

      // Get file from external OSS
      const readable = await this.externalOss.getObject(storageKey);
      const data = await streamToBuffer(readable);

      // Extract filename from storageKey
      const filename = path.basename(storageKey) || 'file';

      // Try to get contentType from file extension
      const contentType = mime.getType(filename) || 'application/octet-stream';

      return {
        data,
        contentType,
        filename,
      };
    } catch (error) {
      if (
        error?.code === 'NoSuchKey' ||
        error?.message?.includes('The specified key does not exist')
      ) {
        throw new NotFoundException(`Public file with id ${fileId} not found`);
      }
      throw error;
    }
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
