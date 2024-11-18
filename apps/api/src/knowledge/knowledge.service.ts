import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import pLimit from 'p-limit';
import crypto from 'node:crypto';
import { InjectQueue } from '@nestjs/bull';
import normalizeUrl from 'normalize-url';
import { readingTime } from 'reading-time-estimator';
import { Canvas, Prisma, Resource as ResourceModel } from '@prisma/client';
import { RAGService } from '@/rag/rag.service';
import { PrismaService } from '@/common/prisma.service';
import { ElasticsearchService } from '@/common/elasticsearch.service';
import { MINIO_INTERNAL, MinioService } from '@/common/minio.service';
import {
  UpsertResourceRequest,
  ResourceMeta,
  ListResourcesData,
  ListCanvasData,
  UpsertCanvasRequest,
  User,
  GetResourceDetailData,
  IndexStatus,
  ReindexResourceRequest,
  ResourceType,
  ListProjectsData,
  UpsertProjectRequest,
  BindProjectResourceRequest,
  QueryReferencesRequest,
  BaseReference,
  AddReferencesRequest,
  DeleteReferencesRequest,
  ReferenceMeta,
  GetCanvasDetailData,
} from '@refly-packages/openapi-schema';
import {
  CHANNEL_FINALIZE_RESOURCE,
  QUEUE_SIMPLE_EVENT,
  QUEUE_RESOURCE,
  streamToString,
  QUEUE_SYNC_STORAGE_USAGE,
  QUEUE_PARSE_REF_URL,
} from '@/utils';
import {
  genResourceID,
  genCanvasID,
  cleanMarkdownForIngest,
  markdown2StateUpdate,
  genProjectID,
  genReferenceID,
} from '@refly-packages/utils';
import {
  ExtendedReferenceModel,
  FinalizeResourceParam,
  ParseReferenceExternalUrlParam,
} from './knowledge.dto';
import { pick } from '../utils';
import { SimpleEventData } from '@/event/event.dto';
import { SyncStorageUsageJobData } from '@/subscription/subscription.dto';
import { SubscriptionService } from '@/subscription/subscription.service';
import { MiscService } from '@/misc/misc.service';
import {
  ProjectNotFoundError,
  CanvasNotFoundError,
  StorageQuotaExceeded,
  ResourceNotFoundError,
  ParamsError,
  ReferenceNotFoundError,
  ReferenceObjectMissingError,
} from '@refly-packages/errors';

@Injectable()
export class KnowledgeService {
  private logger = new Logger(KnowledgeService.name);

  constructor(
    private prisma: PrismaService,
    private elasticsearch: ElasticsearchService,
    private ragService: RAGService,
    private miscService: MiscService,
    private subscriptionService: SubscriptionService,
    @Inject(MINIO_INTERNAL) private minio: MinioService,
    @InjectQueue(QUEUE_RESOURCE) private queue: Queue<FinalizeResourceParam>,
    @InjectQueue(QUEUE_PARSE_REF_URL) private refQueue: Queue<ParseReferenceExternalUrlParam>,
    @InjectQueue(QUEUE_SIMPLE_EVENT) private simpleEventQueue: Queue<SimpleEventData>,
    @InjectQueue(QUEUE_SYNC_STORAGE_USAGE) private ssuQueue: Queue<SyncStorageUsageJobData>,
  ) {}

  async listProjects(user: User, params: ListProjectsData['query']) {
    const { projectId, resourceId, page, pageSize, order } = params;

    const projectIdFilter: Prisma.StringFilter<'Project'> = { equals: projectId };
    let projectOrder: string[] = [];
    if (resourceId) {
      const relations = await this.prisma.projectResourceRelation.findMany({
        select: { projectId: true },
        where: { resourceId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { pk: 'desc' },
      });
      projectIdFilter.in = relations.map((r) => r.projectId);
      projectOrder = projectIdFilter.in;
    }

    const projects = await this.prisma.project.findMany({
      where: { projectId: projectIdFilter, uid: user.uid, deletedAt: null },
      ...(!resourceId
        ? {
            orderBy: { pk: order === 'creationAsc' ? 'asc' : 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }
        : {}),
    });

    if (projectOrder.length > 0) {
      // Sort according to the order in projectOrder
      projects.sort(
        (a, b) => projectOrder.indexOf(a.projectId) - projectOrder.indexOf(b.projectId),
      );
    }

    return projects;
  }

  async getProjectDetail(user: User, param: { projectId: string }) {
    const { uid } = user;
    const { projectId } = param;

    if (!projectId) {
      throw new ParamsError('Project ID is required');
    }

    const project = await this.prisma.project.findFirst({
      where: { projectId, uid, deletedAt: null },
    });
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  async upsertProject(user: User, param: UpsertProjectRequest) {
    if (!param.projectId) {
      param.projectId = genProjectID();
    }

    const project = await this.prisma.project.upsert({
      where: { projectId: param.projectId },
      create: {
        projectId: param.projectId,
        title: param.title,
        description: param.description,
        uid: user.uid,
      },
      update: { ...pick(param, ['title', 'description']) },
    });

    await this.elasticsearch.upsertProject({
      id: project.projectId,
      createdAt: project.createdAt.toJSON(),
      updatedAt: project.updatedAt.toJSON(),
      ...pick(project, ['title', 'description', 'uid']),
    });

    return project;
  }

  async bindProjectResources(user: User, params: BindProjectResourceRequest[]) {
    const { uid } = user;

    if (params?.length === 0) {
      return;
    }

    params.forEach((param) => {
      if (!param.resourceId || !param.projectId) {
        throw new ParamsError('resourceId and projectId are required');
      }
      if (param.operation !== 'bind' && param.operation !== 'unbind') {
        throw new ParamsError(`Invalid operation: ${param.operation}`);
      }
    });

    const projectIds = new Set(params.map((p) => p.projectId));
    const resourceIds = new Set(params.map((p) => p.resourceId));

    const [projectCnt, resourceCnt] = await this.prisma.$transaction([
      this.prisma.project.count({
        where: { projectId: { in: Array.from(projectIds) }, uid, deletedAt: null },
      }),
      this.prisma.resource.count({
        where: { resourceId: { in: Array.from(resourceIds) }, uid, deletedAt: null },
      }),
    ]);

    if (projectCnt !== projectIds.size) {
      throw new ProjectNotFoundError('Some of the projects cannot be found');
    }
    if (resourceCnt !== resourceIds.size) {
      throw new ResourceNotFoundError('Some of the resources cannot be found');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const param of params) {
        const { projectId, resourceId, order, operation } = param;

        if (operation === 'bind') {
          // Get max order for this project if order not specified
          let finalOrder = order;
          if (finalOrder === undefined) {
            const maxOrder = await tx.projectResourceRelation.aggregate({
              where: { projectId },
              _max: { order: true },
            });
            finalOrder = (maxOrder._max.order ?? -1) + 1;
          }

          await tx.projectResourceRelation.upsert({
            where: { projectId_resourceId: { projectId, resourceId } },
            create: { projectId, resourceId, uid, order: finalOrder },
            update: { order: finalOrder },
          });
        } else if (operation === 'unbind') {
          await tx.projectResourceRelation.deleteMany({
            where: { projectId, resourceId },
          });
        }
      }
    });
  }

  async deleteProject(user: User, projectId: string) {
    const { uid } = user;
    const project = await this.prisma.project.findFirst({
      where: { projectId, uid, deletedAt: null },
    });
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.prisma.$transaction([
      this.prisma.project.update({
        where: { projectId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.canvas.updateMany({
        where: { projectId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.projectResourceRelation.deleteMany({
        where: { projectId },
      }),
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'project', entityId: projectId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.elasticsearch.deleteProject(projectId);
  }

  async listResources(user: User, param: ListResourcesData['query']) {
    const {
      resourceId,
      projectId,
      resourceType,
      page = 1,
      pageSize = 10,
      order = 'creationDesc',
    } = param;

    const resourceIdFilter: Prisma.StringFilter<'Resource'> = { equals: resourceId };
    let resourceOrder: string[] = [];
    if (projectId) {
      const relations = await this.prisma.projectResourceRelation.findMany({
        select: { resourceId: true },
        where: { projectId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { order: 'asc' },
      });
      resourceIdFilter.in = relations.map((r) => r.resourceId);
      resourceOrder = resourceIdFilter.in;
    }

    let resources = await this.prisma.resource.findMany({
      where: { resourceId: resourceIdFilter, resourceType, uid: user.uid, deletedAt: null },
      ...(!projectId
        ? {
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { pk: order === 'creationAsc' ? 'asc' : 'desc' },
          }
        : {}),
    });

    if (resourceOrder.length > 0) {
      // Sort according to the order in resourceOrder and add order field
      resources = resources
        .sort((a, b) => {
          return resourceOrder.indexOf(a.resourceId) - resourceOrder.indexOf(b.resourceId);
        })
        .map((res, index) => ({ ...res, order: index }));
    }

    // Get projectIds for each resource
    const resourceProjects = await this.prisma.projectResourceRelation.findMany({
      select: { resourceId: true, projectId: true },
      where: { resourceId: { in: resources.map((r) => r.resourceId) } },
    });
    const resourceProjectMap = new Map<string, string[]>();
    resourceProjects.forEach((rp) => {
      const projectIds = resourceProjectMap.get(rp.resourceId) || [];
      projectIds.push(rp.projectId);
      resourceProjectMap.set(rp.resourceId, projectIds);
    });

    return resources.map((res) => ({
      ...res,
      projectIds: resourceProjectMap.get(res.resourceId),
    }));
  }

  async getResourceDetail(user: User, param: GetResourceDetailData['query']) {
    const { uid } = user;
    const { resourceId } = param;

    if (!resourceId) {
      throw new ParamsError('Resource ID is required');
    }

    const resource = await this.prisma.resource.findFirst({
      where: { resourceId, uid, deletedAt: null },
    });

    if (!resource) {
      throw new ResourceNotFoundError(`resource ${resourceId} not found`);
    }

    let content: string;
    if (resource.storageKey) {
      const contentStream = await this.minio.client.getObject(resource.storageKey);
      content = await streamToString(contentStream);
    }

    const projectIds = await this.prisma.projectResourceRelation.findMany({
      select: { projectId: true },
      where: { resourceId },
    });

    return { ...resource, content, projectIds: projectIds.map((p) => p.projectId) };
  }

  async createResource(
    user: User,
    param: UpsertResourceRequest,
    options?: { checkStorageQuota?: boolean },
  ) {
    if (options?.checkStorageQuota) {
      const usageResult = await this.subscriptionService.checkStorageUsage(user);
      if (!usageResult.objectStorageAvailable || !usageResult.vectorStorageAvailable) {
        throw new StorageQuotaExceeded();
      }
    }

    param.resourceId = genResourceID();

    let storageKey: string;
    let storageSize: number = 0;
    let identifier: string;
    let indexStatus: IndexStatus = 'wait_parse';

    if (param.resourceType === 'weblink') {
      if (!param.data) {
        throw new ParamsError('data is required');
      }
      const { url, title } = param.data;
      if (!url) {
        throw new ParamsError('url is required');
      }
      param.title ||= title;
      param.data.url = normalizeUrl(url, { stripHash: true });
      identifier = param.data.url;
    } else if (param.resourceType === 'text') {
      if (!param.content) {
        throw new ParamsError('content is required for text resource');
      }
      const md5Hash = crypto
        .createHash('md5')
        .update(param.content ?? '')
        .digest('hex');
      identifier = `text://${md5Hash}`;
    } else {
      throw new ParamsError('Invalid resource type');
    }

    const existingResource = await this.prisma.resource.findFirst({
      where: { uid: user.uid, identifier, deletedAt: null },
    });
    param.resourceId = existingResource ? existingResource.resourceId : genResourceID();

    const cleanedContent = param.content?.replace(/x00/g, '') ?? '';

    if (cleanedContent) {
      // save text content to object storage
      storageKey = `resources/${param.resourceId}.txt`;
      await this.minio.client.putObject(storageKey, cleanedContent);
      storageSize = (await this.minio.client.statObject(storageKey)).size;

      // skip parse stage, since content is provided
      indexStatus = 'wait_index';
    }

    const resource = await this.prisma.$transaction(async (tx) => {
      const resource = await tx.resource.upsert({
        where: { resourceId: param.resourceId },
        create: {
          resourceId: param.resourceId,
          identifier,
          resourceType: param.resourceType,
          meta: JSON.stringify(param.data || {}),
          contentPreview: cleanedContent?.slice(0, 500),
          storageKey,
          storageSize,
          uid: user.uid,
          title: param.title || 'Untitled',
          indexStatus,
        },
        update: {
          meta: JSON.stringify(param.data || {}),
          contentPreview: cleanedContent?.slice(0, 500),
          storageKey,
          storageSize,
          title: param.title || 'Untitled',
          indexStatus,
        },
      });

      // Add to project if specified
      if (param.projectId) {
        await tx.projectResourceRelation.upsert({
          where: {
            projectId_resourceId: { projectId: param.projectId, resourceId: param.resourceId },
          },
          create: { projectId: param.projectId, resourceId: param.resourceId },
          update: {},
        });
      }

      return resource;
    });

    // Add to queue to be processed by worker
    await this.queue.add(CHANNEL_FINALIZE_RESOURCE, {
      resourceId: resource.resourceId,
      uid: user.uid,
    });

    return resource;
  }

  async batchCreateResource(user: User, params: UpsertResourceRequest[]) {
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (!usageResult.objectStorageAvailable || !usageResult.vectorStorageAvailable) {
      throw new StorageQuotaExceeded();
    }

    const limit = pLimit(5);
    const tasks = params.map((param) => limit(async () => await this.createResource(user, param)));
    return Promise.all(tasks);
  }

  /**
   * Parse resource content from remote URL into markdown.
   * Currently only weblinks are supported.
   */
  async parseResource(user: User, resource: ResourceModel): Promise<ResourceModel> {
    if (resource.indexStatus !== 'wait_parse' && resource.indexStatus !== 'parse_failed') {
      this.logger.warn(
        `Resource ${resource.resourceId} is not in wait_parse or parse_failed status, skip parse`,
      );
      return resource;
    }

    const { resourceId, meta } = resource;
    const { url } = JSON.parse(meta) as ResourceMeta;

    let content: string = '';
    let title: string = '';

    if (url) {
      const { data } = await this.ragService.crawlFromRemoteReader(url);
      content = data.content?.replace(/x00/g, '') ?? '';
      title ||= data.title;
    }

    const storageKey = `resources/${resourceId}.txt`;
    await this.minio.client.putObject(storageKey, content);

    const updatedResource = await this.prisma.resource.update({
      where: { resourceId, uid: user.uid },
      data: {
        storageKey,
        storageSize: (await this.minio.client.statObject(storageKey)).size,
        wordCount: readingTime(content).words,
        title: resource.title,
        indexStatus: 'wait_index',
        contentPreview: content?.slice(0, 500),
        meta: JSON.stringify({
          url,
          title: resource.title,
        } as ResourceMeta),
      },
    });

    await this.elasticsearch.upsertResource({
      id: resourceId,
      content,
      url,
      createdAt: resource.createdAt.toJSON(),
      updatedAt: resource.updatedAt.toJSON(),
      ...pick(updatedResource, ['title', 'uid']),
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
      const contentStream = await this.minio.client.getObject(storageKey);
      const content = await streamToString(contentStream);

      const { size } = await this.ragService.indexDocument(user, {
        pageContent: cleanMarkdownForIngest(content),
        metadata: {
          nodeType: 'resource',
          url,
          title,
          resourceType: resourceType as ResourceType,
          resourceId,
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

    const user = await this.prisma.user.findFirst({ where: { uid } });
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
        data: { indexStatus: 'parse_failed' },
      });
    }

    try {
      resource = await this.indexResource(user, resource);
    } catch (err) {
      this.logger.error(`index resource error: ${err?.stack}`);
      return this.prisma.resource.update({
        where: { resourceId, uid: user.uid },
        data: { indexStatus: 'index_failed' },
      });
    }

    // Send simple event
    await this.simpleEventQueue.add({
      entityType: 'resource',
      entityId: resourceId,
      name: 'onResourceReady',
      uid: user.uid,
    });

    // Sync storage usage
    await this.ssuQueue.add({
      uid: user.uid,
      timestamp: new Date(),
    });

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

    if (param.content) {
      await this.minio.client.putObject(resource.storageKey, param.content);
      updates.storageSize = (await this.minio.client.statObject(resource.storageKey)).size;
    }

    const updatedResource = await this.prisma.resource.update({
      where: { resourceId: param.resourceId, uid: user.uid },
      data: updates,
    });

    await this.elasticsearch.upsertResource({
      id: updatedResource.resourceId,
      content: param.content || undefined,
      createdAt: updatedResource.createdAt.toJSON(),
      updatedAt: updatedResource.updatedAt.toJSON(),
      ...pick(updatedResource, ['title', 'uid']),
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

    await this.prisma.$transaction([
      this.prisma.resource.update({
        where: { resourceId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'resource', entityId: resourceId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    await Promise.all([
      this.minio.client.removeObject(resource.storageKey),
      this.ragService.deleteResourceNodes(user, resourceId),
      this.elasticsearch.deleteResource(resourceId),
      this.ssuQueue.add({
        uid: user.uid,
        timestamp: new Date(),
      }),
    ]);
  }

  async listCanvases(user: User, param: ListCanvasData['query']) {
    const { projectId, page = 1, pageSize = 10, order = 'creationDesc' } = param;

    const orderBy: Prisma.CanvasOrderByWithRelationInput = {};
    if (projectId) {
      orderBy.order = 'asc';
    } else if (order === 'creationAsc') {
      orderBy.pk = 'asc';
    } else {
      orderBy.pk = 'desc';
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { projectId, uid: user.uid, deletedAt: null },
        include: {
          canvases: {
            where: { deletedAt: null },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy,
          },
        },
      });
      return project?.canvases;
    }

    return this.prisma.canvas.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });
  }

  async getCanvasDetail(user: User, params: GetCanvasDetailData['query']) {
    const { uid } = user;
    const { canvasId } = params;

    if (!canvasId) {
      throw new ParamsError('Canvas ID is required');
    }

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });

    if (!canvas) {
      throw new CanvasNotFoundError('Canvas not found');
    }

    let content: string;
    if (canvas.storageKey) {
      const contentStream = await this.minio.client.getObject(canvas.storageKey);
      content = await streamToString(contentStream);
    }

    return { ...canvas, content };
  }

  async createCanvas(user: User, param: UpsertCanvasRequest) {
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (!usageResult.objectStorageAvailable || !usageResult.vectorStorageAvailable) {
      throw new StorageQuotaExceeded();
    }

    param.canvasId = genCanvasID();
    param.projectId ||= genProjectID();
    param.title ||= 'Untitled';

    const createInput: Prisma.CanvasCreateInput = {
      canvasId: param.canvasId,
      title: param.title,
      uid: user.uid,
      readOnly: param.readOnly ?? false,
      content: param.initialContent,
      contentPreview: param.initialContent?.slice(0, 500),
      order: param.order,
      project: {
        connectOrCreate: {
          where: { projectId: param.projectId },
          create: {
            title: param.title || 'Untitled',
            projectId: param.projectId,
            uid: user.uid,
          },
        },
      },
    };

    if (param.initialContent) {
      createInput.storageKey = `canvas/${param.canvasId}.txt`;
      createInput.stateStorageKey = `state/${param.canvasId}`;

      // Save initial content and ydoc state to object storage
      const ydoc = markdown2StateUpdate(param.initialContent);
      await Promise.all([
        this.minio.client.putObject(createInput.storageKey, param.initialContent),
        this.minio.client.putObject(createInput.stateStorageKey, Buffer.from(ydoc)),
      ]);

      // Calculate storage size
      const [storageStat, stateStorageStat] = await Promise.all([
        this.minio.client.statObject(createInput.storageKey),
        this.minio.client.statObject(createInput.stateStorageKey),
      ]);
      createInput.storageSize = storageStat.size + stateStorageStat.size;

      // Add to vector store
      const { size } = await this.ragService.indexDocument(user, {
        pageContent: param.initialContent,
        metadata: {
          nodeType: 'canvas',
          canvasId: param.canvasId,
          projectId: param.projectId,
          title: param.title,
        },
      });
      createInput.vectorSize = size;
    }

    // Handle order in a transaction to ensure consistency
    const canvas = await this.prisma.$transaction(async (tx) => {
      // Get max order if not specified for new canvas
      if (param.order === undefined) {
        const maxOrder = await tx.canvas.aggregate({
          where: { projectId: param.projectId, deletedAt: null },
          _max: { order: true },
        });
        createInput.order = (maxOrder._max.order ?? -1) + 1;
      }

      const canvas = await tx.canvas.upsert({
        where: { canvasId: param.canvasId },
        create: createInput,
        update: {
          ...pick(param, ['title', 'readOnly']),
          ...(param.order !== undefined && { order: param.order }),
        },
      });

      return canvas;
    });

    await this.elasticsearch.upsertCanvas({
      id: param.canvasId,
      ...pick(canvas, ['projectId', 'title', 'uid']),
      content: param.initialContent,
      createdAt: canvas.createdAt.toJSON(),
      updatedAt: canvas.updatedAt.toJSON(),
    });

    await this.ssuQueue.add({
      uid: user.uid,
      timestamp: new Date(),
    });

    return canvas;
  }

  async batchUpdateCanvas(user: User, param: UpsertCanvasRequest[]) {
    const canvasIds = param.map((p) => p.canvasId);
    if (canvasIds.length !== new Set(canvasIds).size) {
      throw new ParamsError('Duplicate canvas IDs');
    }

    const count = await this.prisma.canvas.count({
      where: { canvasId: { in: canvasIds }, uid: user.uid, deletedAt: null },
    });

    if (count !== canvasIds.length) {
      throw new CanvasNotFoundError('Some of the canvases cannot be found');
    }

    await this.prisma.$transaction(
      param.map((p) =>
        this.prisma.canvas.update({
          where: { canvasId: p.canvasId },
          data: pick(p, ['title', 'readOnly', 'order', 'projectId']),
        }),
      ),
    );

    // TODO: update elastcisearch docs and qdrant data points
  }

  async deleteCanvas(user: User, canvasId: string) {
    const { uid } = user;
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError('Canvas not found');
    }

    await this.prisma.$transaction([
      this.prisma.canvas.update({
        where: { canvasId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'canvas', entityId: canvasId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    const cleanups: Promise<any>[] = [
      this.ragService.deleteCanvasNodes(user, canvasId),
      this.elasticsearch.deleteCanvas(canvasId),
      this.miscService.removeFilesByEntity(user, {
        entityId: canvasId,
        entityType: 'canvas',
      }),
    ];

    if (canvas.storageKey) {
      cleanups.push(this.minio.client.removeObject(canvas.storageKey));
    }

    if (canvas.stateStorageKey) {
      cleanups.push(this.minio.client.removeObject(canvas.stateStorageKey));
    }

    await Promise.all(cleanups);

    // Sync storage usage after all the cleanups
    await this.ssuQueue.add({
      uid: user.uid,
      timestamp: new Date(),
    });
  }

  async queryReferences(
    user: User,
    param: QueryReferencesRequest,
  ): Promise<ExtendedReferenceModel[]> {
    const { sourceType, sourceId, targetType, targetId, referenceId } = param;

    // Check if the source and target entities exist for this user
    const entityChecks: Promise<void>[] = [];
    if (sourceType && sourceId) {
      entityChecks.push(this.miscService.checkEntity(user, sourceId, sourceType));
    }
    if (targetType && targetId) {
      entityChecks.push(this.miscService.checkEntity(user, targetId, targetType));
    }
    await Promise.all(entityChecks);

    const where: Prisma.ReferenceWhereInput = {
      referenceId,
    };
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

    // Collect all canvas IDs and resource IDs from both source and target
    const canvasIds = new Set<string>();
    const resourceIds = new Set<string>();
    references.forEach((ref) => {
      if (ref.sourceType === 'canvas') canvasIds.add(ref.sourceId);
      if (ref.targetType === 'canvas') canvasIds.add(ref.targetId);
      if (ref.sourceType === 'resource') resourceIds.add(ref.sourceId);
      if (ref.targetType === 'resource') resourceIds.add(ref.targetId);
    });

    // Fetch canvas mappings if there are any canvases
    const canvasMap: Record<string, Canvas> = {};
    if (canvasIds.size > 0) {
      const canvases = await this.prisma.canvas.findMany({
        where: { canvasId: { in: Array.from(canvasIds) }, deletedAt: null },
      });
      canvases.forEach((canvas) => {
        canvasMap[canvas.canvasId] = canvas;
      });
    }

    // Fetch resource mappings if there are any resources
    const resourceMap: Record<string, ResourceModel> = {};
    if (resourceIds.size > 0) {
      const resources = await this.prisma.resource.findMany({
        where: { resourceId: { in: Array.from(resourceIds) }, deletedAt: null },
      });
      resources.forEach((resource) => {
        resourceMap[resource.resourceId] = resource;
      });
    }

    const genReferenceMetaObj = (refType: string, refId: string) => {
      // Don't generate metadata object for external URLs, use targetMeta directly
      if (refType === 'externalUrl') {
        return null;
      }

      let refMeta: ReferenceMeta;
      if (refType === 'resource') {
        refMeta = {
          title: resourceMap[refId]?.title,
          url: JSON.parse(resourceMap[refId]?.meta || '{}')?.url,
          description: resourceMap[refId]?.contentPreview,
        };
      } else if (refType === 'canvas') {
        refMeta = {
          title: canvasMap[refId]?.title,
          projectId: canvasMap[refId]?.projectId,
          description: canvasMap[refId]?.contentPreview,
        };
      }
      return refMeta;
    };

    // Attach metadata to references
    return references.map((ref) => {
      return {
        ...ref,
        sourceMetaObj: genReferenceMetaObj(ref.sourceType, ref.sourceId),
        targetMetaObj: genReferenceMetaObj(ref.targetType, ref.targetId),
      };
    });
  }

  private async prepareReferenceInputs(
    user: User,
    references: BaseReference[],
  ): Promise<Prisma.ReferenceCreateManyInput[]> {
    // Deduplicate references using a Set with stringified unique properties
    const uniqueRefs = new Set(
      references.map((ref) =>
        JSON.stringify({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
          targetType: ref.targetType,
          targetId:
            ref.targetType === 'externalUrl'
              ? normalizeUrl(ref.targetId, { stripHash: true })
              : ref.targetId,
        }),
      ),
    );
    const deduplicatedRefs: BaseReference[] = Array.from(uniqueRefs).map((ref) => JSON.parse(ref));

    const resourceIds: Set<string> = new Set();
    const canvasIds: Set<string> = new Set();

    deduplicatedRefs.forEach((ref) => {
      if (!['resource', 'canvas'].includes(ref.sourceType)) {
        throw new ParamsError(`Invalid source type: ${ref.sourceType}`);
      }
      if (!['resource', 'canvas', 'externalUrl'].includes(ref.targetType)) {
        throw new ParamsError(`Invalid target type: ${ref.targetType}`);
      }
      if (ref.sourceType === 'resource' && ref.targetType === 'canvas') {
        throw new ParamsError('Resource to canvas reference is not allowed');
      }
      if (ref.sourceType === ref.targetType && ref.sourceId === ref.targetId) {
        throw new ParamsError('Source and target cannot be the same');
      }

      if (ref.sourceType === 'resource') {
        resourceIds.add(ref.sourceId);
      } else if (ref.sourceType === 'canvas') {
        canvasIds.add(ref.sourceId);
      }

      if (ref.targetType === 'resource') {
        resourceIds.add(ref.targetId);
      } else if (ref.targetType === 'canvas') {
        canvasIds.add(ref.targetId);
      }
    });

    const [resources, canvases] = await Promise.all([
      this.prisma.resource.findMany({
        select: { resourceId: true },
        where: {
          resourceId: { in: Array.from(resourceIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
      this.prisma.canvas.findMany({
        select: { canvasId: true },
        where: {
          canvasId: { in: Array.from(canvasIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
    ]);

    // Check if all the entities exist
    const foundIds = new Set([
      ...resources.map((r) => r.resourceId),
      ...canvases.map((c) => c.canvasId),
    ]);
    const missingEntities = deduplicatedRefs.filter(
      (e) =>
        !foundIds.has(e.sourceId) || (e.targetType !== 'externalUrl' && !foundIds.has(e.targetId)),
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

    const refResults = await this.prisma.$transaction(
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

    const externalUrlReferenceIds = refResults
      .filter((ref) => ref.targetType === 'externalUrl')
      .map((ref) => ref.referenceId);

    // Process external URLs in batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < externalUrlReferenceIds.length; i += BATCH_SIZE) {
      const batch = externalUrlReferenceIds.slice(i, i + BATCH_SIZE);
      await this.refQueue.add({ referenceIds: batch });
    }

    return refResults;
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

  async parseReferenceExternalUrl(param: ParseReferenceExternalUrlParam) {
    const { referenceIds } = param;

    const references = await this.prisma.reference.findMany({
      select: { referenceId: true, targetId: true },
      where: { referenceId: { in: referenceIds }, deletedAt: null },
    });
    const urls = references.map((ref) => ref.targetId);

    const scrapedUrls = await Promise.all(
      urls.map((url) => this.miscService.scrapeWeblink({ url })),
    );

    await this.prisma.$transaction(
      references.map((ref, index) =>
        this.prisma.reference.update({
          where: { referenceId: ref.referenceId },
          data: {
            targetMeta: JSON.stringify(scrapedUrls[index]),
          },
        }),
      ),
    );
  }
}
