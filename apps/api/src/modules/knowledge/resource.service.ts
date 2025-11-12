import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import pdf from 'pdf-parse';
import pLimit from 'p-limit';
import crypto from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import normalizeUrl from 'normalize-url';
import { readingTime } from 'reading-time-estimator';
import {
  Prisma,
  Resource as ResourceModel,
  StaticFile as StaticFileModel,
  User as UserModel,
} from '../../generated/client';
import { RAGService } from '../rag/rag.service';
import { PrismaService } from '../common/prisma.service';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';
import {
  UpsertResourceRequest,
  ResourceMeta,
  ListResourcesData,
  User,
  GetResourceDetailData,
  ReindexResourceRequest,
  ResourceType,
  DuplicateResourceRequest,
  IndexError,
} from '@refly/openapi-schema';
import {
  QUEUE_SIMPLE_EVENT,
  QUEUE_RESOURCE,
  streamToString,
  QUEUE_CLEAR_CANVAS_ENTITY,
  QUEUE_POST_DELETE_KNOWLEDGE_ENTITY,
  pick,
  streamToBuffer,
} from '../../utils';
import { genResourceID, cleanMarkdownForIngest, safeParseJSON } from '@refly/utils';
import { ResourcePrepareResult, FinalizeResourceParam } from './knowledge.dto';
import { SimpleEventData } from '../event/event.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { MiscService } from '../misc/misc.service';
import {
  StorageQuotaExceeded,
  ResourceNotFoundError,
  ParamsError,
  CanvasNotFoundError,
  ProjectNotFoundError,
} from '@refly/errors';
import { DeleteCanvasNodesJobData } from '../canvas/canvas.dto';
import { ParserFactory } from '../knowledge/parsers/factory';
import { ConfigService } from '@nestjs/config';
import { ParseResult, ParserOptions } from './parsers/base';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { ProviderService } from '../provider/provider.service';
import { PostDeleteKnowledgeEntityJobData } from './knowledge.dto';

const MEDIA_RESOURCE_TYPES: ResourceType[] = ['image', 'video', 'audio'];

@Injectable()
export class ResourceService {
  private logger = new Logger(ResourceService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ragService: RAGService,
    private miscService: MiscService,
    private providerService: ProviderService,
    private subscriptionService: SubscriptionService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private fts: FulltextSearchService,
    @Optional() @InjectQueue(QUEUE_RESOURCE) private queue?: Queue<FinalizeResourceParam>,
    @Optional() @InjectQueue(QUEUE_SIMPLE_EVENT) private simpleEventQueue?: Queue<SimpleEventData>,
    @Optional()
    @InjectQueue(QUEUE_CLEAR_CANVAS_ENTITY)
    private canvasQueue?: Queue<DeleteCanvasNodesJobData>,
    @Optional()
    @InjectQueue(QUEUE_POST_DELETE_KNOWLEDGE_ENTITY)
    private postDeleteKnowledgeQueue?: Queue<PostDeleteKnowledgeEntityJobData>,
  ) {}

  async listResources(user: User, param: ListResourcesData['query']) {
    const {
      resourceId,
      resourceType,
      projectId,
      canvasId,
      page = 1,
      pageSize = 10,
      order = 'creationDesc',
    } = param;

    const resourceIdFilter: Prisma.StringFilter<'Resource'> = { equals: resourceId };

    const resources = await this.prisma.resource.findMany({
      where: {
        resourceId: resourceIdFilter,
        resourceType,
        uid: user.uid,
        deletedAt: null,
        projectId,
        canvasId,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { pk: order === 'creationAsc' ? 'asc' : 'desc' },
    });

    return resources.map((resource) => ({
      ...resource,
      downloadURL: resource.rawFileKey
        ? this.miscService.generateFileURL({ storageKey: resource.rawFileKey }, { download: true })
        : undefined,
    }));
  }

  async getResourceDetail(user: User, param: GetResourceDetailData['query']) {
    const { resourceId, genPublicUrl } = param;

    if (!resourceId) {
      throw new ParamsError('Resource ID is required');
    }

    const resource = await this.prisma.resource.findFirst({
      where: {
        resourceId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!resource) {
      throw new ResourceNotFoundError(`resource ${resourceId} not found`);
    }

    let content: string;
    if (resource.storageKey) {
      const contentStream = await this.oss.getObject(resource.storageKey);
      content = await streamToString(contentStream);
    }

    const downloadURL = this.miscService.generateFileURL({
      storageKey: resource.rawFileKey,
    });

    const resourceDetail = { ...resource, content, downloadURL, publicURL: undefined };

    if (genPublicUrl && resource.rawFileKey) {
      resourceDetail.publicURL = await this.miscService.generateTempPublicURL(resource.rawFileKey);
    }

    return resourceDetail;
  }

  async prepareResource(user: User, param: UpsertResourceRequest): Promise<ResourcePrepareResult> {
    const { resourceType, content, data } = param;

    let identifier: string;
    let staticFile: StaticFileModel | null = null;
    let staticFileBuf: Buffer | null = null;

    if (resourceType === 'text') {
      if (!content) {
        throw new ParamsError('content is required for text resource');
      }
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      identifier = `text://${sha}`;
    } else if (resourceType === 'weblink') {
      if (!data?.url) {
        throw new ParamsError('URL is required for weblink resource');
      }
      identifier = normalizeUrl(param.data.url, { stripHash: true });
    } else if (resourceType === 'file' || resourceType === 'document') {
      if (!param.storageKey) {
        throw new ParamsError('storageKey is required for file resource');
      }
      staticFile = await this.prisma.staticFile.findFirst({
        where: {
          storageKey: param.storageKey,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!staticFile) {
        throw new ParamsError(`static file ${param.storageKey} not found`);
      }
      const sha = crypto.createHash('sha256');
      const fileStream = await this.oss.getObject(staticFile.storageKey);

      staticFileBuf = await streamToBuffer(fileStream);

      sha.update(staticFileBuf);
      identifier = `file://${sha.digest('hex')}`;
    } else if (MEDIA_RESOURCE_TYPES.includes(resourceType)) {
      if (!param.storageKey) {
        throw new ParamsError('storageKey is required for media resource');
      }
      staticFile = await this.prisma.staticFile.findFirst({
        where: {
          storageKey: param.storageKey,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!staticFile) {
        throw new ParamsError(`static file ${param.storageKey} not found`);
      }
      const sha = crypto.createHash('sha256');
      const fileStream = await this.oss.getObject(staticFile.storageKey);

      staticFileBuf = await streamToBuffer(fileStream);

      sha.update(staticFileBuf);
      identifier = `media://${sha.digest('hex')}`;
    } else {
      throw new ParamsError('Invalid resource type');
    }

    if (content) {
      // save content to object storage
      const storageKey = `resources/${param.resourceId}.txt`;
      await this.oss.putObject(storageKey, content);
      const storageSize = (await this.oss.statObject(storageKey)).size;

      return {
        storageKey,
        storageSize,
        identifier,
        indexStatus: 'wait_index', // skip parsing stage, since content is provided
        contentPreview: content.slice(0, 500),
      };
    }

    if (resourceType === 'weblink') {
      return {
        identifier,
        indexStatus: 'wait_parse',
        metadata: {
          ...param.data,
          url: identifier,
        },
      };
    }

    if (MEDIA_RESOURCE_TYPES.includes(resourceType)) {
      return {
        identifier,
        indexStatus: 'finish', // Media resources don't need parsing or indexing
        staticFile,
        metadata: {
          ...param.data,
          contentType: staticFile.contentType,
        },
      };
    }

    // must be file resource
    return {
      identifier,
      indexStatus: 'wait_parse',
      staticFile,
      metadata: {
        ...param.data,
        contentType: staticFile.contentType,
      },
    };
  }

  async createResource(
    user: User,
    param: UpsertResourceRequest,
    options?: {
      checkStorageQuota?: boolean;
      syncStorageUsage?: boolean;
      skipCanvasCheck?: boolean;
    },
  ) {
    if (options?.checkStorageQuota) {
      const usageResult = await this.subscriptionService.checkStorageUsage(user);
      if (usageResult.available < 1) {
        throw new StorageQuotaExceeded();
      }
    }

    if (param.canvasId && !options?.skipCanvasCheck) {
      await this.checkCanvasExists(user, param.canvasId);
    }

    if (param.projectId) {
      await this.checkProjectExists(user, param.projectId);
    }

    if (param.resourceId) {
      const existingResource = await this.prisma.resource.findFirst({
        where: { resourceId: param.resourceId },
      });
      if (existingResource) {
        throw new ParamsError(`Resource ${param.resourceId} already exists`);
      }
    } else {
      param.resourceId = genResourceID();
    }

    if (param.content) {
      param.content = param.content.replace(/x00/g, '');
    }

    const {
      identifier,
      indexStatus,
      contentPreview,
      storageKey,
      storageSize,
      staticFile,
      metadata,
    } = await this.prepareResource(user, param);

    const resource = await this.prisma.resource.create({
      data: {
        resourceId: param.resourceId,
        identifier,
        resourceType: param.resourceType,
        meta: JSON.stringify({ ...param.data, ...metadata }),
        contentPreview,
        storageKey,
        storageSize,
        rawFileKey: staticFile?.storageKey,
        projectId: param.projectId,
        canvasId: param.canvasId,
        uid: user.uid,
        title: param.title || '',
        indexStatus,
      },
    });

    // Update static file entity reference
    if (staticFile) {
      await this.prisma.staticFile.update({
        where: { pk: staticFile.pk },
        data: { entityId: resource.resourceId, entityType: 'resource' },
      });
    }

    // Sync storage usage
    if (options?.syncStorageUsage) {
      await this.subscriptionService.syncStorageUsage(user);
    }

    // Add to queue to be processed by worker
    await this.queue?.add('finalizeResource', {
      resourceId: resource.resourceId,
      uid: user.uid,
    });

    return resource;
  }

  async batchCreateResource(user: User, params: UpsertResourceRequest[]) {
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < params.length) {
      throw new StorageQuotaExceeded();
    }

    const limit = pLimit(5);
    const tasks = params.map((param) => limit(async () => await this.createResource(user, param)));
    const resources = await Promise.all(tasks);

    await this.subscriptionService.syncStorageUsage(user);

    return resources;
  }

  /**
   * Process images in the markdown content and replace them with uploaded URLs.
   * 1) if the imagePath is present in parse result, replace it with uploaded path
   * 2) if the imagePath is a URL, download the image and upload it to Minio
   * 3) if the imagePath is a base64 string, convert it to buffer and upload it to Minio
   */
  private async processContentImages(user: User, result: ParseResult, resourceId: string) {
    const { content, images = {} } = result;
    if (!content) {
      return content;
    }

    // Regular expression to find markdown image links
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const uploadedImages: Record<string, string> = {};

    // Upload all images from parse result to Minio
    for (const [imagePath, imageBuffer] of Object.entries(images)) {
      try {
        const { url } = await this.miscService.uploadBuffer(user, {
          fpath: imagePath,
          buf: imageBuffer,
          entityId: resourceId,
          entityType: 'resource',
          visibility: 'public',
        });
        uploadedImages[imagePath] = url;
      } catch (error) {
        this.logger.error(`Failed to upload image ${imagePath}: ${error?.stack}`);
      }
    }

    // Find all image matches in the content
    const matches = Array.from(content.matchAll(imageRegex));
    this.logger.log(`Found ${matches.length} images in content`);

    let lastIndex = 0;
    let modifiedContent = '';

    // Process each match sequentially
    for (const match of matches) {
      const [fullMatch, altText, imagePath] = match;
      const matchIndex = match.index ?? 0;

      // Add text between matches
      modifiedContent += content.slice(lastIndex, matchIndex);
      lastIndex = matchIndex + fullMatch.length;

      try {
        // If we already have an uploaded version of this image, use its URL
        if (uploadedImages[imagePath]) {
          modifiedContent += `![${altText}](${uploadedImages[imagePath]})`;
          continue;
        }

        // Handle URL images
        if (imagePath.startsWith('http')) {
          try {
            const { url } = await this.miscService.dumpFileFromURL(user, {
              url: imagePath,
              entityId: resourceId,
              entityType: 'resource',
            });
            modifiedContent += `![${altText}](${url})`;
          } catch (error) {
            this.logger.error(`Failed to dump image from URL ${imagePath}: ${error?.stack}`);
            modifiedContent += fullMatch;
          }
          continue;
        }

        // Handle base64 images
        if (imagePath.startsWith('data:')) {
          // Skip inline SVG images, since they tend to be icons for interactive elements
          if (imagePath.includes('data:image/svg+xml')) {
            continue;
          }

          try {
            // Extract mime type and base64 data
            const [mimeHeader, base64Data] = imagePath.split(',');
            if (!base64Data) {
              modifiedContent += fullMatch;
              continue;
            }

            const mimeType = mimeHeader.match(/data:(.*?);/)?.[1];
            if (!mimeType || !mimeType.startsWith('image/')) {
              modifiedContent += fullMatch;
              continue;
            }

            // Generate a unique filename based on mime type
            const ext = mimeType.split('/')[1];
            const filename = `${crypto.randomUUID()}.${ext}`;

            // Convert base64 to buffer and upload
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const { url } = await this.miscService.uploadBuffer(user, {
              fpath: filename,
              buf: imageBuffer,
              entityId: resourceId,
              entityType: 'resource',
              visibility: 'public',
            });

            modifiedContent += `![${altText}](${url})`;
          } catch (error) {
            this.logger.error(`Failed to process base64 image: ${error?.stack}`);
            modifiedContent += fullMatch;
          }
          continue;
        }

        // If none of the above conditions match, keep the original
        modifiedContent += fullMatch;
      } catch (error) {
        this.logger.error(`Failed to process image ${imagePath}: ${error?.stack}`);
        modifiedContent += fullMatch;
      }
    }

    // Add any remaining content after the last match
    modifiedContent += content.slice(lastIndex);

    return modifiedContent;
  }

  /**
   * Check if the canvas exists
   */
  async checkCanvasExists(user: User, canvasId: string) {
    const canvas = await this.prisma.canvas.findUnique({
      select: { pk: true },
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }
  }

  /**
   * Check if the project exists
   */
  async checkProjectExists(user: User, projectId: string) {
    const project = await this.prisma.project.findUnique({
      select: { pk: true },
      where: { projectId, uid: user.uid, deletedAt: null },
    });
    if (!project) {
      throw new ProjectNotFoundError();
    }
  }

  /**
   * Parse resource content from remote URL into markdown.
   * Currently only weblinks are supported.
   */
  async parseResource(user: UserModel, resource: ResourceModel): Promise<ResourceModel> {
    if (resource.indexStatus !== 'wait_parse' && resource.indexStatus !== 'parse_failed') {
      this.logger.warn(
        `Resource ${resource.resourceId} is not in wait_parse or parse_failed status, skip parse`,
      );
      return resource;
    }

    // Skip parsing for media resources
    if (MEDIA_RESOURCE_TYPES.includes(resource.resourceType as ResourceType)) {
      this.logger.log(`Resource ${resource.resourceId} is a media resource, skip parsing`);
      return resource;
    }

    const { resourceId, resourceType, rawFileKey, meta } = resource;
    const { url, contentType } = safeParseJSON(meta) as ResourceMeta;

    const parserFactory = new ParserFactory(this.config, this.providerService);
    const parserOptions: ParserOptions = { resourceId };

    let result: ParseResult;

    if (resourceType === 'weblink') {
      const parser = await parserFactory.createWebParser(user, parserOptions);
      result = await parser.parse(url);
    } else if (rawFileKey) {
      const parser = await parserFactory.createDocumentParser(user, contentType, parserOptions);
      const fileStream = await this.oss.getObject(rawFileKey);
      const fileBuffer = await streamToBuffer(fileStream);

      let numPages = 0;
      if (contentType === 'application/pdf') {
        const { numpages } = await pdf(fileBuffer);
        numPages = numpages;

        const { available, pageUsed, pageLimit } =
          await this.subscriptionService.checkFileParseUsage(user);

        if (numPages > available) {
          this.logger.log(
            `Resource ${resourceId} parse failed due to page limit, numpages: ${numPages}, available: ${available}`,
          );
          return this.prisma.resource.update({
            where: { resourceId },
            data: {
              indexStatus: 'parse_failed',
              indexError: JSON.stringify({
                type: 'pageLimitExceeded',
                metadata: { numPages, pageLimit, pageUsed },
              } as IndexError),
            },
          });
        }
      }
      result = await parser.parse(fileBuffer);

      await this.prisma.fileParseRecord.create({
        data: {
          resourceId,
          uid: user.uid,
          contentType,
          storageKey: rawFileKey,
          parser: parser.name,
          numPages,
        },
      });
    } else {
      throw new Error(`Cannot parse resource ${resourceId} with no content or rawFileKey`);
    }

    if (result.error) {
      throw new Error(`Parse resource ${resourceId} failed: ${result.error}`);
    }

    this.logger.log(
      `Parse resource ${resourceId} success, images: ${Object.keys(result.images ?? {})}`,
    );

    result.content = await this.processContentImages(user, result, resourceId);

    const content = result.content?.replace(/x00/g, '') || '';
    const title = result.title || resource.title;

    const storageKey = `resources/${resourceId}.txt`;
    await this.oss.putObject(storageKey, content);

    const updatedResource = await this.prisma.resource.update({
      where: { resourceId, uid: user.uid },
      data: {
        storageKey,
        storageSize: (await this.oss.statObject(storageKey)).size,
        wordCount: readingTime(content).words,
        title,
        indexStatus: 'wait_index',
        contentPreview: content?.slice(0, 500),
        meta: JSON.stringify({
          url,
          title,
          contentType,
        } as ResourceMeta),
      },
    });

    await this.fts.upsertDocument(user, 'resource', {
      id: resourceId,
      content,
      url,
      createdAt: resource.createdAt.toJSON(),
      updatedAt: resource.updatedAt.toJSON(),
      ...pick(updatedResource, ['title', 'uid', 'projectId']),
    });

    return updatedResource;
  }

  /**
   * Index resource content into vector store.
   */
  async indexResource(user: User, resource: ResourceModel): Promise<ResourceModel> {
    if (resource.indexStatus !== 'wait_index' && resource.indexStatus !== 'index_failed') {
      this.logger.warn(`Resource ${resource.resourceId} is not in wait_index status, skip index`);
      return resource;
    }

    const { resourceType, resourceId, meta, storageKey } = resource;
    const { url, title } = safeParseJSON(meta) as ResourceMeta;
    const updates: Prisma.ResourceUpdateInput = {
      indexStatus: 'finish',
    };

    if (storageKey) {
      const contentStream = await this.oss.getObject(storageKey);
      const content = await streamToString(contentStream);

      const { size } = await this.ragService.indexDocument(user, {
        pageContent: cleanMarkdownForIngest(content),
        metadata: {
          nodeType: 'resource',
          url,
          title,
          resourceType: resourceType as ResourceType,
          resourceId,
          projectId: resource.projectId,
        },
      });
      updates.vectorSize = size;

      this.logger.log(
        `save resource segments for user ${user.uid} success, resourceId: ${resourceId}`,
      );
    }

    return this.prisma.resource.update({
      where: { resourceId, uid: user.uid },
      data: updates,
    });
  }

  /**
   * Process resource after being inserted, including scraping actual content, chunking and
   * save embeddings to vector store.
   */
  async finalizeResource(param: FinalizeResourceParam): Promise<ResourceModel | null> {
    const { resourceId, uid } = param;

    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      this.logger.warn(`User not found, userId: ${uid}`);
      return null;
    }

    let resource = await this.prisma.resource.findFirst({
      where: { resourceId, uid: user.uid },
    });
    if (!resource) {
      this.logger.warn(`Resource not found, resourceId: ${resourceId}`);
      return null;
    }

    try {
      resource = await this.parseResource(user, resource);
    } catch (err) {
      this.logger.error(`parse resource error: ${err?.stack}`);
      return this.prisma.resource.update({
        where: { resourceId, uid: user.uid },
        data: {
          indexStatus: 'parse_failed',
          indexError: JSON.stringify({ type: 'unknownError' } as IndexError),
        },
      });
    }

    try {
      resource = await this.indexResource(user, resource);
    } catch (err) {
      this.logger.error(`index resource error: ${err?.stack}`);
      return this.prisma.resource.update({
        where: { resourceId, uid: user.uid },
        data: {
          indexStatus: 'index_failed',
          indexError: JSON.stringify({ type: 'unknownError' } as IndexError),
        },
      });
    }

    // Send simple event
    if (resource.indexStatus === 'finish') {
      await this.simpleEventQueue?.add('simpleEvent', {
        entityType: 'resource',
        entityId: resourceId,
        name: 'onResourceReady',
        uid: user.uid,
      });
    }

    // Sync storage usage
    await this.subscriptionService.syncStorageUsage(user);

    return resource;
  }

  async updateResource(
    user: User,
    param: UpsertResourceRequest,
    options?: { waitFor: 'parse_completed' | 'completed' },
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { resourceId: param.resourceId, uid: user.uid },
    });
    if (!resource) {
      throw new ResourceNotFoundError(`resource ${param.resourceId} not found`);
    }

    // Use prepareResource to determine updated resource fields
    const {
      identifier,
      indexStatus,
      contentPreview,
      storageKey,
      storageSize,
      staticFile,
      metadata,
    } = await this.prepareResource(user, param);

    const updates: Prisma.ResourceUpdateInput = {
      title: param.title,
      identifier,
      indexStatus,
      contentPreview,
      storageKey,
      storageSize,
      rawFileKey: staticFile?.storageKey,
    };

    // If identifier is the same, we don't need to reindex
    if (resource.identifier === identifier) {
      updates.indexStatus = undefined;
    }

    // Merge metadata with existing data if provided
    if (metadata || param.data) {
      const existingMeta = safeParseJSON(resource.meta || '{}');
      updates.meta = JSON.stringify({ ...existingMeta, ...metadata, ...param.data });
    }

    if (param.projectId !== undefined) {
      if (param.projectId) {
        updates.project = { connect: { projectId: param.projectId } };
      } else {
        updates.project = { disconnect: true };
      }
    }

    if (param.canvasId !== undefined) {
      if (param.canvasId) {
        updates.canvas = { connect: { canvasId: param.canvasId } };
      } else {
        updates.canvas = { disconnect: true };
      }
    }

    this.logger.log(`update resource ${param.resourceId} with updates: ${JSON.stringify(updates)}`);

    const updatedResource = await this.prisma.resource.update({
      where: { resourceId: param.resourceId, uid: user.uid },
      data: updates,
    });

    // Update static file entity reference for file resources
    if (staticFile) {
      await this.prisma.staticFile.update({
        where: { pk: staticFile.pk },
        data: { entityId: resource.resourceId, entityType: 'resource' },
      });
    }

    // Update projectId for vector store
    if (param.projectId !== undefined) {
      await this.ragService.updateDocumentPayload(user, {
        resourceId: updatedResource.resourceId,
        metadata: { projectId: param.projectId },
      });
    }

    await this.fts.upsertDocument(user, 'resource', {
      id: updatedResource.resourceId,
      content: param.content || undefined,
      createdAt: updatedResource.createdAt.toJSON(),
      updatedAt: updatedResource.updatedAt.toJSON(),
      ...pick(updatedResource, ['title', 'uid', 'projectId']),
    });

    // Send to processing queue if resource needs parsing or indexing
    if (
      updatedResource.indexStatus === 'wait_parse' ||
      updatedResource.indexStatus === 'wait_index'
    ) {
      await this.queue?.add('finalizeResource', {
        resourceId: updatedResource.resourceId,
        uid: user.uid,
      });

      // Handle polling if waitFor option is specified
      if (options?.waitFor) {
        this.logger.log(
          `poll resource ${updatedResource.resourceId}, wait for: ${options.waitFor}`,
        );
        await this.pollResourceProcessing(updatedResource.resourceId, user.uid, options.waitFor);
      }
    }

    return updatedResource;
  }

  async reindexResource(user: User, param: ReindexResourceRequest) {
    const { resourceIds = [] } = param;
    const limit = pLimit(5);
    const tasks = resourceIds.map((resourceId) =>
      limit(() => this.finalizeResource({ resourceId, uid: user.uid })),
    );
    return Promise.all(tasks);
  }

  async deleteResource(user: User, resourceId: string) {
    const { uid } = user;
    const resource = await this.prisma.resource.findFirst({
      where: { resourceId, uid, deletedAt: null },
    });
    if (!resource) {
      throw new ResourceNotFoundError(`resource ${resourceId} not found`);
    }

    await this.prisma.resource.update({
      where: { resourceId, uid, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await this.subscriptionService.syncStorageUsage(user);

    await this.postDeleteKnowledgeQueue?.add('postDeleteKnowledgeEntity', {
      uid,
      entityId: resourceId,
      entityType: 'resource',
    });
  }

  /**
   * Poll resource processing status until completion
   * @param resourceId Resource ID to poll
   * @param uid User ID
   * @param waitFor Wait condition ('parse_completed' or 'completed')
   */
  private async pollResourceProcessing(
    resourceId: string,
    uid: string,
    waitFor: 'parse_completed' | 'completed',
  ): Promise<void> {
    const pollInterval = 1000; // 1 second
    const maxPollTime = 300000; // 5 minutes
    const startTime = Date.now();

    this.logger.log(`Starting polling for resource ${resourceId}, waitFor: ${waitFor}`);

    while (Date.now() - startTime < maxPollTime) {
      // Wait for polling interval
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // Check resource status
      const resource = await this.prisma.resource.findFirst({
        where: { resourceId, uid },
        select: { indexStatus: true },
      });

      if (!resource) {
        throw new Error(`Resource ${resourceId} not found during polling`);
      }

      const { indexStatus } = resource;

      // Define target statuses based on waitFor option
      const targetStatuses: string[] = [];
      if (waitFor === 'parse_completed') {
        targetStatuses.push('wait_index', 'finish', 'parse_failed', 'index_failed');
      } else if (waitFor === 'completed') {
        targetStatuses.push('finish', 'parse_failed', 'index_failed');
      }

      // Check if we've reached a target status
      if (targetStatuses.includes(indexStatus)) {
        this.logger.log(`Resource ${resourceId} reached target status: ${indexStatus}`);
        return;
      }

      // Continue polling if still processing
      this.logger.debug(`Resource ${resourceId} status: ${indexStatus}, continuing to poll...`);
    }

    // Timeout reached
    this.logger.warn(`Polling timeout reached for resource ${resourceId}`);
    throw new Error(`Resource processing polling timeout for resource ${resourceId}`);
  }

  async postDeleteResource(user: User, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { resourceId, uid: user.uid, deletedAt: { not: null } },
    });
    if (!resource) {
      this.logger.warn(`Deleted resource ${resourceId} not found`);
      return;
    }

    const cleanups: Promise<any>[] = [
      this.ragService.deleteResourceNodes(user, resourceId),
      this.fts.deleteDocument(user, 'resource', resourceId),
      this.canvasQueue?.add('deleteNodes', {
        entities: [{ entityId: resourceId, entityType: 'resource' }],
      }),
    ];

    if (resource.storageKey) {
      cleanups.push(this.oss.removeObject(resource.storageKey));
    }
    if (resource.rawFileKey) {
      cleanups.push(this.oss.removeObject(resource.rawFileKey));
    }

    await Promise.all(cleanups);
  }

  /**
   * Duplicate an existing resource
   * @param user The user duplicating the resource
   * @param param The duplicate resource request param
   * @returns The newly created resource
   */
  async duplicateResource(user: User, param: DuplicateResourceRequest) {
    const { resourceId: sourceResourceId, title: newTitle, canvasId } = param;

    // Check storage quota
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < 1) {
      throw new StorageQuotaExceeded();
    }

    // Find the source resource
    const sourceResource = await this.prisma.resource.findFirst({
      where: { resourceId: sourceResourceId, deletedAt: null },
    });
    if (!sourceResource) {
      throw new ResourceNotFoundError(`Resource ${sourceResourceId} not found`);
    }

    // Create a new resource ID
    const newResourceId = genResourceID();

    let newStorageKey: string | undefined;
    if (sourceResource.storageKey) {
      newStorageKey = `resources/${newResourceId}.txt`;
    }

    // Create the new resource
    const newResource = await this.prisma.resource.create({
      data: {
        ...pick(sourceResource, [
          'resourceType',
          'wordCount',
          'contentPreview',
          'storageSize',
          'vectorSize',
          'indexStatus',
          'indexError',
          'identifier',
          'canvasId',
          'meta',
          'rawFileKey',
        ]),
        resourceId: newResourceId,
        title: newTitle,
        uid: user.uid,
        storageKey: newStorageKey,
        canvasId,
      },
    });
    const dupRecord = await this.prisma.duplicateRecord.create({
      data: {
        uid: user.uid,
        sourceId: sourceResource.resourceId,
        targetId: newResourceId,
        entityType: 'resource',
        status: 'pending',
      },
    });

    const migrations: Promise<any>[] = [
      this.ragService.duplicateDocument({
        sourceUid: sourceResource.uid,
        targetUid: user.uid,
        sourceDocId: sourceResource.resourceId,
        targetDocId: newResourceId,
      }),
      this.fts.duplicateDocument(user, 'resource', sourceResource.resourceId, newResourceId),
    ];
    if (sourceResource.storageKey) {
      migrations.push(this.oss.duplicateFile(sourceResource.storageKey, newStorageKey));
    }
    if (sourceResource.uid !== user.uid) {
      migrations.push(
        this.miscService.duplicateFilesNoCopy(user, {
          sourceEntityId: sourceResource.resourceId,
          sourceEntityType: 'resource',
          sourceUid: sourceResource.uid,
          targetEntityId: newResourceId,
          targetEntityType: 'resource',
        }),
      );
    }

    try {
      await Promise.all(migrations);

      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'finish' },
      });

      await this.subscriptionService.syncStorageUsage(user);
    } catch (error) {
      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'failed' },
      });
      throw error;
    }

    return newResource;
  }
}
