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
  Document as DocumentModel,
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
  QueryReferencesRequest,
  ReferenceType,
  BaseReference,
  AddReferencesRequest,
  DeleteReferencesRequest,
  ReferenceMeta,
  ListDocumentsData,
  GetDocumentDetailData,
  UpsertDocumentRequest,
  DeleteDocumentRequest,
  IndexError,
  DuplicateDocumentRequest,
  DuplicateResourceRequest,
} from '@refly/openapi-schema';
import {
  QUEUE_SIMPLE_EVENT,
  QUEUE_RESOURCE,
  streamToString,
  QUEUE_SYNC_STORAGE_USAGE,
  QUEUE_CLEAR_CANVAS_ENTITY,
  streamToBuffer,
  QUEUE_POST_DELETE_KNOWLEDGE_ENTITY,
} from '../../utils';
import {
  genResourceID,
  cleanMarkdownForIngest,
  markdown2StateUpdate,
  genReferenceID,
  genDocumentID,
} from '@refly/utils';
import {
  DocumentDetail,
  ExtendedReferenceModel,
  FinalizeResourceParam,
  PostDeleteKnowledgeEntityJobData,
  ResourcePrepareResult,
} from './knowledge.dto';
import { pick } from '../../utils';
import { SimpleEventData } from '../event/event.dto';
import { SyncStorageUsageJobData } from '../subscription/subscription.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { MiscService } from '../misc/misc.service';
import {
  StorageQuotaExceeded,
  ResourceNotFoundError,
  ParamsError,
  ReferenceNotFoundError,
  ReferenceObjectMissingError,
  DocumentNotFoundError,
} from '@refly/errors';
import { DeleteCanvasNodesJobData } from '../canvas/canvas.dto';
import { ParserFactory } from '../knowledge/parsers/factory';
import { ConfigService } from '@nestjs/config';
import { ParseResult, ParserOptions } from './parsers/base';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { ProviderService } from '../provider/provider.service';
import { DocxParser } from '../knowledge/parsers/docx.parser';
import { PdfParser } from '../knowledge/parsers/pdf.parser';
import { UserService } from '../user/user.service';

@Injectable()
export class KnowledgeService {
  private logger = new Logger(KnowledgeService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private userService: UserService,
    private ragService: RAGService,
    private miscService: MiscService,
    private providerService: ProviderService,
    private subscriptionService: SubscriptionService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private fts: FulltextSearchService,
    @Optional() @InjectQueue(QUEUE_RESOURCE) private queue?: Queue<FinalizeResourceParam>,
    @Optional() @InjectQueue(QUEUE_SIMPLE_EVENT) private simpleEventQueue?: Queue<SimpleEventData>,
    @Optional()
    @InjectQueue(QUEUE_SYNC_STORAGE_USAGE)
    private ssuQueue?: Queue<SyncStorageUsageJobData>,
    @Optional()
    @InjectQueue(QUEUE_CLEAR_CANVAS_ENTITY)
    private canvasQueue?: Queue<DeleteCanvasNodesJobData>,
    @Optional()
    @InjectQueue(QUEUE_POST_DELETE_KNOWLEDGE_ENTITY)
    private postDeleteKnowledgeQueue?: Queue<PostDeleteKnowledgeEntityJobData>,
  ) {}

  async syncStorageUsage(user: User) {
    await this.ssuQueue?.add(
      'syncStorageUsage',
      {
        uid: user.uid,
        timestamp: new Date(),
      },
      {
        jobId: user.uid,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async listResources(user: User, param: ListResourcesData['query']) {
    const {
      resourceId,
      resourceType,
      projectId,
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
    const { resourceId } = param;

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

    return { ...resource, content, downloadURL };
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
    } else if (resourceType === 'file') {
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
    } else {
      throw new ParamsError('Invalid resource type');
    }

    if (content) {
      // save content to object storage
      const storageKey = `resources/${param.resourceId}.txt`;
      await this.oss.putObject(storageKey, param.content);
      const storageSize = (await this.oss.statObject(storageKey)).size;

      return {
        storageKey,
        storageSize,
        identifier,
        indexStatus: 'wait_index', // skip parsing stage, since content is provided
        contentPreview: param.content.slice(0, 500),
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
    options?: { checkStorageQuota?: boolean },
  ) {
    if (options?.checkStorageQuota) {
      const usageResult = await this.subscriptionService.checkStorageUsage(user);
      if (usageResult.available < 1) {
        throw new StorageQuotaExceeded();
      }
    }

    param.resourceId = genResourceID();
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

    const existingResource = await this.prisma.resource.findFirst({
      where: {
        uid: user.uid,
        identifier,
        deletedAt: null,
      },
    });
    param.resourceId = existingResource ? existingResource.resourceId : genResourceID();

    const resource = await this.prisma.resource.upsert({
      where: { resourceId: param.resourceId },
      create: {
        resourceId: param.resourceId,
        identifier,
        resourceType: param.resourceType,
        meta: JSON.stringify({ ...param.data, ...metadata }),
        contentPreview,
        storageKey,
        storageSize,
        rawFileKey: staticFile?.storageKey,
        projectId: param.projectId,
        uid: user.uid,
        title: param.title || '',
        indexStatus,
      },
      update: {
        meta: JSON.stringify({ ...param.data, ...metadata }),
        contentPreview,
        storageKey,
        storageSize,
        rawFileKey: staticFile?.storageKey,
        projectId: param.projectId,
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
    await this.syncStorageUsage(user);

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
    return Promise.all(tasks);
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

    const { resourceId, resourceType, rawFileKey, meta } = resource;
    const { url, contentType } = JSON.parse(meta) as ResourceMeta;

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
    const { url, title } = JSON.parse(meta) as ResourceMeta;
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

    const user = await this.userService.getUserSettings({ uid });
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
    await this.syncStorageUsage(user);

    return resource;
  }

  async updateResource(user: User, param: UpsertResourceRequest) {
    const resource = await this.prisma.resource.findFirst({
      where: { resourceId: param.resourceId, uid: user.uid },
    });
    if (!resource) {
      throw new ResourceNotFoundError(`resource ${param.resourceId} not found`);
    }

    const updates: Prisma.ResourceUpdateInput = pick(param, ['title']);
    if (param.data) {
      updates.meta = JSON.stringify(param.data);
    }

    if (!resource.storageKey) {
      resource.storageKey = `resources/${resource.resourceId}.txt`;
      updates.storageKey = resource.storageKey;
    }

    if (param.projectId !== undefined) {
      if (param.projectId) {
        updates.project = { connect: { projectId: param.projectId } };
      } else {
        updates.project = { disconnect: true };
      }
    }

    if (param.content) {
      await this.oss.putObject(resource.storageKey, param.content);
      updates.storageSize = (await this.oss.statObject(resource.storageKey)).size;
    }

    const updatedResource = await this.prisma.resource.update({
      where: { resourceId: param.resourceId, uid: user.uid },
      data: updates,
    });

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

    await this.syncStorageUsage(user);

    await this.postDeleteKnowledgeQueue?.add('postDeleteKnowledgeEntity', {
      uid,
      entityId: resourceId,
      entityType: 'resource',
    });
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

  async listDocuments(user: User, param: ListDocumentsData['query']) {
    const { page = 1, pageSize = 10, order = 'creationDesc', projectId } = param;

    const orderBy: Prisma.DocumentOrderByWithRelationInput = {};
    if (order === 'creationAsc') {
      orderBy.pk = 'asc';
    } else {
      orderBy.pk = 'desc';
    }

    return this.prisma.document.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
        projectId,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });
  }

  async getDocumentDetail(
    user: User,
    params: GetDocumentDetailData['query'],
  ): Promise<DocumentDetail> {
    const { docId } = params;

    if (!docId) {
      throw new ParamsError('Document ID is required');
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        docId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.oss.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    return { ...doc, content };
  }

  async exportDocument(
    user: User,
    params: { docId: string; format: 'markdown' | 'docx' | 'pdf' },
  ): Promise<Buffer> {
    const { docId, format } = params;

    if (!docId) {
      throw new ParamsError('Document ID is required');
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        docId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.oss.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    // Process images in the document content
    if (content) {
      content = await this.miscService.processContentImages(content);
    }

    // 添加文档标题作为 H1 标题
    const title = doc.title || 'Untitled';
    const markdownContent = `# ${title}\n\n${content || ''}`;

    // 根据格式转换内容
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

  async createDocument(
    user: User,
    param: UpsertDocumentRequest,
    options?: { checkStorageQuota?: boolean },
  ) {
    if (options?.checkStorageQuota) {
      const usageResult = await this.subscriptionService.checkStorageUsage(user);
      if (usageResult.available < 1) {
        throw new StorageQuotaExceeded();
      }
    }

    param.docId = genDocumentID();
    param.title ||= '';
    param.initialContent ||= '';

    const createInput: Prisma.DocumentCreateInput = {
      docId: param.docId,
      title: param.title,
      uid: user.uid,
      readOnly: param.readOnly ?? false,
      contentPreview: param.initialContent?.slice(0, 500),
    };

    createInput.storageKey = `doc/${param.docId}.txt`;
    createInput.stateStorageKey = `state/${param.docId}`;

    // Save initial content and ydoc state to object storage
    const ydoc = markdown2StateUpdate(param.initialContent);
    await Promise.all([
      this.oss.putObject(createInput.storageKey, param.initialContent),
      this.oss.putObject(createInput.stateStorageKey, Buffer.from(ydoc)),
    ]);

    // Calculate storage size
    const [storageStat, stateStorageStat] = await Promise.all([
      this.oss.statObject(createInput.storageKey),
      this.oss.statObject(createInput.stateStorageKey),
    ]);
    createInput.storageSize = storageStat.size + stateStorageStat.size;

    // Add to vector store
    if (param.initialContent) {
      const { size } = await this.ragService.indexDocument(user, {
        pageContent: param.initialContent,
        metadata: {
          nodeType: 'document',
          docId: param.docId,
          title: param.title,
          projectId: param.projectId,
        },
      });
      createInput.vectorSize = size;
    }

    const doc = await this.prisma.document.upsert({
      where: { docId: param.docId },
      create: createInput,
      update: pick(param, ['title', 'readOnly', 'projectId']),
    });

    await this.fts.upsertDocument(user, 'document', {
      id: param.docId,
      ...pick(doc, ['title', 'uid', 'projectId']),
      content: param.initialContent,
      createdAt: doc.createdAt.toJSON(),
      updatedAt: doc.updatedAt.toJSON(),
    });

    await this.syncStorageUsage(user);

    return doc;
  }

  async batchUpdateDocument(user: User, param: UpsertDocumentRequest[]) {
    const docIds = param.map((p) => p.docId);
    if (docIds.length !== new Set(docIds).size) {
      throw new ParamsError('Duplicate document IDs');
    }

    const count = await this.prisma.document.count({
      where: { docId: { in: docIds }, uid: user.uid, deletedAt: null },
    });

    if (count !== docIds.length) {
      throw new DocumentNotFoundError('Some of the documents cannot be found');
    }

    await this.prisma.$transaction(
      param.map((p) =>
        this.prisma.document.update({
          where: { docId: p.docId },
          data: pick(p, ['title', 'readOnly']),
        }),
      ),
    );

    // TODO: update elastcisearch docs and qdrant data points
  }

  async deleteDocument(user: User, param: DeleteDocumentRequest) {
    const { uid } = user;
    const { docId } = param;

    const doc = await this.prisma.document.findFirst({
      where: { docId, uid, deletedAt: null },
    });
    if (!doc) {
      throw new DocumentNotFoundError();
    }

    await this.prisma.document.update({
      where: { docId },
      data: { deletedAt: new Date() },
    });

    await this.syncStorageUsage(user);

    await this.postDeleteKnowledgeQueue?.add('postDeleteKnowledgeEntity', {
      uid,
      entityId: docId,
      entityType: 'document',
    });
  }

  async postDeleteDocument(user: User, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { docId, deletedAt: { not: null } },
    });
    if (!doc) {
      this.logger.warn(`Deleted document ${docId} not found`);
      return;
    }

    const cleanups: Promise<any>[] = [
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'document', entityId: docId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.ragService.deleteDocumentNodes(user, docId),
      this.fts.deleteDocument(user, 'document', docId),
      this.canvasQueue?.add('deleteNodes', {
        entities: [{ entityId: docId, entityType: 'document' }],
      }),
    ];

    if (doc.storageKey) {
      cleanups.push(this.oss.removeObject(doc.storageKey));
    }

    if (doc.stateStorageKey) {
      cleanups.push(this.oss.removeObject(doc.stateStorageKey));
    }

    await Promise.all(cleanups);
  }

  /**
   * Duplicate an existing document
   * @param user The user duplicating the document
   * @param param The duplicate document request param
   * @returns The newly created document
   */
  async duplicateDocument(user: User, param: DuplicateDocumentRequest) {
    const { docId: sourceDocId, title: newTitle } = param;

    // Check storage quota
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < 1) {
      throw new StorageQuotaExceeded();
    }

    // Find the source document
    const sourceDoc = await this.prisma.document.findFirst({
      where: { docId: sourceDocId, deletedAt: null },
    });
    if (!sourceDoc) {
      throw new DocumentNotFoundError(`Document ${sourceDocId} not found`);
    }

    // Generate a new document ID
    const newDocId = genDocumentID();

    const newStorageKey = `doc/${newDocId}.txt`;
    const newStateStorageKey = `state/${newDocId}`;

    // Create the new document using the existing createDocument method
    const newDoc = await this.prisma.document.create({
      data: {
        ...pick(sourceDoc, [
          'wordCount',
          'contentPreview',
          'storageSize',
          'vectorSize',
          'readOnly',
        ]),
        docId: newDocId,
        title: newTitle ?? sourceDoc.title,
        uid: user.uid,
        storageKey: newStorageKey,
        stateStorageKey: newStateStorageKey,
      },
    });

    const dupRecord = await this.prisma.duplicateRecord.create({
      data: {
        uid: user.uid,
        sourceId: sourceDoc.docId,
        targetId: newDocId,
        entityType: 'document',
        status: 'pending',
      },
    });

    const migrations: Promise<any>[] = [
      this.oss.duplicateFile(sourceDoc.storageKey, newStorageKey),
      this.oss.duplicateFile(sourceDoc.stateStorageKey, newStateStorageKey),
      this.ragService.duplicateDocument({
        sourceUid: sourceDoc.uid,
        targetUid: user.uid,
        sourceDocId: sourceDoc.docId,
        targetDocId: newDocId,
      }),
      this.fts.duplicateDocument(user, 'document', sourceDoc.docId, newDocId),
    ];

    if (sourceDoc.uid !== user.uid) {
      migrations.push(
        this.miscService.duplicateFilesNoCopy(user, {
          sourceEntityId: sourceDoc.docId,
          sourceEntityType: 'document',
          sourceUid: sourceDoc.uid,
          targetEntityId: newDocId,
          targetEntityType: 'document',
        }),
      );
    }

    try {
      // Duplicate the files and index
      await Promise.all(migrations);

      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'finish' },
      });

      await this.syncStorageUsage(user);
    } catch (error) {
      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'failed' },
      });
      throw error;
    }

    return newDoc;
  }

  /**
   * Duplicate an existing resource
   * @param user The user duplicating the resource
   * @param param The duplicate resource request param
   * @returns The newly created resource
   */
  async duplicateResource(user: User, param: DuplicateResourceRequest) {
    const { resourceId: sourceResourceId, title: newTitle } = param;

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
    const newStorageKey = `resources/${newResourceId}.txt`;

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
          'meta',
          'rawFileKey',
        ]),
        resourceId: newResourceId,
        title: newTitle,
        uid: user.uid,
        storageKey: newStorageKey,
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

      await this.syncStorageUsage(user);
    } catch (error) {
      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'failed' },
      });
      throw error;
    }

    return newResource;
  }

  async queryReferences(
    user: User,
    param: QueryReferencesRequest,
  ): Promise<ExtendedReferenceModel[]> {
    const { sourceType, sourceId, targetType, targetId } = param;

    // Check if the source and target entities exist for this user
    const entityChecks: Promise<void>[] = [];
    if (sourceType && sourceId) {
      entityChecks.push(this.miscService.checkEntity(user, sourceId, sourceType));
    }
    if (targetType && targetId) {
      entityChecks.push(this.miscService.checkEntity(user, targetId, targetType));
    }
    await Promise.all(entityChecks);

    const where: Prisma.ReferenceWhereInput = {};
    if (sourceType && sourceId) {
      where.sourceType = sourceType;
      where.sourceId = sourceId;
    }
    if (targetType && targetId) {
      where.targetType = targetType;
      where.targetId = targetId;
    }
    if (Object.keys(where).length === 0) {
      throw new ParamsError('Either source or target condition is required');
    }

    const references = await this.prisma.reference.findMany({ where });

    // Collect all document IDs and resource IDs from both source and target
    const docIds = new Set<string>();
    const resourceIds = new Set<string>();
    for (const ref of references) {
      if (ref.sourceType === 'document') docIds.add(ref.sourceId);
      if (ref.targetType === 'document') docIds.add(ref.targetId);
      if (ref.sourceType === 'resource') resourceIds.add(ref.sourceId);
      if (ref.targetType === 'resource') resourceIds.add(ref.targetId);
    }

    // Fetch document mappings if there are any documents
    const docsMap: Record<string, DocumentModel> = {};
    if (docIds.size > 0) {
      const docs = await this.prisma.document.findMany({
        where: { docId: { in: Array.from(docIds) }, deletedAt: null },
      });
      for (const doc of docs) {
        docsMap[doc.docId] = doc;
      }
    }

    // Fetch resource mappings if there are any resources
    const resourceMap: Record<string, ResourceModel> = {};
    if (resourceIds.size > 0) {
      const resources = await this.prisma.resource.findMany({
        where: { resourceId: { in: Array.from(resourceIds) }, deletedAt: null },
      });
      for (const resource of resources) {
        resourceMap[resource.resourceId] = resource;
      }
    }

    const genReferenceMeta = (sourceType: string, sourceId: string) => {
      let refMeta: ReferenceMeta;
      if (sourceType === 'resource') {
        refMeta = {
          title: resourceMap[sourceId]?.title,
          url: JSON.parse(resourceMap[sourceId]?.meta || '{}')?.url,
        };
      } else if (sourceType === 'document') {
        refMeta = {
          title: docsMap[sourceId]?.title,
        };
      }
      return refMeta;
    };

    // Attach metadata to references
    return references.map((ref) => {
      return {
        ...ref,
        sourceMeta: genReferenceMeta(ref.sourceType, ref.sourceId),
        targetMeta: genReferenceMeta(ref.targetType, ref.targetId),
      };
    });
  }

  private async prepareReferenceInputs(
    user: User,
    references: BaseReference[],
  ): Promise<Prisma.ReferenceCreateManyInput[]> {
    const validRefTypes: ReferenceType[] = ['resource', 'document'];

    // Deduplicate references using a Set with stringified unique properties
    const uniqueRefs = new Set(
      references.map((ref) =>
        JSON.stringify({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
          targetType: ref.targetType,
          targetId: ref.targetId,
        }),
      ),
    );
    const deduplicatedRefs: BaseReference[] = Array.from(uniqueRefs).map((ref) => JSON.parse(ref));

    const resourceIds: Set<string> = new Set();
    const docIds: Set<string> = new Set();

    for (const ref of deduplicatedRefs) {
      if (!validRefTypes.includes(ref.sourceType)) {
        throw new ParamsError(`Invalid source type: ${ref.sourceType}`);
      }
      if (!validRefTypes.includes(ref.targetType)) {
        throw new ParamsError(`Invalid target type: ${ref.targetType}`);
      }
      if (ref.sourceType === 'resource' && ref.targetType === 'document') {
        throw new ParamsError('Resource to document reference is not allowed');
      }
      if (ref.sourceType === ref.targetType && ref.sourceId === ref.targetId) {
        throw new ParamsError('Source and target cannot be the same');
      }

      if (ref.sourceType === 'resource') {
        resourceIds.add(ref.sourceId);
      } else if (ref.sourceType === 'document') {
        docIds.add(ref.sourceId);
      }

      if (ref.targetType === 'resource') {
        resourceIds.add(ref.targetId);
      } else if (ref.targetType === 'document') {
        docIds.add(ref.targetId);
      }
    }

    const [resources, docs] = await Promise.all([
      this.prisma.resource.findMany({
        select: { resourceId: true },
        where: {
          resourceId: { in: Array.from(resourceIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
      this.prisma.document.findMany({
        select: { docId: true },
        where: {
          docId: { in: Array.from(docIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
    ]);

    // Check if all the entities exist
    const foundIds = new Set([...resources.map((r) => r.resourceId), ...docs.map((c) => c.docId)]);
    const missingEntities = deduplicatedRefs.filter(
      (e) => !foundIds.has(e.sourceId) || !foundIds.has(e.targetId),
    );
    if (missingEntities.length > 0) {
      this.logger.warn(`Entities not found: ${JSON.stringify(missingEntities)}`);
      throw new ReferenceObjectMissingError();
    }

    return deduplicatedRefs.map((ref) => ({
      ...ref,
      referenceId: genReferenceID(),
      uid: user.uid,
    }));
  }

  async addReferences(user: User, param: AddReferencesRequest) {
    const { references } = param;
    const referenceInputs = await this.prepareReferenceInputs(user, references);

    return this.prisma.$transaction(
      referenceInputs.map((input) =>
        this.prisma.reference.upsert({
          where: {
            sourceType_sourceId_targetType_targetId: {
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              targetType: input.targetType,
              targetId: input.targetId,
            },
          },
          create: input,
          update: { deletedAt: null },
        }),
      ),
    );
  }

  async deleteReferences(user: User, param: DeleteReferencesRequest) {
    const { referenceIds } = param;

    const references = await this.prisma.reference.findMany({
      where: {
        referenceId: { in: referenceIds },
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (references.length !== referenceIds.length) {
      throw new ReferenceNotFoundError('Some of the references cannot be found');
    }

    await this.prisma.reference.updateMany({
      data: { deletedAt: new Date() },
      where: {
        referenceId: { in: referenceIds },
        uid: user.uid,
        deletedAt: null,
      },
    });
  }
}
