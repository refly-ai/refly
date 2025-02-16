import {
  Inject,
  Injectable,
  StreamableFile,
  Logger,
  OnModuleInit,
  NotFoundException,
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
} from '@refly-packages/openapi-schema';
import { PrismaService } from '@/common/prisma.service';
import { MINIO_EXTERNAL, MINIO_INTERNAL, MinioService } from '@/common/minio.service';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { scrapeWeblink } from '@refly-packages/utils';
import { QUEUE_IMAGE_PROCESSING, QUEUE_CLEAN_STATIC_FILES, streamToBuffer } from '@/utils';
import {
  CanvasNotFoundError,
  ParamsError,
  ResourceNotFoundError,
  DocumentNotFoundError,
} from '@refly-packages/errors';
import { FileObject } from '@/misc/misc.dto';
import { createId } from '@paralleldrive/cuid2';
import { ParserFactory } from '@/knowledge/parsers/factory';

@Injectable()
export class MiscService implements OnModuleInit {
  private logger = new Logger(MiscService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(MINIO_EXTERNAL) private externalMinio: MinioService,
    @Inject(MINIO_INTERNAL) private internalMinio: MinioService,
    @InjectQueue(QUEUE_IMAGE_PROCESSING) private imageQueue: Queue<FileObject>,
    @InjectQueue(QUEUE_CLEAN_STATIC_FILES) private cleanStaticFilesQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.setupCleanStaticFilesCronjob();
  }

  private async setupCleanStaticFilesCronjob() {
    const existingJobs = await this.cleanStaticFilesQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.cleanStaticFilesQueue.removeJobScheduler(job.id)),
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
    } else {
      throw new ParamsError(`Invalid entity type: ${entityType}`);
    }
  }

  minioClient(visibility: FileVisibility) {
    if (visibility === 'public') {
      return this.externalMinio.client;
    }
    return this.internalMinio.client;
  }

  async batchRemoveObjects(objects: FileObject[]) {
    const objectMap = new Map<FileVisibility, Set<string>>();
    for (const fo of objects) {
      const { visibility, storageKey } = fo;
      if (!objectMap.has(visibility)) {
        objectMap.set(visibility, new Set());
      }
      objectMap.get(visibility)?.add(storageKey);
    }

    await Promise.all(
      Array.from(objectMap.entries()).map(([visibility, storageKeys]) =>
        this.minioClient(visibility).removeObjects(Array.from(storageKeys)),
      ),
    );
  }

  generateFileURL(object: FileObject) {
    const { visibility, storageKey } = object;

    let endpoint = '';
    if (visibility === 'public') {
      endpoint = this.config.get<string>('staticEndpoint')?.replace(/\/$/, '');
    } else {
      endpoint = `${this.config.get<string>('endpoint')}/v1/misc`;
    }

    return `${endpoint}/${storageKey}`;
  }

  async uploadBuffer(
    user: User,
    param: {
      fpath: string;
      buf: Buffer;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
    },
  ): Promise<UploadResponse['data']> {
    const { fpath, buf, entityId, entityType, visibility = 'private' } = param;
    const objectKey = randomUUID();
    const fileExtension = path.extname(fpath);
    const storageKey = `static/${objectKey}${fileExtension}`;
    const contentType = mime.getType(fpath) ?? 'application/octet-stream';

    await this.prisma.staticFile.create({
      data: {
        uid: user.uid,
        storageKey,
        storageSize: buf.length,
        entityId,
        entityType,
        contentType,
      },
    });

    await this.minioClient(visibility).putObject(storageKey, buf, {
      'Content-Type': contentType,
    });

    // Resize and convert to webp if it's an image
    if (contentType?.startsWith('image/')) {
      await this.imageQueue.add('resizeAndConvert', { storageKey, visibility });
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
    },
  ): Promise<UploadResponse['data']> {
    const { file, entityId, entityType, visibility = 'private' } = param;

    if (entityId && entityType) {
      await this.checkEntity(user, entityId, entityType);
    }

    const objectKey = randomUUID();
    const extension = path.extname(file.originalname);
    const contentType = mime.getType(extension) ?? file.mimetype ?? 'application/octet-stream';
    const storageKey = `static/${objectKey}${extension}`;

    await this.prisma.staticFile.create({
      data: {
        uid: user.uid,
        storageKey,
        storageSize: file.buffer.length,
        entityId,
        entityType,
        contentType,
        visibility,
      },
    });

    await this.minioClient(visibility).putObject(storageKey, file.buffer, {
      'Content-Type': contentType,
    });

    // Resize and convert to webp if it's an image
    if (contentType?.startsWith('image/')) {
      await this.imageQueue.add('resizeAndConvert', { storageKey, visibility });
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

  async getInternalFileStream(user: User, storageKey: string): Promise<StreamableFile> {
    const file = await this.prisma.staticFile.findFirst({
      where: { uid: user.uid, storageKey, deletedAt: null },
    });
    if (!file) {
      throw new NotFoundException();
    }
    const data = await this.minioClient(file.visibility as FileVisibility).getObject(storageKey);
    return new StreamableFile(data);
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

    let imageMode = this.config.get('image.payloadMode');
    if (imageMode === 'url' && !this.config.get('staticEndpoint')) {
      this.logger.warn('Static endpoint is not configured, fallback to base64 mode');
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
      const staticEndpoint = this.config.get('staticEndpoint')?.replace(/\/$/, '') ?? '';
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
    const storageKeysToDelete = orphanedFiles.reduce<
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
    await this.batchRemoveObjects(storageKeysToDelete);

    // Mark files as deleted in database
    await this.prisma.staticFile.updateMany({
      where: { pk: { in: orphanedFiles.map((file) => file.pk) } },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Successfully cleaned up ${orphanedFiles.length} orphaned files`);
  }

  async convert(param: { content: string; from: string; to: string }): Promise<string> {
    const { content, from, to } = param;
    const parserFactory = new ParserFactory(this.config);
    const parser = parserFactory.createParser('pandoc', {
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
}
