import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import mime from 'mime';
import pLimit from 'p-limit';
import pdf from 'pdf-parse';
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
import {
  genDriveFileID,
  getFileCategory,
  getSafeMimeType,
  isPlainTextMimeType,
  pick,
} from '@refly/utils';
import { ParamsError, DriveFileNotFoundError, DocumentNotFoundError } from '@refly/errors';
import { ObjectStorageService, OSS_INTERNAL, OSS_EXTERNAL } from '../common/object-storage';
import { streamToBuffer, streamToString } from '../../utils';
import { driveFilePO2DTO } from './drive.dto';
import { isEmbeddableLinkFile } from './drive.utils';
import path from 'node:path';
import { ProviderService } from '../provider/provider.service';
import { ParserFactory } from '../knowledge/parsers/factory';
import { SubscriptionService } from '../subscription/subscription.service';
import { readingTime } from 'reading-time-estimator';
import { MiscService } from '../misc/misc.service';
import { DocxParser } from '../knowledge/parsers/docx.parser';
import { PdfParser } from '../knowledge/parsers/pdf.parser';

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
  constructor(
    private readonly logger: PinoLogger,
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(OSS_INTERNAL) private internalOss: ObjectStorageService,
    @Inject(OSS_EXTERNAL) private externalOss: ObjectStorageService,
    private redis: RedisService,
    private providerService: ProviderService,
    private subscriptionService: SubscriptionService,
    private miscService: MiscService,
  ) {
    this.logger.setContext(DriveService.name);
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

  /**
   * Transform DriveFile Prisma model to DTO with URL
   */
  toDTO(driveFile: DriveFileModel): DriveFile {
    return driveFilePO2DTO(driveFile, this.origin);
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
        const { canvasId, name, content, storageKey, externalUrl, buffer, type } = request;

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
    } finally {
      // Always release the lock
      await releaseLock();
    }
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
        driveFiles.map((file) => this.getDriveFileDetail(user, file.fileId, file)),
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

      return {
        ...this.toDTO(driveFile),
        content,
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
        // Trim whitespace at start and end of each line
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Trim overall content
        .trim()
    );
  }

  /**
   * Truncate content by keeping head and tail, removing middle section
   * @param content - Original content
   * @param maxWords - Maximum word count to keep
   * @returns Truncated content with ellipsis in the middle
   */
  private truncateContent(content: string, maxWords: number): string {
    const words = content.split(/\s+/).filter((w) => w.length > 0);

    if (words.length <= maxWords) {
      return content;
    }

    const headWords = Math.floor(maxWords * 0.4); // Keep 40% at the beginning
    const tailWords = Math.floor(maxWords * 0.4); // Keep 40% at the end

    const head = words.slice(0, headWords).join('');
    const tail = words.slice(-tailWords).join('');

    return `${head}\n\n...[content truncated, ${words.length - maxWords} words removed]...\n\n${tail}`;
  }

  /**
   * Load drive file content from cache or parse if not cached
   */
  private async loadOrParseDriveFile(user: User, driveFile: DriveFileModel): Promise<DriveFile> {
    const { fileId, type: contentType } = driveFile;

    this.logger.info(`Loading or parsing drive file ${fileId}, contentType: ${contentType}`);

    // Step 1: Try to load from cache
    const cache = await this.prisma.driveFileParseCache.findUnique({
      where: { fileId },
    });

    if (cache?.parseStatus === 'success') {
      try {
        const stream = await this.internalOss.getObject(cache.contentStorageKey);
        let content = await streamToBuffer(stream).then((b) => b.toString('utf8'));

        content = content?.replace(/x00/g, '') || '';
        content = this.normalizeWhitespace(content);

        // Truncate content if it exceeds max word limit before storing
        const maxWords = this.config.get<number>('drive.maxContentWords') || 3000;
        content = this.truncateContent(content, maxWords);

        this.logger.info(
          `Successfully loaded from cache for ${fileId}, content length: ${content.length}`,
        );
        return { ...this.toDTO(driveFile), content };
      } catch (error) {
        this.logger.warn(`Cache read failed for ${fileId}, will re-parse:`, error);
        // Continue to parse
      }
    }

    // Step 2: No cache found, perform parsing
    try {
      this.logger.info(`No cache found for ${fileId}, starting parse process`);

      const parserFactory = new ParserFactory(this.config, this.providerService);
      const parser = await parserFactory.createDocumentParser(user, contentType, {
        resourceId: fileId,
      });

      // Load file from storage
      const storageKey = driveFile.storageKey ?? this.generateStorageKey(user, driveFile);
      const fileStream = await this.internalOss.getObject(storageKey);
      const fileBuffer = await streamToBuffer(fileStream);
      this.logger.info(`File loaded from storage for ${fileId}, size: ${fileBuffer.length} bytes`);

      // Check PDF page count
      let numPages: number | undefined = undefined;
      if (contentType === 'application/pdf') {
        const pdfInfo = await pdf(fileBuffer);
        numPages = pdfInfo.numpages;

        // Check page limit
        const { available, pageUsed, pageLimit } =
          await this.subscriptionService.checkFileParseUsage(user);

        if (numPages > available) {
          const errorMessage = `Page limit exceeded: ${numPages} pages, available: ${available}`;
          this.logger.info(
            `Drive file ${fileId} parse failed due to page limit, numpages: ${numPages}, available: ${available}`,
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

          throw new Error(errorMessage);
        }
      }

      // Perform parsing
      this.logger.info(`Starting to parse file ${fileId} with parser: ${parser.name}`);
      const result = await parser.parse(fileBuffer);
      if (result.error) {
        throw new Error(`Parse failed: ${result.error}`);
      }

      // Process content: remove null bytes and normalize whitespace
      let processedContent = result.content?.replace(/x00/g, '') || '';
      processedContent = this.normalizeWhitespace(processedContent);

      // Truncate content if it exceeds max word limit before storing
      const maxWords = this.config.get<number>('drive.maxContentWords') || 3000;
      processedContent = this.truncateContent(processedContent, maxWords);

      // Store to OSS
      const contentStorageKey = `drive-parsed/${user.uid}/${fileId}.txt`;
      await this.internalOss.putObject(contentStorageKey, result.content);

      // Calculate word count
      const wordCount = readingTime(processedContent).words;

      // Save cache record (upsert ensures concurrency safety)
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
        },
        update: {
          contentStorageKey,
          parser: parser.name,
          numPages: numPages ?? null,
          wordCount,
          parseStatus: 'success',
          parseError: null,
          updatedAt: new Date(),
        },
      });

      // If PDF, record page usage to fileParseRecord
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

      this.logger.info(
        `Successfully parsed and cached file ${fileId}, content length: ${processedContent.length}, word count: ${wordCount}`,
      );

      return { ...this.toDTO(driveFile), content: processedContent };
    } catch (error) {
      this.logger.error(
        `Failed to parse drive file ${fileId}: ${JSON.stringify({ message: error.message })}`,
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
          parseError: JSON.stringify({ message: error.message }),
        },
        update: {
          parseStatus: 'failed',
          parseError: JSON.stringify({ message: error.message }),
          updatedAt: new Date(),
        },
      });

      // Fallback to summary
      this.logger.info(`Returning fallback summary for ${fileId} due to parse failure`);
      return { ...this.toDTO(driveFile), content: driveFile.summary };
    }
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
    return createdFiles.map((file) => this.toDTO(file));
  }

  /**
   * Create a new drive file
   */
  async createDriveFile(user: User, request: ExtendedUpsertDriveFileRequest): Promise<DriveFile> {
    const { canvasId } = request;
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for create operation');
    }

    const processedResults = await this.batchProcessDriveFileRequests(user, canvasId, [request]);
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
    return this.toDTO(createdFile);
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
  async publishDriveFile(storageKey: string, fileId: string): Promise<string> {
    if (!storageKey || !fileId) {
      return '';
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

    const filename = path.basename(driveFile.storageKey) || 'file';
    const contentType = getSafeMimeType(filename, mime.getType(filename) ?? undefined);

    // Get lastModified from OSS, throw 404 if file doesn't exist in OSS
    const objectInfo = await this.externalOss.statObject(driveFile.storageKey);
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

      const storageKey = driveFile.storageKey;

      // Get file from external OSS
      const readable = await this.externalOss.getObject(storageKey);
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
        error?.message?.includes('The specified key does not exist')
      ) {
        throw new NotFoundException(`Public file with id ${fileId} not found`);
      }
      throw error;
    }
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

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.internalOss.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    // Process images in the document content
    if (content) {
      content = await this.miscService.processContentImages(content);
    }

    // add title as H1 title
    const title = doc.name ?? 'Untitled';
    const markdownContent = `# ${title}\n\n${content ?? ''}`;

    // convert content to the format
    switch (format) {
      case 'markdown':
        return Buffer.from(markdownContent);
      case 'docx': {
        const docxParser = new DocxParser();
        const docxData = await docxParser.parse(markdownContent);
        return docxData.buffer;
      }
      case 'pdf': {
        const pdfParser = new PdfParser();
        const pdfData = await pdfParser.parse(markdownContent);
        return pdfData.buffer;
      }
      default:
        throw new ParamsError('Unsupported format');
    }
  }
}
