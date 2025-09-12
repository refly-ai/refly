import { Inject, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import * as Y from 'yjs';
import {
  ActionResult,
  CodeArtifact,
  Document,
  DuplicateShareRequest,
  Entity,
  EntityType,
  GenericToolset,
  RawCanvasData,
  Resource,
  User,
} from '@refly/openapi-schema';
import {
  ParamsError,
  ShareNotFoundError,
  StorageQuotaExceeded,
  DuplicationNotAllowedError,
} from '@refly/errors';
import { KnowledgeService } from '../knowledge/knowledge.service';
import pLimit from 'p-limit';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  genActionResultID,
  genCanvasID,
  genCodeArtifactID,
  genDocumentID,
  genResourceID,
  markdown2StateUpdate,
  pick,
  safeParseJSON,
  batchReplaceRegex,
} from '@refly/utils';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { ShareCommonService } from './share-common.service';
import { ShareExtraData, SharePageData } from './share.dto';
import { SHARE_CODE_PREFIX } from './const';
import { extractToolsetsWithNodes, initEmptyCanvasState } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';
import { ToolService } from '../tool/tool.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';

interface DuplicateOptions {
  skipCanvasCheck?: boolean;
  skipProjectCheck?: boolean;
  targetId?: string;
}

@Injectable()
export class ShareDuplicationService {
  private logger = new Logger(ShareDuplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly toolService: ToolService,
    private readonly knowledgeService: KnowledgeService,
    private readonly subscriptionService: SubscriptionService,
    private readonly shareCommonService: ShareCommonService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private readonly fts: FulltextSearchService,
  ) {}

  async duplicateSharedDocument(
    user: User,
    param: DuplicateShareRequest,
    options?: DuplicateOptions,
  ): Promise<Entity> {
    const { shareId, projectId, canvasId } = param;

    if (canvasId && !options?.skipCanvasCheck) {
      await this.knowledgeService.checkCanvasExists(user, canvasId);
    }

    if (projectId && !options?.skipProjectCheck) {
      await this.knowledgeService.checkProjectExists(user, projectId);
    }

    // Check storage quota
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < 1) {
      throw new StorageQuotaExceeded();
    }

    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    // Generate or use pre-generated document ID
    const newDocId = options?.targetId ?? genDocumentID();

    const newStorageKey = `doc/${newDocId}.txt`;
    const newStateStorageKey = `state/${newDocId}`;

    const documentDetail: Document | undefined = safeParseJSON(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    if (!documentDetail) {
      this.logger.error(`Failed to parse document detail for share ${shareId}`);
      throw new ShareNotFoundError();
    }

    const targetCanvasId = canvasId || documentDetail.canvasId;
    const extraData: ShareExtraData = safeParseJSON(record.extraData);

    const newDoc = await this.prisma.document.create({
      data: {
        title: documentDetail.title ?? 'Untitled Document',
        contentPreview: documentDetail.contentPreview ?? '',
        readOnly: documentDetail.readOnly ?? false,
        docId: newDocId,
        uid: user.uid,
        storageKey: newStorageKey,
        stateStorageKey: newStateStorageKey,
        projectId,
        canvasId: targetCanvasId,
      },
    });
    const state = markdown2StateUpdate(documentDetail.content ?? '');

    const jobs: Promise<any>[] = [
      this.oss.putObject(newStorageKey, documentDetail.content),
      this.oss.putObject(newStateStorageKey, Buffer.from(state)),
      this.fts.upsertDocument(user, 'document', {
        id: newDocId,
        ...pick(newDoc, ['title', 'uid']),
        content: documentDetail.content,
        createdAt: newDoc.createdAt.toJSON(),
        updatedAt: newDoc.updatedAt.toJSON(),
      }),
    ];

    if (extraData?.vectorStorageKey) {
      jobs.push(
        this.shareCommonService.restoreVector(user, {
          entityId: newDocId,
          entityType: 'document',
          vectorStorageKey: extraData.vectorStorageKey,
        }),
      );
    }

    // Duplicate the files and index
    await Promise.all(jobs);

    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newDocId,
        entityType: 'document',
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    await this.knowledgeService.syncStorageUsage(user);

    return { entityId: newDocId, entityType: 'document' };
  }

  async duplicateSharedResource(
    user: User,
    param: DuplicateShareRequest,
    options?: DuplicateOptions,
  ): Promise<Entity> {
    const { shareId, projectId, canvasId } = param;

    if (canvasId && !options?.skipCanvasCheck) {
      await this.knowledgeService.checkCanvasExists(user, canvasId);
    }

    if (projectId && !options?.skipProjectCheck) {
      await this.knowledgeService.checkProjectExists(user, projectId);
    }

    // Check storage quota
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < 1) {
      throw new StorageQuotaExceeded();
    }

    // Find the source document
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    // Generate or use pre-generated resource ID
    const newResourceId = options?.targetId ?? genResourceID();

    const newStorageKey = `resource/${newResourceId}.txt`;

    const resourceDetail: Resource | undefined = safeParseJSON(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    if (!resourceDetail) {
      this.logger.error(`Failed to parse resource detail for share ${shareId}`);
      throw new ShareNotFoundError();
    }

    const targetCanvasId = canvasId || resourceDetail.canvasId;
    const extraData: ShareExtraData = safeParseJSON(record.extraData);

    const newResource = await this.prisma.resource.create({
      data: {
        ...pick(resourceDetail, [
          'title',
          'resourceType',
          'contentPreview',
          'indexStatus',
          'indexError',
          'rawFileKey',
        ]),
        meta: JSON.stringify(resourceDetail.data),
        indexError: JSON.stringify(resourceDetail.indexError),
        resourceId: newResourceId,
        uid: user.uid,
        storageKey: newStorageKey,
        projectId,
        canvasId: targetCanvasId,
      },
    });

    const jobs: Promise<any>[] = [
      this.miscService.uploadBuffer(user, {
        fpath: 'document.txt',
        buf: Buffer.from(resourceDetail.content ?? ''),
        entityId: newResourceId,
        entityType: 'resource',
        visibility: 'private',
        storageKey: newStorageKey,
      }),
      this.fts.upsertDocument(user, 'resource', {
        id: newResourceId,
        ...pick(newResource, ['title', 'uid']),
        content: resourceDetail.content,
        createdAt: newResource.createdAt.toJSON(),
        updatedAt: newResource.updatedAt.toJSON(),
      }),
    ];

    if (extraData?.vectorStorageKey) {
      jobs.push(
        this.shareCommonService.restoreVector(user, {
          entityId: newResourceId,
          entityType: 'resource',
          vectorStorageKey: extraData.vectorStorageKey,
        }),
      );
    }

    // Duplicate the files and index
    await Promise.all(jobs);

    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newResourceId,
        entityType: 'resource',
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    await this.knowledgeService.syncStorageUsage(user);

    return { entityId: newResourceId, entityType: 'resource' };
  }

  async duplicateSharedCodeArtifact(
    user: User,
    param: DuplicateShareRequest,
    options?: DuplicateOptions,
  ): Promise<Entity> {
    const { shareId, canvasId } = param;

    if (canvasId && !options?.skipCanvasCheck) {
      await this.knowledgeService.checkCanvasExists(user, canvasId);
    }

    // Find the source record
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    // Generate or use pre-generated code artifact ID
    const newCodeArtifactId = options?.targetId ?? genCodeArtifactID();

    // Download the shared code artifact data
    const codeArtifactDetail: CodeArtifact | undefined = safeParseJSON(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    if (!codeArtifactDetail) {
      throw new ShareNotFoundError();
    }

    const targetCanvasId = canvasId || codeArtifactDetail.canvasId;

    const newStorageKey = `code-artifact/${newCodeArtifactId}`;
    await this.oss.putObject(newStorageKey, codeArtifactDetail.content);

    // Create a new code artifact record
    await this.prisma.codeArtifact.create({
      data: {
        ...pick(codeArtifactDetail, ['title']),
        artifactId: newCodeArtifactId,
        uid: user.uid,
        storageKey: newStorageKey,
        language: codeArtifactDetail.language,
        title: codeArtifactDetail.title,
        type: codeArtifactDetail.type,
        canvasId: targetCanvasId,
      },
    });

    // Create duplication record
    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newCodeArtifactId,
        entityType: 'codeArtifact',
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    return { entityId: newCodeArtifactId, entityType: 'codeArtifact' };
  }

  async duplicateSharedSkillResponse(
    user: User,
    param: DuplicateShareRequest,
    extra?: {
      target?: Entity;
      replaceEntityMap?: Record<string, string>;
      replaceToolsetMap?: Record<string, GenericToolset>;
    },
  ): Promise<Entity> {
    const { shareId, projectId } = param;
    const { replaceEntityMap, target, replaceToolsetMap } = extra ?? {};

    // Find the source record
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }
    const originalResultId = record.entityId;

    // Generate a new result ID for the skill response
    const newResultId = replaceEntityMap?.[originalResultId] || genActionResultID();

    // Download the shared skill response data
    const result: ActionResult | undefined = safeParseJSON(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    if (!result) {
      this.logger.error(`Failed to parse result detail for share ${shareId}`);
      throw new ShareNotFoundError();
    }

    // Replace toolsets with imported toolsets
    const replacedToolsets = result.toolsets?.map(
      (toolset) => replaceToolsetMap?.[toolset.id] || toolset,
    );

    // Create a new action result record
    await this.prisma.$transaction([
      this.prisma.actionResult.create({
        data: {
          ...pick(result, ['title', 'tier', 'status']),
          resultId: newResultId,
          uid: user.uid,
          type: result.type,
          input: JSON.stringify(result.input),
          targetId: target?.entityId,
          targetType: target?.entityType,
          actionMeta: JSON.stringify(result.actionMeta),
          context: batchReplaceRegex(JSON.stringify(result.context), replaceEntityMap),
          history: batchReplaceRegex(JSON.stringify(result.history), replaceEntityMap),
          tplConfig: JSON.stringify(result.tplConfig),
          runtimeConfig: JSON.stringify(result.runtimeConfig),
          errors: JSON.stringify(result.errors),
          modelName: result.modelInfo?.name,
          duplicateFrom: result.resultId,
          projectId,
          version: 0, // Reset version to 0 for the new duplicate
          toolsets: JSON.stringify(replacedToolsets),
        },
      }),
      ...(result.steps?.length > 0
        ? [
            this.prisma.actionStep.createMany({
              data: result.steps.map((step, index) => ({
                ...pick(step, ['name', 'reasoningContent']),
                order: index,
                content: step.content ?? '',
                resultId: newResultId,
                artifacts: batchReplaceRegex(JSON.stringify(step.artifacts), replaceEntityMap),
                structuredData: JSON.stringify(step.structuredData),
                logs: JSON.stringify(step.logs),
                tokenUsage: JSON.stringify(step.tokenUsage),
                version: 0, // Reset version to 0 for the new duplicate
              })),
            }),
          ]
        : []),
    ]);

    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newResultId,
        entityType: 'skillResponse',
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    return { entityId: newResultId, entityType: 'skillResponse' };
  }

  async duplicateSharedCanvas(user: User, param: DuplicateShareRequest): Promise<Entity> {
    const { shareId, projectId } = param;

    // Phase 1: Parallel data preloading
    const [record, , storageQuota] = await Promise.all([
      this.prisma.shareRecord.findFirst({
        where: { shareId, deletedAt: null },
      }),
      // Pre-load canvas data will be downloaded below
      null,
      this.subscriptionService.checkStorageUsage(user),
    ]);

    if (!record) {
      throw new ShareNotFoundError();
    }

    // Download canvas data in parallel with other operations
    const canvasDataPromise = this.miscService.downloadFile({
      storageKey: record.storageKey,
      visibility: 'public',
    });

    // Pre-generate all new IDs upfront
    const newCanvasId = genCanvasID();

    // Wait for canvas data to be available
    const canvasDataBuffer = await canvasDataPromise;
    const canvasData: RawCanvasData = safeParseJSON(canvasDataBuffer.toString());

    if (!canvasData) {
      this.logger.error(`Failed to parse canvas data for share ${shareId}`);
      throw new ShareNotFoundError();
    }

    const { nodes, edges } = canvasData;
    const libEntityNodes = nodes.filter((node) =>
      ['document', 'resource', 'codeArtifact'].includes(node.type),
    );

    // Check storage quota
    if (storageQuota.available < libEntityNodes.length) {
      throw new StorageQuotaExceeded();
    }

    // Create a new canvas
    const state = initEmptyCanvasState();
    await this.canvasService.createCanvasWithState(
      user,
      {
        canvasId: newCanvasId,
        title: canvasData.title,
        projectId,
      },
      state,
    );

    // Pre-generate all new entity IDs upfront for better performance
    const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');
    const preGeneratedActionResultIds: Record<string, string> = {};
    const preGeneratedLibIds: Record<string, string> = {};

    // Pre-generate IDs for all skill responses
    for (const node of skillResponseNodes) {
      preGeneratedActionResultIds[node.data.entityId] = genActionResultID();
    }

    // Pre-generate IDs for library entities (document/resource/codeArtifact)
    for (const node of libEntityNodes) {
      const oldId = node?.data?.entityId;
      if (!oldId) continue;
      if (node.type === 'document') {
        preGeneratedLibIds[oldId] = genDocumentID();
      } else if (node.type === 'resource') {
        preGeneratedLibIds[oldId] = genResourceID();
      } else if (node.type === 'codeArtifact') {
        preGeneratedLibIds[oldId] = genCodeArtifactID();
      }
    }

    // Phase 2: Duplicate entities with higher concurrency
    const limit = pLimit(10); // Increased concurrency limit for better performance
    const replaceEntityMap: Record<string, string> = {
      [record.entityId]: newCanvasId,
      ...preGeneratedActionResultIds,
      ...preGeneratedLibIds,
    };

    // Convert toolsets
    const toolsetsWithNodes = extractToolsetsWithNodes(nodes).map((t) => t.toolset);
    const { replaceToolsetMap } = await this.toolService.importToolsets(user, toolsetsWithNodes);
    this.logger.log(`Replace toolsets map: ${JSON.stringify(replaceToolsetMap)}`);

    // Prepare duplication tasks in parallel
    const libDupPromises = libEntityNodes.map((node) =>
      limit(async () => {
        const entityType = node.type;
        const { entityId, metadata } = node.data;
        const shareId = metadata?.shareId as string;

        if (!shareId) return;

        const nodeDupParam: DuplicateShareRequest = {
          shareId,
          projectId,
          canvasId: newCanvasId,
        };
        const targetId = replaceEntityMap[entityId];
        const nodeDupOptions: DuplicateOptions = {
          skipCanvasCheck: true,
          skipProjectCheck: true,
          targetId,
        };

        switch (entityType) {
          case 'document': {
            await this.duplicateSharedDocument(user, nodeDupParam, nodeDupOptions);
            node.data.entityId = targetId ?? node.data.entityId;
            break;
          }
          case 'resource': {
            await this.duplicateSharedResource(user, nodeDupParam, nodeDupOptions);
            node.data.entityId = targetId ?? node.data.entityId;
            break;
          }
          case 'codeArtifact': {
            await this.duplicateSharedCodeArtifact(user, nodeDupParam, nodeDupOptions);
            node.data.entityId = targetId ?? node.data.entityId;
            break;
          }
        }

        // Normalize metadata and update values
        node.data.metadata = { ...(node.data.metadata ?? {}), shareId: undefined, projectId };
      }),
    );

    const skillDupPromises = skillResponseNodes.map((node) =>
      limit(async () => {
        const shareId = node.data?.metadata?.shareId as string;
        if (!shareId) return;

        const result = await this.duplicateSharedSkillResponse(
          user,
          { shareId, projectId },
          {
            replaceEntityMap,
            replaceToolsetMap,
            target: { entityId: newCanvasId, entityType: 'canvas' },
          },
        );
        if (result) {
          node.data.entityId = result.entityId;
        }

        // Normalize metadata and update values
        node.data.metadata = { ...(node.data.metadata ?? {}), shareId: undefined, projectId };

        // Replace the context with the new entity ID
        if (node.data.metadata.contextItems) {
          node.data.metadata.contextItems = JSON.parse(
            batchReplaceRegex(JSON.stringify(node.data.metadata.contextItems), replaceEntityMap),
          );
        }

        // Replace the structuredData with the new entity ID
        if (node.data.metadata.structuredData) {
          node.data.metadata.structuredData = JSON.parse(
            batchReplaceRegex(JSON.stringify(node.data.metadata.structuredData), replaceEntityMap),
          );
        }

        // Replace the selected toolsets with the new toolsets
        if (node.data.metadata.selectedToolsets) {
          node.data.metadata.selectedToolsets = (
            node.data.metadata.selectedToolsets as GenericToolset[]
          ).map((toolset) => replaceToolsetMap[toolset.id] || toolset);
        }
      }),
    );

    await Promise.all([...libDupPromises, ...skillDupPromises]);

    // Phase 4: Parallelize state creation, upload, and final database operations
    state.nodes = nodes;
    state.edges = edges;

    // Parallelize canvas state update, and duplicate record creation
    await Promise.all([
      this.canvasSyncService.saveState(newCanvasId, state),
      this.prisma.duplicateRecord.create({
        data: {
          sourceId: record.entityId,
          targetId: newCanvasId,
          entityType: 'canvas',
          uid: user.uid,
          shareId,
          status: 'finish',
        },
      }),
      // Also sync storage usage in parallel
      this.knowledgeService.syncStorageUsage(user),
    ]);

    return { entityId: newCanvasId, entityType: 'canvas' };
  }

  async duplicateSharedPage(user: User, shareId: string): Promise<Entity> {
    // Find share record
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });

    if (!record) {
      throw new ShareNotFoundError();
    }

    // Generate new page ID
    const newPageId = `page-${createId()}`;
    const stateStorageKey = `pages/${user.uid}/${newPageId}/state.update`;

    // Download shared page data
    const pageData: SharePageData = JSON.parse(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    // Create new page record
    await this.prisma.page.create({
      data: {
        pageId: newPageId,
        uid: user.uid,
        canvasId: pageData.canvasId || '',
        title: pageData.page.title,
        description: pageData.page.description,
        stateStorageKey,
        status: 'draft',
      },
    });

    // Create Y.doc to store page state
    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText('title').insert(0, pageData.page.title);
      const nodeIds = Array.isArray(pageData.content.nodeIds) ? pageData.content.nodeIds : [];
      doc.getArray('nodeIds').insert(0, nodeIds);
      doc.getMap('pageConfig').set('layout', pageData.pageConfig.layout || 'slides');
      doc.getMap('pageConfig').set('theme', pageData.pageConfig.theme || 'light');
    });

    // Upload state
    const state = Y.encodeStateAsUpdate(doc);
    await this.miscService.uploadBuffer(user, {
      fpath: 'page-state.update',
      buf: Buffer.from(state),
      entityId: newPageId,
      entityType: 'page' as EntityType,
      visibility: 'private',
      storageKey: stateStorageKey,
    });

    // Duplicate page node relations
    if (Array.isArray(pageData.nodeRelations) && pageData.nodeRelations.length > 0) {
      const relationsData = pageData.nodeRelations.map((relation) => ({
        relationId: `pnr-${createId()}`,
        pageId: newPageId,
        nodeId: relation.nodeId,
        nodeType: relation.nodeType,
        entityId: relation.entityId,
        orderIndex: relation.orderIndex,
        nodeData: JSON.stringify(relation.nodeData || {}),
      }));

      await this.prisma.pageNodeRelation.createMany({
        data: relationsData,
      });
    }

    // Create duplicate record
    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newPageId,
        entityType: 'page' as any,
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    return { entityId: newPageId, entityType: 'page' as EntityType };
  }

  async duplicateShare(user: User, body: DuplicateShareRequest): Promise<Entity> {
    const { shareId } = body;

    if (!shareId) {
      throw new ParamsError('Share ID is required');
    }

    // Load share record to check duplication permission
    const record = await this.prisma.shareRecord.findUnique({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    // Check if duplication is allowed
    if (record.allowDuplication === false) {
      throw new DuplicationNotAllowedError();
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.canvas)) {
      return this.duplicateSharedCanvas(user, body);
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.document)) {
      return this.duplicateSharedDocument(user, body);
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.resource)) {
      return this.duplicateSharedResource(user, body);
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.skillResponse)) {
      return this.duplicateSharedSkillResponse(user, body);
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.codeArtifact)) {
      return this.duplicateSharedCodeArtifact(user, body);
    }

    if (shareId.startsWith(SHARE_CODE_PREFIX.page)) {
      return this.duplicateSharedPage(user, shareId);
    }

    throw new ParamsError(`Unsupported share type ${shareId}`);
  }
}
