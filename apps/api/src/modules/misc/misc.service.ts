import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import sharp from 'sharp';
import mime from 'mime';
import { InjectQueue } from '@nestjs/bullmq';
import {
  EntityType,
  ScrapeWeblinkRequest,
  ScrapeWeblinkResult,
  UploadResponse,
  User,
  FileVisibility,
  Entity,
} from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { OSS_EXTERNAL, OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { omit, scrapeWeblink } from '@refly/utils';
import { QUEUE_IMAGE_PROCESSING, QUEUE_CLEAN_STATIC_FILES, streamToBuffer } from '../../utils';
import {
  CanvasNotFoundError,
  ParamsError,
  ResourceNotFoundError,
  DocumentNotFoundError,
  CodeArtifactNotFoundError,
} from '@refly/errors';
import { FileObject } from '../misc/misc.dto';
import { createId } from '@paralleldrive/cuid2';
import { StaticFile } from '../../generated/client';
import { PandocParser } from '../knowledge/parsers/pandoc.parser';
import pLimit from 'p-limit';
import { isDesktop, isMultiTenantEnabled } from '../../utils/runtime';

@Injectable()
export class MiscService implements OnModuleInit {
  private logger = new Logger(MiscService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(OSS_EXTERNAL) private externalOss: ObjectStorageService,
    @Inject(OSS_INTERNAL) private internalOss: ObjectStorageService,
    @Optional() @InjectQueue(QUEUE_IMAGE_PROCESSING) private imageQueue?: Queue<FileObject>,
    @Optional() @InjectQueue(QUEUE_CLEAN_STATIC_FILES) private cleanStaticFilesQueue?: Queue,
  ) {}

  async onModuleInit() {
    if (this.cleanStaticFilesQueue) {
      await this.setupCleanStaticFilesCronjob();
    }
  }

  private async setupCleanStaticFilesCronjob() {
    if (!this.cleanStaticFilesQueue) return;

    const existingJobs = await this.cleanStaticFilesQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.cleanStaticFilesQueue!.removeJobScheduler(job.id)),
    );

    // Set up the cronjob to run daily at midnight
    await this.cleanStaticFilesQueue.add(
      'cleanStaticFiles',
      {},
      {
        repeat: {
          pattern: '0 0 * * *', // Run at midnight every day
        },
      },
    );

    this.logger.log('Initialized clean static files cronjob');
  }

  async scrapeWeblink(body: ScrapeWeblinkRequest): Promise<ScrapeWeblinkResult> {
    const { url } = body;
    const result = await scrapeWeblink(url);

    return {
      title: result.title,
      description: result.description,
      image: result.image,
    };
  }

  async dumpFileFromURL(
    user: User,
    param: {
      url: string;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
    },
  ): Promise<UploadResponse['data']> {
    const { url, entityId, entityType, visibility = 'private' } = param;
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();

    return await this.uploadFile(user, {
      file: {
        buffer: Buffer.from(buffer),
        mimetype: res.headers.get('Content-Type') || 'application/octet-stream',
        originalname: path.basename(url),
      },
      entityId,
      entityType,
      visibility,
    });
  }

  async checkEntity(user: User, entityId: string, entityType: EntityType): Promise<void> {
    if (!entityId || !entityType) {
      throw new ParamsError('Entity ID and type are required');
    }

    if (entityType === 'resource') {
      const resource = await this.prisma.resource.findUnique({
        where: {
          resourceId: entityId,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!resource) {
        throw new ResourceNotFoundError();
      }
    } else if (entityType === 'canvas') {
      const canvas = await this.prisma.canvas.findUnique({
        where: {
          canvasId: entityId,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!canvas) {
        throw new CanvasNotFoundError();
      }
    } else if (entityType === 'document') {
      const document = await this.prisma.document.findUnique({
        where: {
          docId: entityId,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!document) {
        throw new DocumentNotFoundError();
      }
    } else if (entityType === 'codeArtifact') {
      const codeArtifact = await this.prisma.codeArtifact.findUnique({
        where: {
          artifactId: entityId,
        },
      });
      if (!codeArtifact) {
        throw new CodeArtifactNotFoundError();
      }
    } else {
      throw new ParamsError(`Invalid entity type: ${entityType}`);
    }
  }

  minioClient(visibility: FileVisibility) {
    if (visibility === 'public') {
      return this.externalOss;
    }
    return this.internalOss;
  }

  async batchRemoveObjects(user: User | null, objects: FileObject[]) {
    // Group objects by storageKey for efficient querying
    const storageKeys = objects.map((fo) => fo.storageKey);

    // First mark the user's files as deleted in the database
    await this.prisma.staticFile.updateMany({
      where: {
        storageKey: { in: storageKeys },
        uid: user?.uid,
      },
      data: { deletedAt: new Date() },
    });

    // For each storage key, check if all records are now deleted
    const objectsToRemove = new Map<FileVisibility, Set<string>>();

    // Check each storage key to see if it has any non-deleted records
    for (const storageKey of storageKeys) {
      const remainingRecords = await this.prisma.staticFile.count({
        where: {
          storageKey,
          deletedAt: null,
        },
      });

      // If no remaining records, schedule this object for removal from storage
      if (remainingRecords === 0) {
        const matchingObject = objects.find((obj) => obj.storageKey === storageKey);

        if (matchingObject) {
          const { visibility } = matchingObject;
          if (!objectsToRemove.has(visibility)) {
            objectsToRemove.set(visibility, new Set());
          }
          objectsToRemove.get(visibility)?.add(storageKey);
        }
      }
    }

    // Only remove objects from storage if they have no active database records
    if (objectsToRemove.size > 0) {
      await Promise.all(
        Array.from(objectsToRemove.entries()).map(([visibility, storageKeys]) =>
          this.minioClient(visibility).removeObjects(Array.from(storageKeys)),
        ),
      );
    }
  }

  async findFileAndBindEntity(storageKey: string, entity: Entity) {
    const staticFile = await this.prisma.staticFile.findFirst({
      where: { storageKey, deletedAt: null },
    });
    if (!staticFile) {
      return null;
    }
    return this.prisma.staticFile.update({
      where: { pk: staticFile.pk },
      data: {
        entityId: entity.entityId,
        entityType: entity.entityType,
      },
    });
  }

  generateFileURL(file: FileObject, options?: { download?: boolean }) {
    const { visibility, storageKey } = file;

    let endpoint = '';
    if (visibility === 'public') {
      endpoint = this.config.get<string>('static.public.endpoint')?.replace(/\/$/, '');
    } else {
      endpoint = this.config.get<string>('static.private.endpoint')?.replace(/\/$/, '');
    }

    if (options?.download) {
      return `${endpoint}/${storageKey}?download=1`;
    }

    return `${endpoint}/${storageKey}`;
  }

  async downloadFile(file: FileObject) {
    const { storageKey, visibility = 'private' } = file;
    const stream = await this.minioClient(visibility).getObject(storageKey);
    return streamToBuffer(stream);
  }

  /**
   * Publish a private file to the public bucket
   * @param storageKey - The storage key of the file to publish
   */
  async publishFile(storageKey: string) {
    if (!storageKey) {
      return '';
    }
    const stream = await this.minioClient('private').getObject(storageKey);
    await this.minioClient('public').putObject(storageKey, stream);
    return this.generateFileURL({ visibility: 'public', storageKey });
  }

  async uploadBuffer(
    user: User,
    param: {
      fpath: string;
      buf: Buffer;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ): Promise<UploadResponse['data']> {
    const { fpath, buf, entityId, entityType, visibility = 'private' } = param;
    const objectKey = randomUUID();
    const fileExtension = path.extname(fpath);
    const storageKey = param.storageKey ?? `static/${objectKey}${fileExtension}`;
    const contentType = mime.getType(fpath) ?? 'application/octet-stream';

    await this.prisma.staticFile.create({
      data: {
        uid: user.uid,
        storageKey,
        storageSize: buf.length,
        entityId,
        entityType,
        contentType,
        visibility,
      },
    });

    await this.minioClient(visibility).putObject(storageKey, buf, {
      'Content-Type': contentType,
    });

    // Resize and convert to webp if it's an image
    if (contentType?.startsWith('image/')) {
      await this.imageQueue?.add('resizeAndConvert', { storageKey, visibility });
    }

    return {
      storageKey,
      url: this.generateFileURL({ visibility, storageKey }),
    };
  }

  async uploadFile(
    user: User,
    param: {
      file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ): Promise<UploadResponse['data']> {
    const { file, entityId, entityType, visibility = 'private' } = param;

    if (entityId && entityType) {
      await this.checkEntity(user, entityId, entityType);
    }

    let existingFile: StaticFile | null = null;
    if (param.storageKey) {
      existingFile = await this.prisma.staticFile.findFirst({
        where: {
          storageKey: param.storageKey,
          deletedAt: null,
        },
      });
    }

    // Check for file permission if in multi-tenant mode
    if (isMultiTenantEnabled() && user.uid) {
      if (existingFile && existingFile.uid !== user.uid) {
        this.logger.warn(`User ${user.uid} is not allowed to upload file with ${param.storageKey}`);
        throw new ForbiddenException();
      }
    }

    const objectKey = randomUUID();
    const extension = path.extname(file.originalname);
    const contentType = mime.getType(extension) ?? file.mimetype ?? 'application/octet-stream';
    const storageKey = param.storageKey ?? `static/${objectKey}${extension}`;

    if (existingFile) {
      await this.prisma.staticFile.update({
        where: { pk: existingFile.pk },
        data: {
          storageSize: file.buffer.length,
          entityId,
          entityType,
          contentType,
          visibility,
        },
      });
    } else {
      await this.prisma.staticFile.create({
        data: {
          uid: user.uid ?? '',
          storageKey,
          storageSize: file.buffer.length,
          entityId,
          entityType,
          contentType,
          visibility,
        },
      });
    }

    await this.minioClient(visibility).putObject(storageKey, file.buffer, {
      'Content-Type': contentType,
    });

    // Resize and convert to webp if it's an image
    if (contentType.startsWith('image/')) {
      await this.imageQueue?.add('resizeAndConvert', { storageKey, visibility });
    }

    return {
      storageKey,
      url: this.generateFileURL({ visibility, storageKey }),
    };
  }

  /**
   * Process an image by resizing it and converting to webp.
   * @param storageKey - The storage key of the image to process.
   */
  async processImage(jobData: FileObject): Promise<void> {
    const { storageKey, visibility } = jobData;
    if (!storageKey) {
      this.logger.warn('Missing required job data');
      return;
    }

    // Retrieve the original image from minio
    const stream = await this.minioClient(visibility).getObject(storageKey);
    const originalBuffer = await streamToBuffer(stream);

    // Get image metadata to calculate dimensions
    const metadata = await sharp(originalBuffer).metadata();
    const originalWidth = metadata?.width ?? 0;
    const originalHeight = metadata?.height ?? 0;
    const isGif = metadata?.format === 'gif';

    // Calculate the current area and scaling factor
    const originalArea = originalWidth * originalHeight;
    const maxArea = this.config.get('image.maxArea');
    const scaleFactor = originalArea > maxArea ? Math.sqrt(maxArea / originalArea) : 1;

    // For GIFs, only resize if needed but keep the original format
    // For other images, resize and convert to webp
    const processedBuffer = await sharp(originalBuffer)
      .resize({
        width: Math.round(originalWidth * scaleFactor),
        height: Math.round(originalHeight * scaleFactor),
        fit: 'fill', // Use fill since we're calculating exact dimensions
      })
      [isGif ? 'toFormat' : 'toFormat'](isGif ? 'gif' : 'webp')
      .toBuffer();

    // Generate a new processed key for the image with appropriate extension
    const extension = isGif ? 'gif' : 'webp';
    const processedKey = `static-processed/${createId()}-${Date.now()}.${extension}`;

    // Upload the processed image to minio
    await this.minioClient(visibility).putObject(processedKey, processedBuffer, {
      'Content-Type': isGif ? 'image/gif' : 'image/webp',
    });

    // Update the staticFile record with the new processedImageKey
    await this.prisma.staticFile.updateMany({
      where: { storageKey: storageKey },
      data: { processedImageKey: processedKey },
    });
  }

  /**
   * Remove all files associated with an entity.
   */
  async removeFilesByEntity(
    user: User,
    param: { entityId: string; entityType: EntityType },
  ): Promise<void> {
    const { entityId, entityType } = param;
    this.logger.log(`Start to remove files for entity ${entityId} of type ${entityType}`);

    const files = await this.prisma.staticFile.findMany({
      select: {
        storageKey: true,
        visibility: true,
      },
      where: {
        uid: user.uid,
        entityId,
        entityType,
        deletedAt: null,
      },
    });

    if (files.length > 0) {
      this.logger.log(`Files to remove: ${files.map((file) => file.storageKey).join(',')}`);

      await Promise.all([
        this.batchRemoveObjects(
          user,
          files.map((file) => ({
            storageKey: file.storageKey,
            visibility: file.visibility as FileVisibility,
          })),
        ),
        this.prisma.staticFile.updateMany({
          where: {
            uid: user.uid,
            entityId,
            entityType,
          },
          data: {
            deletedAt: new Date(),
          },
        }),
      ]);
    }
  }

  async compareAndRemoveFiles(
    user: User,
    param: { entityId: string; entityType: EntityType; objectKeys: string[] },
  ): Promise<void> {
    const { entityId, entityType, objectKeys } = param;
    const storageKeys = objectKeys.map((key) => `static/${key}`);
    const files = await this.prisma.staticFile.findMany({
      select: {
        storageKey: true,
      },
      where: {
        uid: user.uid,
        entityId,
        entityType,
        deletedAt: null,
      },
    });
    const currentStorageKeys = files.map((file) => file.storageKey);
    const storageKeysToRemove = currentStorageKeys.filter((key) => !storageKeys.includes(key));

    await this.batchRemoveObjects(
      user,
      storageKeysToRemove.map((key) => ({ storageKey: key, visibility: 'private' })),
    );
    this.logger.log(`Compare and remove files: ${storageKeysToRemove.join(',')}`);

    if (storageKeysToRemove.length > 0) {
      await this.prisma.staticFile.updateMany({
        where: {
          uid: user.uid,
          entityId,
          entityType,
          storageKey: {
            in: storageKeysToRemove,
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }
  }

  async getInternalFileStream(
    user: User,
    storageKey: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const file = await this.prisma.staticFile.findFirst({
      select: { uid: true, visibility: true, entityId: true, entityType: true, contentType: true },
      where: { storageKey, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException();
    }

    if (!isDesktop() && file.uid !== user.uid) {
      throw new NotFoundException();
    }

    const readable = await this.minioClient(file.visibility as FileVisibility).getObject(
      storageKey,
    );
    const data = await streamToBuffer(readable);

    return { data, contentType: file.contentType };
  }

  async getExternalFileStream(storageKey: string): Promise<{ data: Buffer; contentType: string }> {
    try {
      const [readable, stat] = await Promise.all([
        this.minioClient('public').getObject(storageKey),
        this.prisma.staticFile.findFirst({
          select: { contentType: true },
          where: { storageKey, deletedAt: null },
        }),
      ]);
      const data = await streamToBuffer(readable);
      return { data, contentType: stat?.contentType ?? 'application/octet-stream' };
    } catch (error) {
      // Check if it's the Minio S3Error for key not found
      if (
        error?.code === 'NoSuchKey' ||
        error?.message?.includes('The specified key does not exist')
      ) {
        throw new NotFoundException(`File with key ${storageKey} not found`);
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Generates image URLs based on storage keys and configured payload mode
   * @param storageKeys - Array of storage keys for the images
   * @returns Array of URLs (either base64 or regular URLs depending on config)
   */
  async generateImageUrls(user: User, storageKeys: string[]): Promise<string[]> {
    if (!Array.isArray(storageKeys) || storageKeys.length === 0) {
      return [];
    }

    const staticEndpoint = this.config.get('static.public.endpoint')?.replace(/\/$/, '');

    let imageMode = this.config.get('image.payloadMode');
    if (imageMode === 'url' && !staticEndpoint) {
      this.logger.warn('Public static endpoint is not configured, fallback to base64 mode');
      imageMode = 'base64';
    }

    this.logger.log(`Generating image URLs in ${imageMode} mode for ${storageKeys.length} images`);

    const files = await this.prisma.staticFile.findMany({
      select: {
        storageKey: true,
        processedImageKey: true,
        visibility: true,
      },
      where: {
        uid: user.uid,
        storageKey: { in: storageKeys },
      },
    });

    try {
      if (imageMode === 'base64') {
        const urls = await Promise.all(
          files.map(async (file) => {
            const visibility = file.visibility as FileVisibility;
            const storageKey = file.processedImageKey || file.storageKey;

            try {
              const data = await this.minioClient(visibility).getObject(storageKey);
              const chunks: Buffer[] = [];

              for await (const chunk of data) {
                chunks.push(chunk);
              }

              const buffer = Buffer.concat(chunks);
              const base64 = buffer.toString('base64');
              const contentType = await this.minioClient(visibility)
                .statObject(storageKey)
                .then((stat) => stat.metaData?.['content-type'] ?? 'image/jpeg');

              return `data:${contentType};base64,${base64}`;
            } catch (error) {
              this.logger.error(`Failed to generate base64 for key ${storageKey}: ${error.stack}`);
              return '';
            }
          }),
        );
        return urls.filter(Boolean);
      }

      // URL mode
      return await Promise.all(
        files.map(async (file) => {
          const visibility = file.visibility as FileVisibility;
          const storageKey = file.processedImageKey || file.storageKey;

          // For public files, use the static endpoint
          if (visibility === 'public') {
            return `${staticEndpoint}/${storageKey}`;
          }

          // For private files, generate a signed URL that expires in given time
          try {
            const signedUrl = await this.minioClient(visibility).presignedGetObject(
              storageKey,
              this.config.get('image.presignExpiry'),
            );
            return signedUrl;
          } catch (error) {
            this.logger.error(
              `Failed to generate signed URL for key ${storageKey}: ${error.stack}`,
            );
            return '';
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error generating image URLs:', error);
      return [];
    }
  }

  /**
   * Clean up orphaned static files that are older than one day and have no entity association
   */
  async cleanOrphanedStaticFiles(): Promise<void> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Find orphaned files
    const orphanedFiles = await this.prisma.staticFile.findMany({
      where: {
        entityId: null,
        entityType: null,
        createdAt: {
          lt: oneDayAgo,
        },
        deletedAt: null,
      },
      select: {
        pk: true,
        storageKey: true,
        processedImageKey: true,
        visibility: true,
      },
    });

    if (orphanedFiles.length === 0) {
      this.logger.log('No orphaned files found to clean up');
      return;
    }

    this.logger.log(`Found ${orphanedFiles.length} orphaned files to clean up`);

    // Collect all storage keys to delete (including processed images)
    const objectsToDelete = orphanedFiles.reduce<
      { storageKey: string; visibility: FileVisibility }[]
    >((acc, file) => {
      acc.push({ storageKey: file.storageKey, visibility: file.visibility as FileVisibility });
      if (file.processedImageKey) {
        acc.push({
          storageKey: file.processedImageKey,
          visibility: file.visibility as FileVisibility,
        });
      }
      return acc;
    }, []);

    // Delete files from storage
    await this.batchRemoveObjects(null, objectsToDelete);

    // Mark files as deleted in database
    await this.prisma.staticFile.updateMany({
      where: { pk: { in: orphanedFiles.map((file) => file.pk) } },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Successfully cleaned up ${orphanedFiles.length} orphaned files`);
  }

  async convert(param: { content: string; from: string; to: string }): Promise<string> {
    const { content, from, to } = param;
    const parser = new PandocParser({
      format: from,
      extractMedia: false,
    });

    try {
      const result = await parser.parse(content);
      return result.content ?? '';
    } catch (error) {
      this.logger.error(`Convert from ${from} to ${to} failed: ${error?.stack}`);
      throw error;
    }
  }

  async duplicateFile(param: {
    sourceFile: FileObject;
    targetFile: FileObject;
  }) {
    const { sourceFile, targetFile } = param;

    if (!sourceFile) {
      throw new NotFoundException(`File with key ${sourceFile?.storageKey} not found`);
    }

    if (!targetFile) {
      throw new ParamsError('Target file information is required');
    }

    try {
      // Use the appropriate Minio service based on visibility
      const minioService = sourceFile.visibility === 'public' ? this.externalOss : this.internalOss;

      // Use the duplicateFile method from MinioService instead of copyObject
      await minioService.duplicateFile(sourceFile.storageKey, targetFile.storageKey);

      this.logger.log(
        `Successfully duplicated file from ${sourceFile.storageKey} to ${targetFile.storageKey}`,
      );
    } catch (error) {
      this.logger.error(`Duplicate file failed: ${error?.stack}`);
      throw error; // Re-throw the error to properly handle it upstream
    }
  }

  /**
   * Duplicates all files associated with an entity for a different user
   * Only creates new database records, doesn't duplicate the actual files in storage
   *
   * @param user - The user who will own the duplicated files
   * @param param - Parameters specifying source entity and optional target entity
   * @returns Object containing counts of files processed and duplicated
   */
  async duplicateFilesNoCopy(
    user: User,
    param: {
      sourceEntityId: string;
      sourceEntityType: EntityType;
      sourceUid: string;
      targetEntityId?: string;
      targetEntityType?: EntityType;
    },
  ): Promise<{ total: number; duplicated: number }> {
    const {
      sourceEntityId,
      sourceEntityType,
      sourceUid,
      targetEntityId = sourceEntityId,
      targetEntityType = sourceEntityType,
    } = param;

    if (sourceUid === user.uid) {
      this.logger.log('Source and target users are the same, skipping duplication');
      return { total: 0, duplicated: 0 };
    }

    this.logger.log(
      `Duplicating files from entity ${sourceEntityId} (${sourceEntityType}) to entity ${targetEntityId} (${targetEntityType}) for user ${user.uid}`,
    );

    // Find all files associated with the source entity
    const files = await this.prisma.staticFile.findMany({
      where: {
        entityId: sourceEntityId,
        entityType: sourceEntityType,
        uid: sourceUid ?? { not: user.uid }, // If sourceUid is provided, use it; otherwise exclude files already owned by the target user
        deletedAt: null,
        visibility: 'private', // only duplicate private files
      },
    });

    if (!files?.length) {
      this.logger.log('No files found to duplicate');
      return { total: 0, duplicated: 0 };
    }

    // Find all existing duplicates in a single query to avoid multiple DB hits
    const existingDuplicates = await this.prisma.staticFile.findMany({
      where: {
        uid: user.uid,
        storageKey: { in: files.map((file) => file.storageKey) },
        entityId: targetEntityId,
        entityType: targetEntityType,
        deletedAt: null,
      },
      select: {
        storageKey: true,
      },
    });

    // Create a set of existing storage keys for efficient lookup
    const existingStorageKeys = new Set(existingDuplicates?.map((file) => file.storageKey) ?? []);

    // Prepare batch insert data
    const filesToCreate = files
      .filter((file) => !existingStorageKeys.has(file.storageKey))
      .map((file) => ({
        ...omit(file, ['pk', 'uid', 'entityId', 'entityType', 'createdAt', 'updatedAt']),
        uid: user.uid,
        entityId: targetEntityId,
        entityType: targetEntityType,
      }));

    let duplicatedCount = 0;
    if (filesToCreate?.length > 0) {
      // Batch insert all new files at once
      const result = await this.prisma.staticFile.createMany({
        data: filesToCreate,
        // skipDuplicates: true, // As an extra precaution against duplicates
      });
      duplicatedCount = result.count;
    }

    this.logger.log(`Duplicated ${duplicatedCount} out of ${files.length} files`);
    return { total: files.length, duplicated: duplicatedCount };
  }

  /**
   * Process content images and replace them with public URLs
   * @param content - The content to process
   * @returns The processed content with public URLs
   */
  async processContentImages(content: string) {
    // Extract all markdown image references: ![alt](url)
    const images = content?.match(/!\[.*?\]\((.*?)\)/g);
    if (!images?.length) {
      return content;
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations

    const privateStaticEndpoint = this.config.get('static.private.endpoint')?.replace(/\/$/, '');

    // Create an array to store all image processing operations and their results
    const imageProcessingTasks = images.map((imageRef) => {
      return limit(async () => {
        // Extract the URL from the markdown image syntax
        const urlMatch = imageRef.match(/!\[.*?\]\((.*?)\)/);
        if (!urlMatch?.[1]) return null;

        const originalUrl = urlMatch[1];

        // Extract the storage key only if private
        if (!originalUrl.startsWith(privateStaticEndpoint)) return null;

        const storageKey = originalUrl.replace(`${privateStaticEndpoint}/`, '');
        if (!storageKey) return null;

        try {
          // Publish the file to public bucket
          const publicUrl = await this.publishFile(storageKey);

          // Return info needed for replacement
          return {
            originalImageRef: imageRef,
            originalUrl,
            publicUrl,
          };
        } catch (error) {
          this.logger.error(`Failed to publish image for storageKey: ${storageKey}`, error);
          return null;
        }
      });
    });

    // Wait for all image processing tasks to complete
    const processedImages = await Promise.all(imageProcessingTasks);

    // Apply all replacements to the content
    let updatedContent = content;
    for (const result of processedImages) {
      if (result) {
        const { originalImageRef, originalUrl, publicUrl } = result;
        const newImageRef = originalImageRef.replace(originalUrl, publicUrl);
        updatedContent = updatedContent.replace(originalImageRef, newImageRef);
      }
    }

    return updatedContent;
  }
}
