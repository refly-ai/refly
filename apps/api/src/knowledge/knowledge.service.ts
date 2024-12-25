import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import pLimit from 'p-limit';
import crypto from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import normalizeUrl from 'normalize-url';
import { readingTime } from 'reading-time-estimator';
import { Prisma, Resource as ResourceModel, Document as DocumentModel } from '@prisma/client';
import { RAGService } from '@/rag/rag.service';
import { PrismaService } from '@/common/prisma.service';
import { ElasticsearchService } from '@/common/elasticsearch.service';
import { MINIO_INTERNAL, MinioService } from '@/common/minio.service';
import {
  UpsertResourceRequest,
  ResourceMeta,
  ListResourcesData,
  User,
  GetResourceDetailData,
  IndexStatus,
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
} from '@refly-packages/openapi-schema';
import {
  QUEUE_SIMPLE_EVENT,
  QUEUE_RESOURCE,
  streamToString,
  QUEUE_SYNC_STORAGE_USAGE,
} from '@/utils';
import {
  genResourceID,
  cleanMarkdownForIngest,
  markdown2StateUpdate,
  genReferenceID,
  genDocumentID,
} from '@refly-packages/utils';
import { ExtendedReferenceModel, FinalizeResourceParam } from './knowledge.dto';
import { pick } from '../utils';
import { SimpleEventData } from '@/event/event.dto';
import { SyncStorageUsageJobData } from '@/subscription/subscription.dto';
import { SubscriptionService } from '@/subscription/subscription.service';
import { MiscService } from '@/misc/misc.service';
import {
  StorageQuotaExceeded,
  ResourceNotFoundError,
  ParamsError,
  ReferenceNotFoundError,
  ReferenceObjectMissingError,
  DocumentNotFoundError,
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
    @InjectQueue(QUEUE_SIMPLE_EVENT) private simpleEventQueue: Queue<SimpleEventData>,
    @InjectQueue(QUEUE_SYNC_STORAGE_USAGE) private ssuQueue: Queue<SyncStorageUsageJobData>,
  ) {}

  async listResources(user: User, param: ListResourcesData['query']) {
    const { resourceId, resourceType, page = 1, pageSize = 10, order = 'creationDesc' } = param;

    const resourceIdFilter: Prisma.StringFilter<'Resource'> = { equals: resourceId };

    return this.prisma.resource.findMany({
      where: { resourceId: resourceIdFilter, resourceType, uid: user.uid, deletedAt: null },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { pk: order === 'creationAsc' ? 'asc' : 'desc' },
    });
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

    return { ...resource, content };
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

    const resource = await this.prisma.resource.upsert({
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

    // Add to queue to be processed by worker
    await this.queue.add('finalizeResource', {
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
    await this.simpleEventQueue.add('simpleEvent', {
      entityType: 'resource',
      entityId: resourceId,
      name: 'onResourceReady',
      uid: user.uid,
    });

    // Sync storage usage
    await this.ssuQueue.add('syncStorageUsage', {
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
      this.ssuQueue.add('syncStorageUsage', {
        uid: user.uid,
        timestamp: new Date(),
      }),
    ]);
  }

  async listDocuments(user: User, param: ListDocumentsData['query']) {
    const { page = 1, pageSize = 10, order = 'creationDesc' } = param;

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
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });
  }

  async getDocumentDetail(
    user: User,
    params: GetDocumentDetailData['query'],
  ): Promise<DocumentModel & { content?: string }> {
    const { uid } = user;
    const { docId } = params;

    if (!docId) {
      throw new ParamsError('Document ID is required');
    }

    const doc = await this.prisma.document.findFirst({
      where: { docId, uid, deletedAt: null },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.minio.client.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    return { ...doc, content };
  }

  async createDocument(user: User, param: UpsertDocumentRequest) {
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (!usageResult.objectStorageAvailable || !usageResult.vectorStorageAvailable) {
      throw new StorageQuotaExceeded();
    }

    param.docId = genDocumentID();
    param.title ||= 'Untitled';
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
    if (param.initialContent) {
      const { size } = await this.ragService.indexDocument(user, {
        pageContent: param.initialContent,
        metadata: {
          nodeType: 'document',
          docId: param.docId,
          title: param.title,
        },
      });
      createInput.vectorSize = size;
    }

    const doc = await this.prisma.document.upsert({
      where: { docId: param.docId },
      create: createInput,
      update: pick(param, ['title', 'readOnly']),
    });

    await this.elasticsearch.upsertDocument({
      id: param.docId,
      ...pick(doc, ['title', 'uid']),
      content: param.initialContent,
      createdAt: doc.createdAt.toJSON(),
      updatedAt: doc.updatedAt.toJSON(),
    });

    await this.ssuQueue.add('syncStorageUsage', {
      uid: user.uid,
      timestamp: new Date(),
    });

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

    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { docId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'document', entityId: docId, uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    const cleanups: Promise<any>[] = [
      this.ragService.deleteCanvasNodes(user, docId),
      this.elasticsearch.deleteDocument(docId),
      this.miscService.removeFilesByEntity(user, {
        entityId: docId,
        entityType: 'canvas',
      }),
    ];

    if (doc.storageKey) {
      cleanups.push(this.minio.client.removeObject(doc.storageKey));
    }

    if (doc.stateStorageKey) {
      cleanups.push(this.minio.client.removeObject(doc.stateStorageKey));
    }

    await Promise.all(cleanups);

    // Sync storage usage after all the cleanups
    await this.ssuQueue.add('syncStorageUsage', {
      uid: user.uid,
      timestamp: new Date(),
    });
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
    references.forEach((ref) => {
      if (ref.sourceType === 'document') docIds.add(ref.sourceId);
      if (ref.targetType === 'document') docIds.add(ref.targetId);
      if (ref.sourceType === 'resource') resourceIds.add(ref.sourceId);
      if (ref.targetType === 'resource') resourceIds.add(ref.targetId);
    });

    // Fetch document mappings if there are any documents
    const docsMap: Record<string, DocumentModel> = {};
    if (docIds.size > 0) {
      const docs = await this.prisma.document.findMany({
        where: { docId: { in: Array.from(docIds) }, deletedAt: null },
      });
      docs.forEach((doc) => {
        docsMap[doc.docId] = doc;
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

    deduplicatedRefs.forEach((ref) => {
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
    });

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
