import { Inject, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import mime from 'mime';
import pLimit from 'p-limit';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import { Trace, getCurrentSpan, getTracer } from '@refly/observability';
import { SpanStatusCode } from '@opentelemetry/api';
import { LambdaService } from '../lambda/lambda.service';
import { LambdaJobRecord } from '../lambda/lambda.dto';
import {
  UpsertDriveFileRequest,
  DeleteDriveFileRequest,
  User,
  ListDriveFilesData,
  ListOrder,
  DriveFile,
  DriveFileCategory,
  DriveFileSource,
  StartExportJobRequest,
  ExportJob,
  ExportJobStatus,
} from '@refly/openapi-schema';
import { Prisma, DriveFile as DriveFileModel } from '@prisma/client';
import {
  genDriveFileID,
  getFileCategory,
  getSafeMimeType,
  isPlainTextMimeType,
  pick,
} from '@refly/utils';
import { truncateContent } from '@refly/utils/token';
import {
  ParamsError,
  DriveFileNotFoundError,
  DocumentNotFoundError,
  FileTooLargeError,
  PresignNotSupportedError,
  InvalidContentTypeError,
  UploadSizeMismatchError,
  UploadExpiredError,
} from '@refly/errors';
import { ObjectStorageService, OSS_INTERNAL, OSS_EXTERNAL } from '../common/object-storage';
import type { ObjectInfo } from '../common/object-storage/backend/interface';
import { streamToBuffer } from '../../utils';
import { driveFilePO2DTO } from './drive.dto';
import { isEmbeddableLinkFile } from './drive.utils';
import {
  PRESIGNED_UPLOAD_EXPIRY,
  PENDING_UPLOAD_REDIS_TTL,
  PENDING_UPLOAD_CLEANUP_AGE,
  MAX_CLI_UPLOAD_SIZE,
  PENDING_UPLOAD_REDIS_PREFIX,
  isContentTypeAllowed,
} from './drive.constants';
import path from 'node:path';
import { ProviderService } from '../provider/provider.service';
import { ParserFactory } from '../knowledge/parsers/factory';
import { SubscriptionService } from '../subscription/subscription.service';
import { readingTime } from 'reading-time-estimator';
import { MiscService } from '../misc/misc.service';

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
export class DriveService implements OnModuleInit {
  // Lazy-loaded to avoid circular dependency
  private subscriptionService: SubscriptionService;

  constructor(
    private readonly logger: PinoLogger,
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(OSS_INTERNAL) private internalOss: ObjectStorageService,
    @Inject(OSS_EXTERNAL) private externalOss: ObjectStorageService,
    private redis: RedisService,
    private providerService: ProviderService,
    private moduleRef: ModuleRef,
    private miscService: MiscService,
    @Optional() private lambdaService?: LambdaService,
  ) {
    this.logger.setContext(DriveService.name);
  }

  async onModuleInit() {
    // Use moduleRef.get with { strict: false } to resolve circular dependency at runtime
    this.subscriptionService = this.moduleRef.get(SubscriptionService, { strict: false });
  }

  /**
   * Build S3 path for drive files (user uploaded files)
   * Used for user uploaded files and manual resources
   * @returns drive/{uid}/{canvasId}/{name}
   */
  buildS3DrivePath(uid: string, canvasId: string, name = ''): string {
    const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');
    return [prefix, uid, canvasId, name].filter(Boolean).join('/');
  }

  /**
   * Get server origin from config
   */
  private get origin(): string | undefined {
    return this.config.get<string>('origin');
  }

  private get endpoint(): string | undefined {
    return this.config.get<string>('endpoint');
  }

  /**
   * Transform DriveFile Prisma model to DTO with URL
   */
  toDTO(driveFile: DriveFileModel): DriveFile {
    return driveFilePO2DTO(driveFile, this.endpoint);
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
      const newName = `${nameWithoutExt}-${Date.now()}-${randomSuffix}${extension}`;

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
   * Append UTF-8 charset declaration for text-based content types to avoid garbled characters.
   */
  private appendUtf8CharsetIfNeeded(contentType?: string | null): string | undefined {
    if (!contentType) {
      return undefined;
    }

    const normalized = contentType.toLowerCase();
    const isTextLike =
      normalized.startsWith('text/') || normalized.includes('json') || normalized.includes('xml');

    if (!isTextLike || normalized.includes('charset=')) {
      return contentType;
    }

    return `${contentType}; charset=utf-8`;
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
    this.logger.info(
      `Archiving files - uid: ${user.uid}, canvasId: ${canvasId}, conditions: ${JSON.stringify(conditions)}`,
    );

    const files = await this.prisma.driveFile.findMany({
      select: { canvasId: true, fileId: true, name: true, storageKey: true },
      where: { canvasId, scope: 'present', uid: user.uid, ...conditions },
    });

    if (!files.length) {
      this.logger.info(
        `No files found to archive - uid: ${user.uid}, canvasId: ${canvasId}, conditions: ${JSON.stringify(conditions)}`,
      );
      return;
    }

    this.logger.info(
      `Found ${files.length} files to archive: ${files.map((f) => f.name).join(', ')}`,
    );

    // Get concurrency limit from config or use default
    const concurrencyLimit = this.config.get<number>('drive.archiveConcurrencyLimit') ?? 10;

    this.logger.info(
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
          await this.externalOss.moveObject(originalStorageKey, archiveStorageKey);

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

    this.logger.info(
      `Archive operation completed: ${totalProcessed} files archived, ${totalErrors} errors`,
    );
  }

  /**
   * Delete files by condition (soft delete + remove from OSS)
   */
  async deleteFilesByCondition(
    user: User,
    canvasId: string,
    conditions: {
      source?: DriveFileSource;
      variableId?: string;
      resultId?: string;
    },
  ): Promise<void> {
    this.logger.info(
      `Deleting files - uid: ${user.uid}, canvasId: ${canvasId}, conditions: ${JSON.stringify(conditions)}`,
    );

    // First find all files to get their storage keys
    const files = await this.prisma.driveFile.findMany({
      select: { fileId: true, storageKey: true },
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
        ...conditions,
      },
    });

    if (files.length === 0) {
      this.logger.info(`No files found to delete for conditions: ${JSON.stringify(conditions)}`);
      return;
    }

    // Soft delete in database
    await this.prisma.driveFile.updateMany({
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
        ...conditions,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Remove files from OSS
    for (const file of files) {
      if (file.storageKey) {
        try {
          await this.internalOss.removeObject(file.storageKey, true);
        } catch (error) {
          this.logger.warn(`Failed to remove file ${file.fileId} from OSS: ${error?.message}`);
        }
      }
    }

    this.logger.info(`Deleted ${files.length} files for conditions: ${JSON.stringify(conditions)}`);
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
    // const lockKey = `drive:canvas:${canvasId}`;
    // const releaseLock = await this.redis.waitLock(lockKey);
    const presentFiles = await this.prisma.driveFile.findMany({
      select: { name: true },
      where: { canvasId, scope: 'present', deletedAt: null },
    });

    // Create a set of existing filenames for quick lookup
    const existingFileNames = new Set(presentFiles.map((file) => file.name));

    const results: ProcessedUpsertDriveFileResult[] = [];

    // Process each request in the batch
    for (const request of requests) {
      const { canvasId, name, content, storageKey, externalUrl, buffer, type } = request;

      // Generate unique filename to avoid conflicts
      const uniqueName = this.generateUniqueFileName(name, existingFileNames);
      existingFileNames.add(uniqueName); // Add to set to prevent future conflicts in this batch

      // Skip requests that don't have content to process
      if (content === undefined && !storageKey && !externalUrl && !buffer) {
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
        // Infer MIME type from filename, fallback to text/plain
        request.type =
          getSafeMimeType(name, mime.getType(name) ?? type ?? undefined) || 'text/plain';
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
          getSafeMimeType(name, mime.getType(name) ?? undefined);
      } else if (externalUrl) {
        // Case 3: Download from external URL
        rawData = await this.downloadFileFromUrl(externalUrl);
        size = BigInt(rawData.length);

        // Determine content type based on file extension or default to binary
        request.type = getSafeMimeType(name, mime.getType(name) ?? undefined);
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
        const headers: Record<string, string> = {};
        const formattedContentType = this.appendUtf8CharsetIfNeeded(request.type);
        if (formattedContentType) {
          headers['Content-Type'] = formattedContentType;
        }
        await this.internalOss.putObject(driveStorageKey, rawData, headers);
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
  }

  /**
   * List drive files with pagination and filtering
   */
  async listDriveFiles(user: User, params: ListDriveFilesParams): Promise<DriveFile[]> {
    const { order, page = 1, pageSize = 10, includeContent } = params;

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
        driveFiles.map((file) => this.getDriveFileDetail(user, file.fileId, { file })),
      );
    }
    return driveFiles.map((file) => this.toDTO(file));
  }

  /**
   * List all drive files without pagination (fetches all files page by page)
   */
  async listAllDriveFiles(
    user: User,
    params: Omit<ListDriveFilesParams, 'page' | 'pageSize'>,
  ): Promise<DriveFile[]> {
    const pageSize = 100; // Use larger page size for efficiency
    let page = 1;
    const allFiles: DriveFile[] = [];

    while (true) {
      const files = await this.listDriveFiles(user, {
        ...params,
        page,
        pageSize,
      });

      if (files.length === 0) {
        // No more files to fetch
        break;
      }

      allFiles.push(...files);

      if (files.length < pageSize) {
        // Last page reached
        break;
      }

      page++;
    }

    return allFiles;
  }

  @Trace('drive.getDriveFileDetail')
  async getDriveFileDetail(
    user: User,
    fileId: string,
    options?: { file?: DriveFileModel; includeContent?: boolean },
  ): Promise<DriveFile> {
    getCurrentSpan()?.setAttribute('file.id', fileId);

    const { file, includeContent = true } = options ?? {};
    const driveFile =
      file ??
      (await this.prisma.driveFile.findFirst({
        where: { fileId, uid: user.uid, deletedAt: null },
      }));
    if (!driveFile) {
      throw new DriveFileNotFoundError(`Drive file not found: ${fileId}`);
    }

    // Skip content loading if not needed (metadata only)
    if (!includeContent) {
      return this.toDTO(driveFile);
    }

    let content = driveFile.summary;

    // Case 1: Plain text files - read directly without parsing
    if (isPlainTextMimeType(driveFile.type)) {
      try {
        const driveStorageKey = driveFile.storageKey ?? this.generateStorageKey(user, driveFile);
        const readable = await this.internalOss.getObject(driveStorageKey);
        if (readable) {
          const buffer = await streamToBuffer(readable);
          content = buffer.toString('utf8');
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve text content for file ${fileId}:`, error);
        content = driveFile.summary;
      }

      // Apply token-based truncation (head/tail preservation)
      const maxTokens = this.config.get<number>('drive.maxContentTokens') || 50000;
      const truncateStart = performance.now();
      const truncatedContent = truncateContent(content, maxTokens);
      this.logger.info(
        `[getDriveFileDetail] truncateContent: fileId=${fileId}, len=${content.length}, time=${(performance.now() - truncateStart).toFixed(2)}ms`,
      );

      return {
        ...this.toDTO(driveFile),
        content: truncatedContent,
      };
    }

    // Case 2: Other types (PDF, images, etc.) - check cache or parse
    return await this.loadOrParseDriveFile(user, driveFile);
  }

  /**
   * Normalize whitespace in content by compressing repeated spaces/tabs and excessive line breaks
   * @param content - Original content
   * @returns Content with normalized whitespace
   */
  private normalizeWhitespace(content: string): string {
    return (
      content
        // Compress multiple spaces/tabs to single space
        .replace(/[ \t]+/g, ' ')
        // Compress more than 2 consecutive line breaks to 2 line breaks
        .replace(/\n{3,}/g, '\n\n')
        // Normalize excessive horizontal rules (4+ dashes/underscores/equals) to standard markdown hr
        .replace(/^[ \t]*[-_=]{4,}[ \t]*$/gm, '---')
        // Deduplicate consecutive horizontal rules (--- followed by newlines and ---)
        .replace(/(^---\n)+---$/gm, '---')
        // Trim whitespace at start and end of each line
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Deduplicate consecutive horizontal rules after trimming
        .replace(/(\n---)+\n---/g, '\n---')
        // Trim overall content
        .trim()
    );
  }

  /**
   * Check if content type is supported for Lambda parsing
   */
  private isLambdaParsableContentType(contentType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/epub+zip',
      'text/html',
    ];
    return supportedTypes.includes(contentType);
  }

  /**
   * Parse file content via Lambda service
   */
  @Trace('drive.parseViaLambda')
  private async parseViaLambda(
    user: User,
    driveFile: DriveFileModel,
    storageKey: string,
  ): Promise<DriveFile> {
    const { fileId, type: contentType } = driveFile;
    const tracer = getTracer();

    // S3 input bucket (where source files are stored)
    const inputBucket = this.config.get<string>('lambda.s3.inputBucket');

    // Output bucket for Lambda results
    const outputBucket = this.config.get<string>('lambda.s3.bucket');

    // Dispatch to Lambda
    const lambdaJob = await this.lambdaService!.dispatchDocumentIngest({
      uid: user.uid,
      fileId,
      s3Input: {
        bucket: inputBucket,
        key: storageKey,
      },
      outputBucket,
      contentType,
      name: driveFile.name,
      options: {
        extractImages: false,
        outputFormat: 'markdown',
      },
    });

    // Mark cache as processing
    await this.prisma.driveFileParseCache.upsert({
      where: { fileId },
      create: {
        fileId,
        uid: user.uid,
        contentStorageKey: '',
        contentType,
        parser: 'lambda',
        parseStatus: 'processing',
        metadata: JSON.stringify({ lambdaJobId: lambdaJob.jobId }),
      },
      update: {
        parser: 'lambda',
        parseStatus: 'processing',
        parseError: null,
        metadata: JSON.stringify({ lambdaJobId: lambdaJob.jobId }),
        updatedAt: new Date(),
      },
    });

    // Poll for result with timeout
    const pollIntervalMs = this.config.get<number>('lambda.resultPolling.intervalMs') || 1000;
    const maxRetries = this.config.get<number>('lambda.resultPolling.maxRetries') || 300;

    let retries = 0;
    while (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      retries++;

      const { job, effectiveStatus } = await this.lambdaService!.getJobStatus(lambdaJob.jobId);

      if (effectiveStatus === 'FAILED') {
        const errorMsg = job?.error || 'Lambda processing failed';
        this.logger.error(`Lambda job ${lambdaJob.jobId} failed: ${errorMsg}`);

        await this.prisma.driveFileParseCache.update({
          where: { fileId },
          data: {
            parseStatus: 'failed',
            parseError: JSON.stringify({ message: errorMsg, lambdaJobId: lambdaJob.jobId }),
            updatedAt: new Date(),
          },
        });

        // Lambda failed - guide to use sandbox
        throw new FileTooLargeError(
          'File parsing failed. Use execute_code tool to process this file.',
        );
      }

      if (effectiveStatus === 'COMPLETED' || effectiveStatus === 'PENDING_PERSIST') {
        // Job completed, fetch the result
        if (job?.storageKey) {
          return tracer.startActiveSpan('drive.loadLambdaResult', async (span) => {
            try {
              // Use LambdaService to read from AWS S3 where Lambda writes output
              // (internalOss points to local MinIO, not AWS S3)
              let content = await this.lambdaService!.getJobOutputAsString(job.storageKey!);
              if (!content) {
                throw new Error(`Failed to read Lambda output from S3: ${job.storageKey}`);
              }

              // Process content - remove null characters
              content = content.replace(/\0/g, '');
              content = this.normalizeWhitespace(content);

              const maxTokens = this.config.get<number>('drive.maxContentTokens') || 50000;
              const truncatedContent = truncateContent(content, maxTokens);

              // Check if content was truncated
              const isTruncated = truncatedContent.includes('[... truncated ...]');

              // Save to cache
              const contentStorageKey = `drive-parsed/${user.uid}/${fileId}.txt`;
              await this.internalOss.putObject(contentStorageKey, truncatedContent);

              const jobMetadata = job.metadata ? JSON.parse(job.metadata) : {};
              const wordCount = jobMetadata.wordCount || readingTime(truncatedContent).words;

              // Store truncation status in metadata
              const cacheMetadata = {
                lambdaJobId: lambdaJob.jobId,
                truncated: isTruncated,
              };

              await this.prisma.driveFileParseCache.update({
                where: { fileId },
                data: {
                  contentStorageKey,
                  parser: 'lambda',
                  numPages: jobMetadata.pageCount || null,
                  wordCount,
                  parseStatus: 'success',
                  parseError: null,
                  metadata: JSON.stringify(cacheMetadata),
                  updatedAt: new Date(),
                },
              });

              span.setAttributes({
                'lambda.jobId': lambdaJob.jobId,
                'content.length': truncatedContent.length,
              });
              span.end();

              return { ...this.toDTO(driveFile), content: truncatedContent };
            } catch (error) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
              span.end();
              throw error;
            }
          });
        }
      }

      // Still processing, continue polling
    }

    // Timeout reached
    this.logger.error(`Lambda job ${lambdaJob.jobId} timed out after ${maxRetries} retries`);
    await this.prisma.driveFileParseCache.update({
      where: { fileId },
      data: {
        parseStatus: 'failed',
        parseError: JSON.stringify({
          message: 'Lambda processing timeout',
          lambdaJobId: lambdaJob.jobId,
        }),
        updatedAt: new Date(),
      },
    });

    // Lambda timeout - guide to use sandbox
    throw new FileTooLargeError(
      'File parsing timeout. Use execute_code tool to process this file.',
    );
  }

  /**
   * Parse file content locally (original parsing logic)
   */
  @Trace('drive.parseLocally')
  private async parseLocally(
    user: User,
    driveFile: DriveFileModel,
    storageKey: string,
  ): Promise<DriveFile> {
    const { fileId, type: contentType } = driveFile;
    const tracer = getTracer();

    try {
      // Load file from storage
      const fileBuffer = await tracer.startActiveSpan('drive.loadFromOSS', async (span) => {
        const fileStream = await this.internalOss.getObject(storageKey);
        const buffer = await streamToBuffer(fileStream);
        span.setAttribute('file.size', buffer.length);
        span.end();
        return buffer;
      });

      // Check PDF page count
      let numPages: number | undefined = undefined;
      if (contentType === 'application/pdf') {
        const pdfInfo = await pdf(fileBuffer);
        numPages = pdfInfo.numpages;
        getCurrentSpan()?.setAttribute('pdf.pages', numPages);

        const { available, pageUsed, pageLimit } =
          await this.subscriptionService.checkFileParseUsage(user);

        if (numPages > available) {
          await this.prisma.driveFileParseCache.upsert({
            where: { fileId },
            create: {
              fileId,
              uid: user.uid,
              contentStorageKey: '',
              contentType,
              parser: '',
              numPages,
              parseStatus: 'failed',
              parseError: JSON.stringify({
                type: 'pageLimitExceeded',
                metadata: { numPages, pageLimit, pageUsed },
              }),
            },
            update: {
              parseStatus: 'failed',
              parseError: JSON.stringify({
                type: 'pageLimitExceeded',
                metadata: { numPages, pageLimit, pageUsed },
              }),
              updatedAt: new Date(),
            },
          });
          throw new Error(`Page limit exceeded: ${numPages} pages, available: ${available}`);
        }
      }

      // Create parser
      const parser = await tracer.startActiveSpan('drive.createParser', async (span) => {
        const parserFactory = new ParserFactory(this.config, this.providerService);
        const p = await parserFactory.createDocumentParser(user, contentType, {
          resourceId: fileId,
        });
        span.setAttribute('parser.name', p.name);
        span.end();
        return p;
      });

      // Perform parsing - key performance point
      const result = await tracer.startActiveSpan(`drive.parse.${parser.name}`, async (span) => {
        span.setAttributes({ 'parser.name': parser.name, 'file.size': fileBuffer.length });
        const r = await parser.parse(fileBuffer);
        if (r.error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: r.error });
          span.end();
          throw new Error(`Parse failed: ${r.error}`);
        }
        span.setAttribute('content.length', r.content?.length || 0);
        span.end();
        return r;
      });

      let processedContent = result.content?.replace(/\0/g, '') || '';

      // Normalize whitespace
      processedContent = this.normalizeWhitespace(processedContent);

      const maxTokens = this.config.get<number>('drive.maxContentTokens') || 50000;
      const truncateStart = performance.now();
      const truncatedContent = truncateContent(processedContent, maxTokens);
      this.logger.info(
        `[parseLocally] truncateContent after parse: fileId=${fileId}, len=${processedContent.length}, time=${(performance.now() - truncateStart).toFixed(2)}ms`,
      );

      // Check if content was truncated - throw error to guide sandbox usage
      const isTruncated = truncatedContent.includes('[... truncated ...]');
      if (isTruncated) {
        this.logger.info(
          `Drive file ${fileId} content was truncated (${processedContent.length} chars), guiding to use sandbox`,
        );
        throw new FileTooLargeError(
          'File content is too large for direct reading. Use execute_code tool to process this file.',
        );
      }

      const contentStorageKey = `drive-parsed/${user.uid}/${fileId}.txt`;
      await tracer.startActiveSpan('drive.saveToCache', async (span) => {
        await this.internalOss.putObject(contentStorageKey, truncatedContent);
        span.setAttribute('content.length', truncatedContent.length);
        span.end();
      });

      const wordCount = readingTime(truncatedContent).words;

      // Save cache record
      await this.prisma.driveFileParseCache.upsert({
        where: { fileId },
        create: {
          fileId,
          uid: user.uid,
          contentStorageKey,
          contentType,
          parser: parser.name,
          numPages: numPages ?? null,
          wordCount,
          parseStatus: 'success',
          metadata: JSON.stringify({ truncated: false }),
        },
        update: {
          contentStorageKey,
          parser: parser.name,
          numPages: numPages ?? null,
          wordCount,
          parseStatus: 'success',
          parseError: null,
          metadata: JSON.stringify({ truncated: false }),
          updatedAt: new Date(),
        },
      });

      // If PDF, record page usage
      if (contentType === 'application/pdf' && numPages) {
        await this.prisma.fileParseRecord.create({
          data: {
            resourceId: fileId,
            uid: user.uid,
            parser: parser.name,
            contentType,
            numPages,
            storageKey: contentStorageKey,
          },
        });
      }

      return { ...this.toDTO(driveFile), content: truncatedContent };
    } catch (error) {
      this.logger.error(
        `Failed to parse drive file ${fileId}: ${JSON.stringify({ message: (error as Error).message })}`,
      );

      // Record failure status
      await this.prisma.driveFileParseCache.upsert({
        where: { fileId },
        create: {
          fileId,
          uid: user.uid,
          contentStorageKey: '',
          contentType,
          parser: '',
          parseStatus: 'failed',
          parseError: JSON.stringify({ message: (error as Error).message }),
        },
        update: {
          parseStatus: 'failed',
          parseError: JSON.stringify({ message: (error as Error).message }),
          updatedAt: new Date(),
        },
      });

      // Fallback to summary
      this.logger.info(`Returning fallback summary for ${fileId} due to parse failure`);
      return { ...this.toDTO(driveFile), content: driveFile.summary };
    }
  }

  /**
   * Load drive file content from cache or parse if not cached
   * Uses Lambda for parsing when enabled, falls back to local parsing otherwise
   */
  @Trace('drive.loadOrParseDriveFile')
  private async loadOrParseDriveFile(user: User, driveFile: DriveFileModel): Promise<DriveFile> {
    const { fileId, type: contentType } = driveFile;
    const tracer = getTracer();
    getCurrentSpan()?.setAttributes({ 'file.id': fileId, 'file.type': contentType });

    this.logger.info(`Loading or parsing drive file ${fileId}, contentType: ${contentType}`);

    // Step 1: Try to load from cache
    const cache = await this.prisma.driveFileParseCache.findUnique({
      where: { fileId },
    });

    if (cache?.parseStatus === 'success') {
      // Check if content was truncated during parsing - guide to use sandbox
      const cacheMetadata = cache.metadata ? JSON.parse(cache.metadata) : {};
      if (cacheMetadata.truncated === true) {
        this.logger.info(
          `Drive file ${fileId} was truncated during parsing, guiding to use sandbox`,
        );
        throw new FileTooLargeError(
          'File content was truncated due to size. Use execute_code tool to process this file for complete content.',
        );
      }

      return tracer
        .startActiveSpan('drive.loadFromCache', async (span) => {
          try {
            const stream = await this.internalOss.getObject(cache.contentStorageKey);
            let content = await streamToBuffer(stream).then((b) => b.toString('utf8'));

            const maxTokens = this.config.get<number>('drive.maxContentTokens') || 50000;
            const originalLen = content.length;
            const truncateStart = performance.now();
            content = truncateContent(content, maxTokens);
            this.logger.info(
              `[loadOrParseDriveFile] truncateContent from cache: fileId=${fileId}, len=${originalLen}, time=${(performance.now() - truncateStart).toFixed(2)}ms`,
            );

            span.setAttributes({ 'cache.hit': true, 'content.length': content.length });
            span.end();
            return { ...this.toDTO(driveFile), content };
          } catch (error) {
            this.logger.warn(`Cache read failed for ${fileId}, will re-parse:`, error);
            span.setAttributes({ 'cache.hit': false, 'cache.error': true });
            span.end();
            throw error; // Rethrow to continue to parse below
          }
        })
        .catch(() => null); // Return null to continue parsing if cache fails
    }

    // Check if cache is still processing (Lambda job in progress)
    if (cache?.parseStatus === 'processing') {
      // Check for timeout (default: 5 minutes)
      const timeoutMs = this.config.get<number>('lambda.parseTimeoutMs') || 5 * 60 * 1000;
      const elapsed = Date.now() - new Date(cache.updatedAt).getTime();

      if (elapsed < timeoutMs) {
        const metadata = cache.metadata ? JSON.parse(cache.metadata) : {};
        if (metadata.lambdaJobId && this.lambdaService) {
          const { effectiveStatus } = await this.lambdaService.getJobStatus(metadata.lambdaJobId);
          if (effectiveStatus === 'PROCESSING' || effectiveStatus === 'PENDING') {
            // Return summary while processing
            return { ...this.toDTO(driveFile), content: driveFile.summary || 'Processing...' };
          }
        }
      } else {
        // Timeout exceeded, mark as stale and allow re-parsing
        this.logger.warn({ fileId, elapsed, timeoutMs }, 'Lambda parsing timeout, will retry');
      }
    }

    // Get file storage key and stat
    const storageKey = driveFile.storageKey ?? this.generateStorageKey(user, driveFile);

    // Check file size limit before downloading - large files should use execute_code tool
    const maxFileSizeKB = this.config.get<number>('drive.maxParseFileSizeKB') || 512;
    const maxFileSizeBytes = maxFileSizeKB * 1024;

    let fileStat: ObjectInfo | undefined;
    try {
      fileStat = await this.internalOss.statObject(storageKey);
    } catch (error) {
      this.logger.error(`Failed to stat drive file ${fileId}: ${(error as Error)?.message}`);
      throw new DriveFileNotFoundError(`Drive file not found: ${fileId}`);
    }

    if (fileStat && fileStat.size > maxFileSizeBytes) {
      const fileSizeKB = Math.round(fileStat.size / 1024);
      this.logger.info(
        `Drive file ${fileId} exceeds size limit: ${fileSizeKB}KB > ${maxFileSizeKB}KB`,
      );
      throw new FileTooLargeError(
        'File exceeds size limit. Use execute_code tool to process this file.',
        fileSizeKB,
      );
    }

    // Step 2: No cache found, perform parsing
    getCurrentSpan()?.setAttribute('cache.hit', false);

    // Small files (≤5KB) can be parsed locally for faster response
    const smallFileSizeKB = this.config.get<number>('drive.smallFileSizeKB') || 5;
    const smallFileSizeBytes = smallFileSizeKB * 1024;

    if (fileStat && fileStat.size <= smallFileSizeBytes) {
      getCurrentSpan()?.setAttribute('parse.method', 'local-small');
      return this.parseLocally(user, driveFile, storageKey);
    }

    // Check if Lambda is enabled and service is available
    const lambdaEnabled = this.config.get<boolean>('lambda.enabled') !== false;
    const useLambda =
      lambdaEnabled && this.lambdaService && this.isLambdaParsableContentType(contentType);

    if (useLambda) {
      getCurrentSpan()?.setAttribute('parse.method', 'lambda');
      return this.parseViaLambda(user, driveFile, storageKey);
    }

    // Fallback to local parsing for unsupported Lambda content types
    getCurrentSpan()?.setAttribute('parse.method', 'local');
    return this.parseLocally(user, driveFile, storageKey);
  }

  /**
   * Generates drive file URLs based on configured payload mode
   * @param user - The user requesting the URLs
   * @param files - Array of drive files to generate URLs for
   * @returns Array of URLs (either base64 data URLs or signed URLs depending on config)
   */
  async generateDriveFileUrls(
    user: User,
    files: DriveFile[],
    modeOverride?: 'base64' | 'url',
  ): Promise<string[]> {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    const configuredMode = this.config.get<string>('drive.payloadMode');
    let fileMode = modeOverride ?? configuredMode ?? 'url';
    if (fileMode === 'url' && !this.config.get('static.private.endpoint')) {
      this.logger.warn('Private static endpoint is not configured, fallback to base64 mode');
      fileMode = 'base64';
    }

    this.logger.info(`Generating drive file URLs in ${fileMode} mode for ${files.length} files`);

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

              let buffer = Buffer.concat(chunks);

              // Compress image before converting to base64
              const maxArea = Number.parseInt(process.env.IMAGE_MAX_AREA) || 600 * 600;
              const metadata = await sharp(buffer).metadata();
              const originalWidth = metadata?.width ?? 0;
              const originalHeight = metadata?.height ?? 0;
              const isGif = metadata?.format === 'gif';

              // Calculate scaling factor based on max area
              const originalArea = originalWidth * originalHeight;
              const scaleFactor = originalArea > maxArea ? Math.sqrt(maxArea / originalArea) : 1;

              // Resize and convert format if needed
              if (scaleFactor < 1 || !isGif) {
                const processedBuffer = await sharp(buffer)
                  .resize({
                    width: Math.round(originalWidth * scaleFactor),
                    height: Math.round(originalHeight * scaleFactor),
                    fit: 'fill',
                  })
                  [isGif ? 'toFormat' : 'toFormat'](isGif ? 'gif' : 'webp')
                  .toBuffer();
                buffer = Buffer.from(processedBuffer);
              }

              const base64 = buffer.toString('base64');
              const contentType = isGif ? 'image/gif' : 'image/webp';

              return `data:${contentType};base64,${base64}`;
            } catch (error) {
              this.logger.error(
                `Failed to generate compressed base64 for drive file ${file.fileId}: ${error.stack}`,
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
            const expiry = Number(this.config.get<number>('drive.presignExpiry') ?? 3600);
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
      this.logger.info('[DriveService] batchCreateDriveFiles: No files to create');
      return [];
    }

    const processedRequests = await this.batchProcessDriveFileRequests(user, canvasId, files);

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

    this.logger.info(
      `[DriveService] batchCreateDriveFiles: Inserting ${driveFilesData.length} records to database`,
    );
    if (driveFilesData.length > 0) {
      const sample = driveFilesData[0];
      this.logger.info(
        `[DriveService] batchCreateDriveFiles: Sample record - name: ${sample.name}, resultId: ${sample.resultId || 'N/A'}, resultVersion: ${sample.resultVersion || 'N/A'}, size: ${sample.size}`,
      );
    }

    // Bulk create all drive files
    const createdFiles = await this.prisma.driveFile.createManyAndReturn({
      data: driveFilesData,
    });

    // Trigger async parsing for each file (fire-and-forget)
    for (let i = 0; i < createdFiles.length; i++) {
      const file = createdFiles[i];
      const req = processedRequests[i];
      this.triggerAsyncParse(user, {
        fileId: file.fileId,
        type: file.type,
        storageKey: req.driveStorageKey,
        name: file.name,
      }).catch(() => {});
    }

    return createdFiles.map((file) => this.toDTO(file));
  }

  /**
   * Create a new drive file
   */
  async createDriveFile(user: User, request: ExtendedUpsertDriveFileRequest): Promise<DriveFile> {
    const { canvasId, archiveFiles } = request;
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for create operation');
    }

    const processedResults = await this.batchProcessDriveFileRequests(user, canvasId, [request], {
      archiveFiles,
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
        'variableId',
      ]),
      scope: 'present',
      category: processedReq.category,
      type: processedReq.type,
      storageKey: processedReq.driveStorageKey,
    };

    const createdFile = await this.prisma.driveFile.create({
      data: createData,
    });

    // Trigger async parsing if supported (fire-and-forget)
    // Temporarily disabled - Lambda parsing not needed for file creation
    // this.triggerAsyncParse(user, {
    //   fileId: createdFile.fileId,
    //   type: createdFile.type,
    //   storageKey: processedReq.driveStorageKey,
    //   name: createdFile.name,
    // }).catch(() => {});

    return this.toDTO(createdFile);
  }

  /**
   * Upload a file and create a drive file record with compensating transaction.
   * If DB creation fails, the uploaded object is deleted from storage.
   * @param user - User performing the upload
   * @param file - Multer file object
   * @param canvasId - Canvas ID to associate the file with
   * @returns Created drive file DTO
   */
  async uploadAndCreateFile(
    user: User,
    file: Express.Multer.File,
    canvasId: string,
  ): Promise<DriveFile> {
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for upload');
    }

    // Validate canvas exists and user has access
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new DocumentNotFoundError(`Canvas not found: ${canvasId}`);
    }

    // Generate file ID and storage key
    const fileId = genDriveFileID();
    const storageKey = this.generateStorageKey(user, {
      canvasId,
      name: `${fileId}-${file.originalname}`,
    });

    // Determine content type
    const contentType =
      file.mimetype ||
      getSafeMimeType(file.originalname, mime.getType(file.originalname)) ||
      'application/octet-stream';

    // Upload to object storage
    const headers: Record<string, string> = {};
    const formattedContentType = this.appendUtf8CharsetIfNeeded(contentType);
    if (formattedContentType) {
      headers['Content-Type'] = formattedContentType;
    }
    await this.internalOss.putObject(storageKey, file.buffer, headers);

    // Create DB record with compensating delete on failure
    try {
      const createdFile = await this.prisma.driveFile.create({
        data: {
          fileId,
          uid: user.uid,
          canvasId,
          name: file.originalname,
          type: contentType,
          size: BigInt(file.size),
          storageKey,
          source: 'manual',
          scope: 'present',
          category: getFileCategory(contentType),
        },
      });

      return this.toDTO(createdFile);
    } catch (dbError) {
      // Compensating transaction: delete uploaded object
      this.logger.error(`DB create failed, cleaning up storageKey: ${storageKey}`, dbError);
      await this.internalOss.removeObject(storageKey).catch((cleanupErr) => {
        this.logger.error(`Failed to cleanup orphan file: ${storageKey}`, cleanupErr);
      });
      throw dbError;
    }
  }

  /**
   * Trigger async Lambda parsing for supported file types
   * Silently returns if type not supported or on error
   */
  private async triggerAsyncParse(
    user: User,
    driveFile: { fileId: string; type: string; storageKey: string; name: string },
  ): Promise<void> {
    // Check if Lambda is enabled and service is available
    const lambdaEnabled = this.config.get<boolean>('lambda.enabled') !== false;
    if (!lambdaEnabled || !this.lambdaService) {
      return;
    }

    // Check if content type is supported for Lambda parsing
    if (!this.isLambdaParsableContentType(driveFile.type)) {
      return;
    }

    try {
      const inputBucket = this.config.get<string>('lambda.s3.inputBucket');
      const outputBucket = this.config.get<string>('lambda.s3.bucket');

      const lambdaJob = await this.lambdaService.dispatchDocumentIngest({
        uid: user.uid,
        fileId: driveFile.fileId,
        s3Input: {
          bucket: inputBucket,
          key: driveFile.storageKey,
        },
        outputBucket,
        contentType: driveFile.type,
        name: driveFile.name,
      });

      // Create processing cache record to prevent duplicate parsing
      await this.prisma.driveFileParseCache.upsert({
        where: { fileId: driveFile.fileId },
        create: {
          fileId: driveFile.fileId,
          uid: user.uid,
          contentStorageKey: '',
          contentType: driveFile.type,
          parser: 'lambda',
          parseStatus: 'processing',
          metadata: JSON.stringify({ lambdaJobId: lambdaJob.jobId }),
        },
        update: {
          parseStatus: 'processing',
          metadata: JSON.stringify({ lambdaJobId: lambdaJob.jobId }),
          updatedAt: new Date(),
        },
      });

      this.logger.info(
        { fileId: driveFile.fileId, type: driveFile.type, jobId: lambdaJob.jobId },
        'Triggered async parse for uploaded file',
      );
    } catch (error) {
      // Silently ignore errors - async parsing is best-effort
      this.logger.warn(
        { fileId: driveFile.fileId, error: (error as Error).message },
        'Failed to trigger async parse',
      );
    }
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
    return this.toDTO(updatedFile);
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
   * Check if a file exists in OSS
   * @param oss - The OSS instance to check
   * @param storageKey - The storage key to check
   * @returns true if file exists, false otherwise
   */
  private async fileExistsInOss(
    oss: ObjectStorageService,
    storageKey: string | null | undefined,
  ): Promise<boolean> {
    if (!storageKey) return false;
    try {
      const stat = await oss.statObject(storageKey);
      return stat !== null;
    } catch (error) {
      // If any error occurs (permission denied, network error, etc.), treat as file not exists
      this.logger.warn(`Failed to check file existence for ${storageKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * Duplicate a drive file to a new canvas
   */
  async duplicateDriveFile(
    user: User,
    sourceFile: DriveFile & { storageKey?: string | null },
    newCanvasId: string,
  ): Promise<DriveFile> {
    const fileId = genDriveFileID();

    const newStorageKey = this.generateStorageKey(user, {
      ...sourceFile,
      canvasId: newCanvasId,
    });

    if (newStorageKey === sourceFile.storageKey) {
      return sourceFile;
    }

    if (await this.fileExistsInOss(this.internalOss, sourceFile.storageKey)) {
      await this.internalOss.duplicateFile(sourceFile.storageKey, newStorageKey);
    } else if (await this.fileExistsInOss(this.externalOss, sourceFile.storageKey)) {
      const stream = await this.externalOss.getObject(sourceFile.storageKey);
      await this.internalOss.putObject(newStorageKey, stream);
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

    this.logger.info(
      `Duplicated drive file record from ${sourceFile.fileId} to ${fileId} for canvas ${newCanvasId}`,
    );

    // Copy driveFileParseCache if exists
    const sourceCache = await this.prisma.driveFileParseCache.findUnique({
      where: { fileId: sourceFile.fileId },
    });

    if (sourceCache) {
      // Copy the parsed content to a new storage location
      const newContentStorageKey = `drive-parsed/${user.uid}/${fileId}.txt`;

      // Only copy if the source cache has successful parse status and valid content storage
      if (sourceCache.parseStatus === 'success' && sourceCache.contentStorageKey) {
        try {
          // Duplicate the parsed content file
          await this.internalOss.duplicateFile(sourceCache.contentStorageKey, newContentStorageKey);

          // Create new parse cache record for the duplicated file
          await this.prisma.driveFileParseCache.create({
            data: {
              fileId: fileId,
              uid: user.uid,
              contentStorageKey: newContentStorageKey,
              contentType: sourceCache.contentType,
              parser: sourceCache.parser,
              numPages: sourceCache.numPages,
              wordCount: sourceCache.wordCount,
              parseStatus: sourceCache.parseStatus,
              parseError: sourceCache.parseError,
            },
          });

          this.logger.info(`Duplicated parse cache from ${sourceFile.fileId} to ${fileId}`);
        } catch (error) {
          this.logger.warn(`Failed to duplicate parse cache for ${fileId}: ${error.message}`);
          // Continue without failing the entire duplication
        }
      }
    }

    return this.toDTO(duplicatedFile);
  }

  /**
   * Get drive file metadata without loading the full content
   */
  async getDriveFileMetadata(
    user: User,
    fileId: string,
  ): Promise<{ contentType: string; filename: string; lastModified: Date }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: {
        name: true,
        type: true,
        storageKey: true,
        updatedAt: true,
      },
      where: { fileId, uid: user.uid, deletedAt: null },
    });

    if (!driveFile) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    // Get lastModified from OSS, throw 404 if file doesn't exist in OSS
    const objectInfo = await this.internalOss.statObject(driveFile.storageKey);
    if (!objectInfo) {
      throw new NotFoundException(`Drive file not found in storage: ${fileId}`);
    }

    // Use the more recent of OSS lastModified and DB updatedAt
    const dbUpdatedAt = new Date(driveFile.updatedAt);
    const ossLastModified = objectInfo.lastModified;
    const lastModified = ossLastModified > dbUpdatedAt ? ossLastModified : dbUpdatedAt;

    return {
      contentType: driveFile.type || 'application/octet-stream',
      filename: driveFile.name,
      lastModified,
    };
  }

  /**
   * Get drive file stream for serving file content
   */
  async getDriveFileStream(
    user: User,
    fileId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string; lastModified: Date }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: {
        uid: true,
        canvasId: true,
        name: true,
        storageKey: true,
        type: true,
        updatedAt: true,
      },
      where: { fileId, uid: user.uid, deletedAt: null },
    });

    if (!driveFile) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
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
      lastModified: new Date(driveFile.updatedAt),
    };
  }

  /**
   * Publish a drive file to public OSS for sharing
   * Copies the file from internal OSS to external OSS and returns the public URL
   * Creates a new storage key for the public file to avoid conflicts with internal file deletion
   */
  async publishDriveFile(storageKey: string, fileId: string): Promise<void> {
    if (!storageKey || !fileId) {
      return;
    }

    // Check if file already exists in external OSS
    try {
      const existingFile = await this.externalOss.statObject(storageKey);
      if (existingFile?.size > 0) {
        return;
      }
    } catch {
      // File doesn't exist in external OSS, continue with publishing
    }

    try {
      // Copy file from internal to external OSS
      const stream = await this.internalOss.getObject(storageKey);
      if (!stream) {
        throw new NotFoundException(`Source file not found in internal storage: ${fileId}`);
      }

      await this.externalOss.putObject(storageKey, stream);
    } catch (error) {
      this.logger.error(
        `Failed to publish drive file - fileId: ${fileId}, storageKey: ${storageKey}, error: ${error.errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Get public drive file metadata without loading the full content
   */
  async getPublicFileMetadata(fileId: string): Promise<{
    contentType: string;
    filename: string;
    lastModified: Date;
  }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: {
        type: true,
        storageKey: true,
        updatedAt: true,
      },
      where: { fileId },
    });

    if (!driveFile) {
      throw new NotFoundException(`Public file with id ${fileId} not found`);
    }

    const storageKey = driveFile.storageKey ?? '';
    if (!storageKey) {
      throw new NotFoundException(`Public file storage key missing: ${fileId}`);
    }

    const filename = path.basename(storageKey) || 'file';
    const contentType = getSafeMimeType(filename, mime.getType(filename) ?? undefined);

    // Get lastModified from OSS, throw 404 if file doesn't exist in OSS
    const objectInfo = await this.externalOss.statObject(storageKey);
    if (!objectInfo) {
      throw new NotFoundException(`Public file not found in storage: ${fileId}`);
    }

    // Use the more recent of OSS lastModified and DB updatedAt
    const dbUpdatedAt = new Date(driveFile.updatedAt);
    const ossLastModified = objectInfo.lastModified;
    const lastModified = ossLastModified > dbUpdatedAt ? ossLastModified : dbUpdatedAt;

    return {
      contentType,
      filename,
      lastModified,
    };
  }

  /**
   * Get public drive file content for serving via public endpoint
   * Used by the public file endpoint to serve shared files
   */
  async getPublicFileContent(fileId: string): Promise<{
    data: Buffer;
    contentType: string;
    filename: string;
    lastModified: Date;
  }> {
    try {
      const driveFile = await this.prisma.driveFile.findFirst({
        select: {
          type: true,
          storageKey: true,
          updatedAt: true,
        },
        where: { fileId },
      });

      if (!driveFile) {
        throw new NotFoundException(`Public file with id ${fileId} not found`);
      }

      const storageKey = driveFile.storageKey ?? '';
      if (!storageKey) {
        throw new NotFoundException(`Public file storage key missing: ${fileId}`);
      }

      // Get file from external OSS
      const readable = await this.externalOss.getObject(storageKey);
      if (!readable) {
        throw new NotFoundException(`Public file with id ${fileId} not found`);
      }
      const data = await streamToBuffer(readable);

      // Extract filename from storageKey
      const filename = path.basename(storageKey) || 'file';

      // Try to get contentType from file extension
      const contentType = getSafeMimeType(
        filename,
        driveFile.type ?? mime.getType(filename) ?? undefined,
      );

      return {
        data,
        contentType,
        filename,
        lastModified: new Date(driveFile.updatedAt),
      };
    } catch (error) {
      if (
        error?.code === 'NoSuchKey' ||
        error?.code === 'NotFound' ||
        error?.code === 'NoSuchBucket' ||
        error?.message?.includes('The specified key does not exist')
      ) {
        throw new NotFoundException(`Public file with id ${fileId} not found`);
      }
      throw error;
    }
  }

  /**
   * Unified file access - checks externalOss first (public), then internalOss (private with auth)
   * This consolidates both public and private file access into a single method.
   *
   * Access logic:
   * 1. First check if file exists in externalOss (public bucket) - no auth required
   * 2. If not in externalOss, check if user is logged in
   * 3. If logged in, verify file belongs to user and serve from internalOss
   * 4. Otherwise return 404
   */
  async getUnifiedFileMetadata(
    fileId: string,
    user?: User | null,
  ): Promise<{
    contentType: string;
    filename: string;
    lastModified: Date;
    isPublic: boolean;
  }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: {
        uid: true,
        name: true,
        type: true,
        storageKey: true,
        updatedAt: true,
      },
      where: { fileId, deletedAt: null },
    });

    if (!driveFile) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    const storageKey = driveFile.storageKey ?? '';
    if (!storageKey) {
      throw new NotFoundException(`Drive file storage key missing: ${fileId}`);
    }

    // Step 1: Check if file exists in externalOss (public)
    let externalObjectInfo: Awaited<ReturnType<typeof this.externalOss.statObject>> | null = null;
    try {
      externalObjectInfo = await this.externalOss.statObject(storageKey);
    } catch (error) {
      this.logger.debug(`External OSS stat failed for ${storageKey}: ${error.message}`);
    }
    if (externalObjectInfo) {
      const filename = driveFile.name || path.basename(storageKey) || 'file';
      const contentType =
        driveFile.type || getSafeMimeType(filename, mime.getType(filename) ?? undefined);

      const dbUpdatedAt = new Date(driveFile.updatedAt);
      const ossLastModified = externalObjectInfo.lastModified;
      const lastModified = ossLastModified > dbUpdatedAt ? ossLastModified : dbUpdatedAt;

      return {
        contentType,
        filename,
        lastModified,
        isPublic: true,
      };
    }

    // Step 2: File not in externalOss, check user authentication and ownership
    if (!user?.uid) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    if (driveFile.uid !== user.uid) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    // Step 3: User owns the file, check internalOss
    const internalObjectInfo = await this.internalOss.statObject(storageKey);
    if (!internalObjectInfo) {
      throw new NotFoundException(`Drive file not found in storage: ${fileId}`);
    }

    const dbUpdatedAt = new Date(driveFile.updatedAt);
    const ossLastModified = internalObjectInfo.lastModified;
    const lastModified = ossLastModified > dbUpdatedAt ? ossLastModified : dbUpdatedAt;

    return {
      contentType: driveFile.type || 'application/octet-stream',
      filename: driveFile.name,
      lastModified,
      isPublic: false,
    };
  }

  /**
   * Unified file stream - checks externalOss first (public), then internalOss (private with auth)
   */
  async getUnifiedFileStream(
    fileId: string,
    user?: User | null,
  ): Promise<{
    data: Buffer;
    contentType: string;
    filename: string;
    lastModified: Date;
    isPublic: boolean;
  }> {
    const driveFile = await this.prisma.driveFile.findFirst({
      select: {
        uid: true,
        canvasId: true,
        name: true,
        storageKey: true,
        type: true,
        updatedAt: true,
      },
      where: { fileId, deletedAt: null },
    });

    if (!driveFile) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    const storageKey = driveFile.storageKey ?? '';
    if (!storageKey) {
      throw new NotFoundException(`Drive file storage key missing: ${fileId}`);
    }

    // Step 1: Try to get from externalOss (public)
    try {
      const externalReadable = await this.externalOss.getObject(storageKey);
      if (externalReadable) {
        const data = await streamToBuffer(externalReadable);
        const filename = driveFile.name || path.basename(storageKey) || 'file';
        const contentType =
          driveFile.type || getSafeMimeType(filename, mime.getType(filename) ?? undefined);

        return {
          data,
          contentType,
          filename,
          lastModified: new Date(driveFile.updatedAt),
          isPublic: true,
        };
      }
    } catch (error) {
      // File not in externalOss, continue to check internalOss
      if (
        error?.code !== 'NoSuchKey' &&
        error?.code !== 'NotFound' &&
        !error?.message?.includes('The specified key does not exist')
      ) {
        this.logger.warn(`Error checking externalOss for ${fileId}: ${error.message}`);
      }
    }

    // Step 2: File not in externalOss, check user authentication and ownership
    if (!user?.uid) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    if (driveFile.uid !== user.uid) {
      throw new NotFoundException(`Drive file not found: ${fileId}`);
    }

    // Step 3: User owns the file, get from internalOss
    const internalReadable = await this.internalOss.getObject(storageKey);
    if (!internalReadable) {
      throw new NotFoundException(`File content not found: ${fileId}`);
    }

    const data = await streamToBuffer(internalReadable);

    return {
      data,
      contentType: driveFile.type || 'application/octet-stream',
      filename: driveFile.name,
      lastModified: new Date(driveFile.updatedAt),
      isPublic: false,
    };
  }

  /**
   * Regex pattern to match drive file content URLs
   * Matches pattern: /v1/drive/file/content/df-xxx
   */
  private readonly FILE_CONTENT_URL_PATTERN = /\/v1\/drive\/file\/content\/(df-[a-zA-Z0-9]+)/g;

  /**
   * Process markdown/html/svg content for download
   * Extracts all /file/content/:fileId links, publishes them to public bucket,
   * and replaces with /file/public/:fileId links
   *
   * @param user - Current user for permission check
   * @param content - File content as Buffer
   * @param filename - File name with extension
   * @param contentType - MIME type of the content
   * @returns Processed content with public URLs, or original content if not applicable
   */
  async processContentForDownload(
    user: User,
    content: Buffer,
    filename: string,
    contentType: string,
  ): Promise<Buffer> {
    const textContent = content.toString('utf-8');

    // First, check if content contains any file content URLs
    const matches = [...textContent.matchAll(this.FILE_CONTENT_URL_PATTERN)];

    if (matches.length === 0) {
      return content;
    }

    // Found URLs, now check if file type is supported for processing
    if (!isEmbeddableLinkFile(filename, contentType)) {
      this.logger.warn(
        `[processContentForDownload] Found ${matches.length} file content URLs in unsupported file type: ` +
          `filename="${filename}", contentType="${contentType}". Consider adding support for this type.`,
      );
      return content;
    }

    // Extract unique fileIds
    const fileIds = [...new Set(matches.map((m) => m[1]))];

    this.logger.info(
      `[processContentForDownload] Found ${fileIds.length} unique file references to process`,
    );

    // Batch query files for permission check and get storageKeys
    const driveFiles = await this.prisma.driveFile.findMany({
      select: {
        fileId: true,
        uid: true,
        storageKey: true,
      },
      where: {
        fileId: { in: fileIds },
        deletedAt: null,
      },
    });

    // Filter files that user has permission to access (same uid)
    const accessibleFiles = driveFiles.filter((f) => f.uid === user.uid);

    if (accessibleFiles.length === 0) {
      this.logger.info('[processContentForDownload] No accessible files found, returning original');
      return content;
    }

    this.logger.info(
      `[processContentForDownload] ${accessibleFiles.length}/${fileIds.length} files accessible`,
    );

    // Publish files to public bucket in parallel with concurrency limit
    const limit = pLimit(5);
    const publishResults = await Promise.allSettled(
      accessibleFiles.map((file) =>
        limit(async () => {
          try {
            await this.publishDriveFile(file.storageKey, file.fileId);
            return { fileId: file.fileId, success: true };
          } catch (error) {
            this.logger.warn(
              `[processContentForDownload] Failed to publish file ${file.fileId}: ${error.message}`,
            );
            return { fileId: file.fileId, success: false };
          }
        }),
      ),
    );

    // Build set of successfully published fileIds
    const publishedFileIds = new Set(
      publishResults
        .filter((r) => r.status === 'fulfilled' && r.value.success)
        .map(
          (r) => (r as PromiseFulfilledResult<{ fileId: string; success: boolean }>).value.fileId,
        ),
    );

    this.logger.info(
      `[processContentForDownload] Successfully published ${publishedFileIds.size} files`,
    );

    // Replace /v1/drive/file/content/:fileId with /v1/drive/file/public/:fileId for published files
    let processedContent = textContent;
    for (const fileId of publishedFileIds) {
      // Replace all occurrences of this fileId
      const contentPattern = new RegExp(`/v1/drive/file/content/${fileId}`, 'g');
      processedContent = processedContent.replace(
        contentPattern,
        `/v1/drive/file/public/${fileId}`,
      );
    }

    return Buffer.from(processedContent, 'utf-8');
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

  async exportDocument(
    user: User,
    params: { fileId: string; format: 'markdown' | 'docx' | 'pdf' },
  ): Promise<Buffer> {
    const { fileId, format } = params;

    if (!fileId) {
      throw new ParamsError('Document ID is required');
    }

    // For markdown format, handle locally (just return raw content with title)
    // Lambda document-render only supports 'pdf' and 'docx'
    if (format === 'markdown') {
      return this.exportDocumentAsMarkdown(user, fileId);
    }

    // For pdf/docx, use Lambda
    const lambdaEnabled = this.config.get<boolean>('lambda.enabled') !== false;
    if (!lambdaEnabled || !this.lambdaService) {
      throw new ParamsError('Lambda service is not available for document export');
    }

    // Start export job via Lambda
    const exportJob = await this.startExportJob(user, { fileId, format });

    // Poll for completion
    const pollIntervalMs = this.config.get<number>('lambda.resultPolling.intervalMs') || 1000;
    const maxRetries = this.config.get<number>('lambda.resultPolling.maxRetries') || 300;

    let retries = 0;
    while (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      retries++;

      const { job, effectiveStatus } = await this.lambdaService.getJobStatus(exportJob.jobId);

      if (effectiveStatus === 'FAILED') {
        const errorMsg = job?.error || 'Export job failed';
        this.logger.error(`Export job ${exportJob.jobId} failed: ${errorMsg}`);
        throw new ParamsError(`Document export failed: ${errorMsg}`);
      }

      if (effectiveStatus === 'COMPLETED' || effectiveStatus === 'PENDING_PERSIST') {
        const { data } = await this.downloadExportJobResult(user, exportJob.jobId);
        return data;
      }
    }

    throw new ParamsError('Export job timed out');
  }

  /**
   * Export document as markdown (local processing)
   * Simply returns the file content with title prefix
   */
  private async exportDocumentAsMarkdown(user: User, fileId: string): Promise<Buffer> {
    const doc = await this.prisma.driveFile.findFirst({
      where: {
        fileId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    if (!doc.storageKey) {
      throw new ParamsError('Document has no content to export');
    }

    // Get file content from storage
    const stream = await this.internalOss.getObject(doc.storageKey);
    const buffer = await streamToBuffer(stream);
    const content = buffer.toString('utf-8');

    // Add title as markdown header
    const title = doc.name?.replace(/\.[^/.]+$/, '') || 'Untitled';
    const markdownContent = `# ${title}\n\n${content}`;

    return Buffer.from(markdownContent, 'utf-8');
  }

  // ============================================================================
  // Lambda Integration Methods
  // ============================================================================

  /**
   * Pre-create a DriveFile record for async Lambda processing
   * This creates a placeholder file record that will be updated when Lambda completes
   *
   * @param user - The user creating the file
   * @param params - File creation parameters
   * @returns The created DriveFile record with pending status
   */
  async preCreateDriveFileForLambda(
    user: User,
    params: {
      canvasId: string;
      name: string;
      contentType: string;
      source?: DriveFileSource;
      resultId?: string;
      resultVersion?: number;
      variableId?: string;
    },
  ): Promise<DriveFile> {
    const fileId = genDriveFileID();
    const category = getFileCategory(params.contentType);

    // Generate the expected storage key path
    const storageKey = this.generateStorageKey(user, {
      canvasId: params.canvasId,
      name: params.name,
    });

    const driveFile = await this.prisma.driveFile.create({
      data: {
        fileId,
        uid: user.uid,
        canvasId: params.canvasId,
        name: params.name,
        type: params.contentType,
        category,
        source: params.source ?? 'agent',
        scope: 'present',
        storageKey,
        size: BigInt(0), // Will be updated when Lambda completes
        resultId: params.resultId,
        resultVersion: params.resultVersion,
        variableId: params.variableId,
      },
    });

    this.logger.info(
      `Pre-created DriveFile for Lambda processing: fileId=${fileId}, canvasId=${params.canvasId}`,
    );

    return this.toDTO(driveFile);
  }

  /**
   * Dispatch an image transform task to Lambda
   *
   * @param user - The user requesting the transform
   * @param params - Transform parameters
   * @returns Object containing the pre-created DriveFile and Lambda job
   */
  async dispatchLambdaImageTransform(
    user: User,
    params: {
      canvasId: string;
      name: string;
      sourceKey: string;
      options?: {
        format?: 'webp' | 'jpeg' | 'png';
        quality?: number;
        maxWidth?: number;
        maxHeight?: number;
      };
    },
  ): Promise<{ driveFile: DriveFile; lambdaJob: LambdaJobRecord }> {
    // Determine output content type based on format
    const format = params.options?.format ?? 'webp';
    const contentType = `image/${format}`;

    // 1. Pre-create DriveFile record
    const driveFile = await this.preCreateDriveFileForLambda(user, {
      canvasId: params.canvasId,
      name: params.name,
      contentType,
    });

    // 2. Dispatch to Lambda
    const inputBucket = this.config.get<string>('lambda.s3.inputBucket');
    const outputBucket = this.config.get<string>('lambda.s3.bucket');

    const lambdaJob = await this.lambdaService.dispatchImageTransform({
      uid: user.uid,
      fileId: driveFile.fileId,
      s3Input: {
        bucket: inputBucket,
        key: params.sourceKey,
      },
      outputBucket,
      name: params.name,
      options: params.options,
    });

    this.logger.info(
      `Dispatched Lambda image transform: fileId=${driveFile.fileId}, jobId=${lambdaJob.jobId}`,
    );

    return { driveFile, lambdaJob };
  }

  /**
   * Dispatch a document render (export) task to Lambda
   *
   * @param user - The user requesting the export
   * @param params - Export parameters
   * @returns Object containing the pre-created DriveFile and Lambda job
   */
  async dispatchLambdaDocumentRender(
    user: User,
    params: {
      canvasId: string;
      name: string;
      sourceKey: string;
      format: 'pdf' | 'docx';
      options?: {
        template?: string;
        pageSize?: 'A4' | 'Letter';
      };
    },
  ): Promise<{ driveFile: DriveFile; lambdaJob: LambdaJobRecord }> {
    // Determine content type based on format
    const contentType =
      params.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // 1. Pre-create DriveFile record
    const driveFile = await this.preCreateDriveFileForLambda(user, {
      canvasId: params.canvasId,
      name: params.name,
      contentType,
    });

    // 2. Dispatch to Lambda
    const inputBucket = this.config.get<string>('lambda.s3.inputBucket');
    const outputBucket = this.config.get<string>('lambda.s3.bucket');

    const lambdaJob = await this.lambdaService.dispatchDocumentRender({
      uid: user.uid,
      fileId: driveFile.fileId,
      s3Input: {
        bucket: inputBucket,
        key: params.sourceKey,
      },
      outputBucket,
      name: params.name,
      format: params.format,
      options: params.options,
    });

    this.logger.info(
      `Dispatched Lambda document render: fileId=${driveFile.fileId}, jobId=${lambdaJob.jobId}`,
    );

    return { driveFile, lambdaJob };
  }

  /**
   * Get Lambda job status for a file
   *
   * @param jobId - The Lambda job ID
   * @returns Job status information
   */
  async getLambdaJobStatusInternal(jobId: string): Promise<{
    job: LambdaJobRecord | null;
    effectiveStatus: string | null;
  }> {
    const lambdaEnabled = this.config.get<boolean>('lambda.enabled') !== false;
    if (!lambdaEnabled || !this.lambdaService) {
      return { job: null, effectiveStatus: null };
    }
    return this.lambdaService.getJobStatus(jobId);
  }

  // ============================================================================
  // Async Export Methods (Lambda-based)
  // ============================================================================

  /**
   * Convert Lambda job status to ExportJobStatus
   */
  private mapLambdaStatusToExportStatus(
    status: string,
    effectiveStatus: string | null,
  ): ExportJobStatus {
    if (effectiveStatus === 'FAILED') return 'failed';
    if (effectiveStatus === 'COMPLETED' || effectiveStatus === 'PENDING_PERSIST')
      return 'completed';
    if (effectiveStatus === 'PROCESSING' || status === 'processing') return 'processing';
    return 'pending';
  }

  /**
   * Convert LambdaJobRecord to ExportJob
   */
  private lambdaJobToExportJob(job: LambdaJobRecord, effectiveStatus: string | null): ExportJob {
    return {
      jobId: job.jobId,
      fileId: job.fileId ?? undefined,
      status: this.mapLambdaStatusToExportStatus(job.status, effectiveStatus),
      format: job.mimeType?.includes('pdf') ? 'pdf' : 'docx',
      name: job.name ?? undefined,
      error: job.error ?? undefined,
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Start an async export job using Lambda
   *
   * @param user - The user requesting the export
   * @param request - Export job request
   * @returns ExportJob with job status
   */
  async startExportJob(user: User, request: StartExportJobRequest): Promise<ExportJob> {
    const { fileId, format } = request;

    const lambdaEnabled = this.config.get<boolean>('lambda.enabled') !== false;
    if (!lambdaEnabled || !this.lambdaService) {
      throw new ParamsError('Lambda service is not available for async export');
    }

    // Get the file to export
    const doc = await this.prisma.driveFile.findFirst({
      where: {
        fileId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    if (!doc.storageKey) {
      throw new ParamsError('Document has no content to export');
    }

    // Always use the original file's storageKey for export
    // (parseCache is for reading parsed content, not for export source)
    const sourceKey = doc.storageKey;

    // Dispatch Lambda document render job
    const inputBucket = this.config.get<string>('lambda.s3.inputBucket');
    const outputBucket = this.config.get<string>('lambda.s3.bucket');

    const outputName = `${doc.name?.replace(/\.[^/.]+$/, '') || 'export'}.${format}`;

    const lambdaJob = await this.lambdaService.dispatchDocumentRender({
      uid: user.uid,
      fileId,
      s3Input: {
        bucket: inputBucket,
        key: sourceKey,
      },
      outputBucket,
      name: outputName,
      format,
    });

    this.logger.info(
      `Started export job: fileId=${fileId}, jobId=${lambdaJob.jobId}, format=${format}`,
    );

    return this.lambdaJobToExportJob(lambdaJob, 'PENDING');
  }

  /**
   * Get export job status
   *
   * @param user - The user requesting the status
   * @param jobId - Export job ID
   * @returns ExportJob with current status
   */
  async getExportJobStatus(user: User, jobId: string): Promise<ExportJob> {
    if (!this.lambdaService) {
      throw new ParamsError('Lambda service is not available');
    }

    const { job, effectiveStatus } = await this.lambdaService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    // Verify the job belongs to this user
    if (job.uid !== user.uid) {
      throw new NotFoundException('Export job not found');
    }

    return this.lambdaJobToExportJob(job, effectiveStatus);
  }

  /**
   * Download export job result
   *
   * @param user - The user downloading the result
   * @param jobId - Export job ID
   * @returns Buffer with file content, content type, and filename
   */
  async downloadExportJobResult(
    user: User,
    jobId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    if (!this.lambdaService) {
      throw new ParamsError('Lambda service is not available');
    }

    const { job, effectiveStatus } = await this.lambdaService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    // Verify the job belongs to this user
    if (job.uid !== user.uid) {
      throw new NotFoundException('Export job not found');
    }

    // Check if job is completed
    if (effectiveStatus !== 'COMPLETED' && effectiveStatus !== 'PENDING_PERSIST') {
      throw new ParamsError(`Export job is not ready. Current status: ${effectiveStatus}`);
    }

    if (!job.storageKey) {
      throw new ParamsError('Export job has no output file');
    }

    // Get the file from Lambda S3 bucket
    const stream = await this.lambdaService.getJobOutput(job.storageKey);
    if (!stream) {
      throw new NotFoundException('Export result not found');
    }

    const data = await streamToBuffer(stream);
    const contentType = job.mimeType || 'application/octet-stream';
    const filename = job.name || `export.${contentType.includes('pdf') ? 'pdf' : 'docx'}`;

    return { data, contentType, filename };
  }

  // =====================
  // CLI Presigned Upload Methods
  // =====================

  /**
   * Interface for presigned upload metadata stored in Redis
   */
  private buildPresignedUploadRedisKey(fileId: string): string {
    return `${PENDING_UPLOAD_REDIS_PREFIX}${fileId}`;
  }

  /**
   * Create a presigned upload URL for CLI uploads
   * @param user - User performing the upload
   * @param params - Upload parameters
   * @returns Presigned upload URL and metadata
   */
  async createPresignedUpload(
    user: User,
    params: {
      canvasId: string;
      filename: string;
      size: number;
      contentType: string;
    },
  ): Promise<{
    uploadId: string;
    presignedUrl: string;
    expiresIn: number;
  }> {
    const { canvasId, filename, size, contentType } = params;

    // Validate required parameters
    if (!canvasId) {
      throw new ParamsError('canvasId is required');
    }
    if (!filename) {
      throw new ParamsError('filename is required');
    }
    if (size === undefined || size === null) {
      throw new ParamsError('size is required');
    }
    if (!contentType) {
      throw new ParamsError('contentType is required');
    }

    // Validate canvas exists and user has access
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new DocumentNotFoundError(`Canvas not found: ${canvasId}`);
    }

    // Validate file size
    if (size > MAX_CLI_UPLOAD_SIZE) {
      throw new FileTooLargeError(
        `File size ${size} exceeds maximum allowed size ${MAX_CLI_UPLOAD_SIZE}`,
      );
    }

    // Validate content type
    if (!isContentTypeAllowed(contentType)) {
      throw new InvalidContentTypeError(
        `Content type '${contentType}' is not allowed for CLI uploads`,
      );
    }

    // Generate file ID and storage key with CLI-specific path
    const fileId = genDriveFileID();
    const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');
    const storageKey = `${prefix}/cli/${user.uid}/${canvasId}/${fileId}-${filename}`;

    // Create pending DB record (size=0 indicates pending)
    await this.prisma.driveFile.create({
      data: {
        fileId,
        uid: user.uid,
        canvasId,
        name: filename,
        type: contentType,
        size: BigInt(0), // Pending upload
        storageKey,
        source: 'manual',
        scope: 'present',
        category: getFileCategory(contentType),
      },
    });

    // Generate presigned PUT URL
    let presignedUrl: string;
    try {
      presignedUrl = await this.internalOss.presignedPutObject(storageKey, PRESIGNED_UPLOAD_EXPIRY);
    } catch (error) {
      // Clean up DB record if presign fails
      await this.prisma.driveFile.delete({ where: { fileId } }).catch(() => {});
      if ((error as Error).message?.includes('PRESIGN_NOT_SUPPORTED')) {
        throw new PresignNotSupportedError();
      }
      throw error;
    }

    // Store metadata in Redis for confirmation step
    const metadata = JSON.stringify({
      expectedSize: size,
      contentType,
      canvasId,
      uid: user.uid,
      storageKey,
    });
    await this.redis.setex(
      this.buildPresignedUploadRedisKey(fileId),
      PENDING_UPLOAD_REDIS_TTL,
      metadata,
    );

    return {
      uploadId: fileId,
      presignedUrl,
      expiresIn: PRESIGNED_UPLOAD_EXPIRY,
    };
  }

  /**
   * Confirm a presigned upload has completed
   * @param user - User who initiated the upload
   * @param uploadId - The upload ID (file ID) returned from createPresignedUpload
   * @returns The completed drive file
   */
  async confirmPresignedUpload(user: User, uploadId: string): Promise<DriveFile> {
    // Read metadata from Redis
    const redisKey = this.buildPresignedUploadRedisKey(uploadId);
    const metadataStr = await this.redis.get(redisKey);

    if (!metadataStr) {
      throw new UploadExpiredError('Upload session expired or not found');
    }

    const metadata = JSON.parse(metadataStr) as {
      expectedSize: number;
      contentType: string;
      canvasId: string;
      uid: string;
      storageKey: string;
    };

    // Verify ownership
    if (metadata.uid !== user.uid) {
      throw new ParamsError('Upload does not belong to this user');
    }

    // Get actual file size from object storage
    const objectInfo = await this.internalOss.statObject(metadata.storageKey);

    if (!objectInfo) {
      // File not uploaded yet or upload failed
      throw new UploadSizeMismatchError('File not found in storage. Upload may have failed.');
    }

    // Verify size matches (with some tolerance for content-length header differences)
    const sizeDiff = Math.abs(objectInfo.size - metadata.expectedSize);
    const tolerance = Math.max(1024, metadata.expectedSize * 0.01); // 1KB or 1% tolerance

    if (sizeDiff > tolerance) {
      // Size mismatch - delete the uploaded object
      this.logger.warn(
        { uploadId, expected: metadata.expectedSize, actual: objectInfo.size },
        'Upload size mismatch, cleaning up',
      );
      await this.internalOss.removeObject(metadata.storageKey, true).catch((err) => {
        this.logger.error(`Failed to cleanup mismatched upload: ${err.message}`);
      });
      throw new UploadSizeMismatchError(
        `Expected ${metadata.expectedSize} bytes, got ${objectInfo.size} bytes`,
      );
    }

    // Update DB record with actual size
    const updatedFile = await this.prisma.driveFile.update({
      where: { fileId: uploadId },
      data: {
        size: BigInt(objectInfo.size),
        updatedAt: new Date(),
      },
    });

    // Delete Redis key
    await this.redis.del(redisKey);

    return this.toDTO(updatedFile);
  }

  /**
   * Cleanup stale pending uploads (size=0 and older than threshold)
   * Runs every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async cleanupStalePendingUploads(): Promise<void> {
    const lockKey = 'cli:drive:upload:cleanup:lock';
    const lockTTL = 300; // 5 minutes

    // Try to acquire distributed lock
    const releaseLock = await this.redis.acquireLock(lockKey, lockTTL);
    if (!releaseLock) {
      return; // Another instance is running cleanup
    }

    try {
      const cutoffTime = new Date(Date.now() - PENDING_UPLOAD_CLEANUP_AGE);
      const prefix = this.config.get<string>('drive.storageKeyPrefix').replace(/\/$/, '');
      const cliPrefix = `${prefix}/cli/`;

      // Find stale pending uploads
      const staleFiles = await this.prisma.driveFile.findMany({
        where: {
          size: BigInt(0),
          createdAt: { lt: cutoffTime },
          storageKey: { startsWith: cliPrefix },
        },
        select: { fileId: true, storageKey: true, createdAt: true, updatedAt: true },
        take: 100, // Limit batch size
      });

      if (staleFiles.length === 0) {
        return;
      }

      this.logger.info({ count: staleFiles.length }, 'Cleaning up stale pending CLI uploads');

      // Delete from storage and database
      for (const file of staleFiles) {
        try {
          // Skip confirmed zero-byte uploads (updatedAt changes on confirmation)
          if (file.updatedAt.getTime() - file.createdAt.getTime() > 500) {
            continue;
          }

          // Delete from object storage (ignore if not found)
          if (file.storageKey) {
            await this.internalOss.removeObject(file.storageKey, true).catch(() => {});
          }

          // Hard delete DB record
          await this.prisma.driveFile.delete({ where: { fileId: file.fileId } });

          // Delete Redis key if exists
          await this.redis.del(this.buildPresignedUploadRedisKey(file.fileId));
        } catch (err) {
          this.logger.warn(
            { fileId: file.fileId, error: (err as Error).message },
            'Failed to cleanup stale upload',
          );
        }
      }

      this.logger.info(
        { cleaned: staleFiles.length },
        'Finished cleaning up stale pending uploads',
      );
    } finally {
      // Release lock
      await releaseLock();
    }
  }
}
