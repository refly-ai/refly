import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';
import { CanvasNotFoundError, ParamsError, StorageQuotaExceeded } from '@refly/errors';
import {
  AutoNameCanvasRequest,
  DeleteCanvasRequest,
  DuplicateCanvasRequest,
  CanvasState,
  Entity,
  EntityType,
  ListCanvasesData,
  RawCanvasData,
  UpsertCanvasRequest,
  User,
  SkillContext,
  ActionResult,
  WorkflowVariable,
  ResourceType,
  VariableValue,
  CanvasNode,
} from '@refly/openapi-schema';
import { Prisma } from '@prisma/client';
import {
  genCanvasID,
  genTransactionId,
  safeParseJSON,
  genActionResultID,
  genDocumentID,
  genResourceID,
  genCodeArtifactID,
} from '@refly/utils';
import { DeleteKnowledgeEntityJobData } from '../knowledge/knowledge.dto';
import { QUEUE_DELETE_KNOWLEDGE_ENTITY, QUEUE_POST_DELETE_CANVAS } from '../../utils/const';
import { AutoNameCanvasJobData, CanvasDetailModel, DeleteCanvasJobData } from './canvas.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { ResourceService } from '../knowledge/resource.service';
import { DocumentService } from '../knowledge/document.service';
import { ActionService } from '../action/action.service';
import { generateCanvasTitle } from './canvas-title-generator';
import { CanvasContentItem } from './canvas.dto';
import { RedisService } from '../common/redis.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { ProviderService } from '../provider/provider.service';
import { isDesktop } from '../../utils/runtime';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { initEmptyCanvasState, mirrorCanvasData } from '@refly/canvas-common';
import { ToolService } from '../tool/tool.service';
import { DriveService } from '../drive/drive.service';

@Injectable()
export class CanvasService {
  private logger = new Logger(CanvasService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private miscService: MiscService,
    private actionService: ActionService,
    private toolService: ToolService,
    private canvasSyncService: CanvasSyncService,
    private resourceService: ResourceService,
    private documentService: DocumentService,
    private providerService: ProviderService,
    private codeArtifactService: CodeArtifactService,
    private subscriptionService: SubscriptionService,
    private readonly driveService: DriveService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private fts: FulltextSearchService,
    @Optional()
    @InjectQueue(QUEUE_DELETE_KNOWLEDGE_ENTITY)
    private deleteKnowledgeQueue?: Queue<DeleteKnowledgeEntityJobData>,
    @Optional()
    @InjectQueue(QUEUE_POST_DELETE_CANVAS)
    private postDeleteCanvasQueue?: Queue<DeleteCanvasJobData>,
  ) {}

  async listCanvases(user: User, param: ListCanvasesData['query']): Promise<CanvasDetailModel[]> {
    const { page = 1, pageSize = 10, order = 'updationDesc', keyword } = param;

    // Build orderBy based on order parameter
    let orderBy: Prisma.CanvasOrderByWithRelationInput = { updatedAt: 'desc' as const };

    switch (order) {
      case 'creationAsc':
        orderBy = { createdAt: 'asc' as const };
        break;
      case 'creationDesc':
        orderBy = { createdAt: 'desc' as const };
        break;
      case 'updationAsc':
        orderBy = { updatedAt: 'asc' as const };
        break;
      case 'updationDesc':
        orderBy = { updatedAt: 'desc' as const };
        break;
      default:
        orderBy = { updatedAt: 'desc' as const };
    }

    // Build where clause with keyword search
    const where: Prisma.CanvasWhereInput = {
      uid: user.uid,
      deletedAt: null,
      visibility: true,
    };

    // Add keyword search if provided
    if (keyword?.trim()) {
      where.title = {
        contains: keyword.trim(),
        mode: 'insensitive',
      };
    }

    const canvases = await this.prisma.canvas.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get owner information (all canvases belong to the same user)
    const owner = await this.prisma.user.findUnique({
      select: {
        uid: true,
        name: true,
        nickname: true,
        avatar: true,
      },
      where: { uid: user.uid },
    });

    // Get share records for all canvases in one query
    const canvasIds = canvases.map((canvas) => canvas.canvasId);
    const shareRecords = await this.prisma.shareRecord.findMany({
      where: {
        entityId: { in: canvasIds },
        entityType: 'canvas',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Create a map of canvasId to shareRecord (taking the most recent one)
    const shareRecordMap = new Map<string, (typeof shareRecords)[0]>();
    for (const record of shareRecords) {
      if (!shareRecordMap.has(record.entityId)) {
        shareRecordMap.set(record.entityId, record);
      }
    }

    const workflowApps = await this.prisma.workflowApp.findMany({
      where: {
        canvasId: { in: canvasIds },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const workflowAppMap = new Map<string, (typeof workflowApps)[0] & { owner: typeof owner }>();
    for (const app of workflowApps) {
      if (!workflowAppMap.has(app.canvasId)) {
        workflowAppMap.set(app.canvasId, { ...app, owner });
      }
    }

    return canvases.map((canvas) => ({
      ...canvas,
      owner,
      shareRecord: shareRecordMap.get(canvas.canvasId) || null,
      workflowApp: workflowAppMap.get(canvas.canvasId) || null,
      minimapUrl: canvas.minimapStorageKey
        ? this.miscService.generateFileURL({ storageKey: canvas.minimapStorageKey })
        : undefined,
    }));
  }

  async getCanvasDetail(user: User, canvasId: string) {
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    return {
      ...canvas,
      minimapUrl: canvas.minimapStorageKey
        ? this.miscService.generateFileURL({ storageKey: canvas.minimapStorageKey })
        : undefined,
    };
  }

  async getCanvasRawData(
    user: User,
    canvasId: string,
    options?: { checkOwnership?: boolean },
  ): Promise<RawCanvasData> {
    const canvas = await this.prisma.canvas.findFirst({
      where: {
        canvasId,
        deletedAt: null,
        ...(options?.checkOwnership ? { uid: user.uid } : {}),
      },
    });

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const userPo = await this.prisma.user.findUnique({
      select: {
        name: true,
        nickname: true,
        avatar: true,
      },
      where: { uid: user.uid },
    });

    const { nodes, edges } = await this.canvasSyncService.getCanvasData(user, { canvasId }, canvas);

    return {
      title: canvas.title,
      nodes,
      edges,
      owner: {
        uid: canvas.uid,
        name: userPo?.name,
        nickname: userPo?.nickname,
        avatar: userPo?.avatar,
        createdAt: canvas.createdAt.toJSON(),
      },
      minimapUrl: canvas.minimapStorageKey
        ? this.miscService.generateFileURL({ storageKey: canvas.minimapStorageKey })
        : undefined,
      variables: canvas.workflow ? safeParseJSON(canvas.workflow)?.variables : undefined,
    };
  }

  async duplicateCanvas(
    user: User,
    param: DuplicateCanvasRequest,
    options?: { checkOwnership?: boolean },
  ) {
    const { title, canvasId, projectId, duplicateEntities = true } = param;

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, deletedAt: null, uid: options?.checkOwnership ? user.uid : undefined },
    });

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const { nodes, edges } = await this.canvasSyncService.getCanvasData(user, { canvasId }, canvas);

    const resources = await this.prisma.resource.findMany({
      select: { resourceId: true, title: true },
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    // Get workflow variables to identify resources that need duplication
    const workflowVariables = await this.getWorkflowVariables(user, { canvasId });

    // Create fake nodes for workflow resources to properly duplicate them
    const nodesWithResources = [
      ...nodes,
      ...(resources.map((resource) => ({
        id: resource.resourceId,
        type: 'resource' as const,
        position: { x: 0, y: 0 },
        data: {
          entityId: resource.resourceId,
          title: resource.title,
          metadata: {},
        },
      })) as CanvasNode[]),
    ];

    const libEntityNodes = nodesWithResources.filter((node) =>
      ['document', 'resource', 'codeArtifact'].includes(node.type),
    );

    // Check storage quota if entities need to be duplicated
    if (duplicateEntities) {
      const { available } = await this.subscriptionService.checkStorageUsage(user);
      if (available < libEntityNodes.length) {
        throw new StorageQuotaExceeded();
      }
    }

    const newCanvasId = genCanvasID();
    const newTitle = title || canvas.title;
    this.logger.log(`Duplicating canvas ${canvasId} to ${newCanvasId} with ${newTitle}`);

    // Pre-generate all new entity IDs upfront for better performance
    const replaceEntityMap = this.preGenerateEntityIds(nodesWithResources, canvasId, newCanvasId);

    // Create a temporary canvas record first to satisfy foreign key constraints
    // This will be updated later in the transaction
    await this.prisma.canvas.create({
      data: {
        uid: user.uid,
        canvasId: newCanvasId,
        title: newTitle,
        status: 'creating', // Temporary status
        projectId,
        version: '0', // Temporary version
        workflow: canvas.workflow,
      },
    });

    try {
      // Duplicate drive files
      const driveFiles = await this.prisma.driveFile.findMany({
        where: {
          canvasId,
          deletedAt: null,
        },
      });
      const fileIdMap = new Map<string, string>();
      const limit = pLimit(10);

      const promises = driveFiles.map((file: any) =>
        limit(async () => {
          try {
            const { fileId: newFileId } = (await this.driveService.duplicateDriveFile(
              user,
              file,
              newCanvasId,
            )) as any;

            fileIdMap.set(file.fileId, newFileId);

            this.logger.log(
              `Successfully duplicated drive file ${file.fileId} to ${newFileId} for share ${newCanvasId}`,
            );
          } catch (error) {
            this.logger.error(`Failed to duplicate drive file ${file.fileId}: ${error.stack}`);
          }
        }),
      );
      await Promise.all(promises);

      // Duplicate resources and documents if needed
      if (duplicateEntities) {
        const limit = pLimit(10); // Higher concurrency for better performance

        await Promise.all(
          libEntityNodes.map((node) =>
            limit(async () => {
              const entityType = node.type;
              const { entityId } = node.data;

              // Create new entity based on type
              switch (entityType) {
                case 'document': {
                  const doc = await this.documentService.duplicateDocument(user, {
                    docId: entityId,
                    title: node.data?.title,
                    canvasId: newCanvasId,
                  });
                  if (doc) {
                    node.data.entityId = doc.docId;
                    replaceEntityMap[entityId] = doc.docId;
                  }
                  break;
                }
                case 'resource': {
                  const resource = await this.resourceService.duplicateResource(user, {
                    resourceId: entityId,
                    title: node.data?.title,
                    canvasId: newCanvasId,
                  });
                  if (resource) {
                    node.data.entityId = resource.resourceId;
                    replaceEntityMap[entityId] = resource.resourceId;
                  }
                  break;
                }
                case 'codeArtifact': {
                  const codeArtifact = await this.codeArtifactService.duplicateCodeArtifact(user, {
                    artifactId: entityId,
                    canvasId: newCanvasId,
                  });
                  if (codeArtifact) {
                    node.data.entityId = codeArtifact.artifactId;
                    replaceEntityMap[entityId] = codeArtifact.artifactId;
                  }
                  break;
                }
              }
            }),
          ),
        );
      }

      // Process workflow variables to update entity IDs
      if (workflowVariables && workflowVariables.length > 0) {
        const updatedWorkflowVariables = workflowVariables.map((variable) => ({
          ...variable,
          value: (variable.value ?? []).map((value) => {
            if (
              value.type === 'resource' &&
              value.resource?.entityId &&
              replaceEntityMap[value.resource.entityId]
            ) {
              return {
                ...value,
                resource: {
                  ...value.resource,
                  entityId: replaceEntityMap[value.resource.entityId],
                },
              };
            }
            return value;
          }),
        }));

        // Update the canvas workflow with processed variables
        const workflowObj = { variables: updatedWorkflowVariables };
        await this.prisma.canvas.update({
          where: { canvasId: newCanvasId },
          data: { workflow: JSON.stringify(workflowObj) },
        });
      }

      // Action results must be duplicated
      const actionResultIds = nodes
        .filter((node) => node.type === 'skillResponse')
        .map((node) => node.data.entityId);
      await this.actionService.duplicateActionResults(user, {
        sourceResultIds: actionResultIds,
        targetId: newCanvasId,
        targetType: 'canvas',
        replaceEntityMap,
      });

      for (const node of nodes) {
        if (node.type !== 'skillResponse') {
          continue;
        }

        const { entityId, metadata } = node.data;
        if (entityId) {
          node.data.entityId = replaceEntityMap[entityId];
        }
        if (Array.isArray(metadata.contextItems)) {
          metadata.contextItems = metadata.contextItems.map((item) => {
            if (item.entityId && replaceEntityMap[item.entityId]) {
              item.entityId = replaceEntityMap[item.entityId];
            }
            return item;
          });
        }
      }

      if (canvas.uid !== user.uid) {
        await this.miscService.duplicateFilesNoCopy(user, {
          sourceEntityId: canvasId,
          sourceEntityType: 'canvas',
          sourceUid: user.uid,
          targetEntityId: newCanvasId,
          targetEntityType: 'canvas',
        });
      }

      const newState = {
        ...initEmptyCanvasState(),
        nodes,
        edges,
      };
      const stateStorageKey = await this.canvasSyncService.saveState(newCanvasId, newState);

      // Update canvas status and create version
      const [newCanvas] = await this.prisma.$transaction([
        this.prisma.canvas.update({
          where: { canvasId: newCanvasId },
          data: {
            status: 'ready',
            version: newState.version,
          },
        }),
        this.prisma.canvasVersion.create({
          data: {
            canvasId: newCanvasId,
            version: newState.version,
            hash: '',
            stateStorageKey,
          },
        }),
      ]);

      await this.prisma.duplicateRecord.create({
        data: {
          uid: user.uid,
          sourceId: canvasId,
          targetId: newCanvasId,
          entityType: 'canvas',
          status: 'finish',
        },
      });

      this.logger.log(`Successfully duplicated canvas ${canvasId} to ${newCanvasId}`);

      return newCanvas;
    } catch (error) {
      // If duplication fails, clean up the temporary canvas record
      await this.prisma.canvas.delete({
        where: { canvasId: newCanvasId },
      });
      this.logger.error(
        `Failed to duplicate canvas ${canvasId} to ${newCanvasId}: ${error?.message}`,
      );
      throw error;
    }
  }

  async createCanvasWithState(user: User, param: UpsertCanvasRequest, state: CanvasState) {
    param.canvasId ||= genCanvasID();
    const { canvasId } = param;
    const stateStorageKey = await this.canvasSyncService.saveState(canvasId, state);

    const [canvas] = await this.prisma.$transaction([
      this.prisma.canvas.create({
        data: {
          uid: user.uid,
          canvasId,
          title: param.title,
          projectId: param.projectId,
          version: state.version,
          workflow: JSON.stringify({ variables: param.variables }),
          visibility: param.visibility ?? true,
        },
      }),
      this.prisma.canvasVersion.create({
        data: {
          canvasId,
          version: state.version,
          hash: '',
          stateStorageKey,
        },
      }),
    ]);

    // Process resource variables after canvas is created
    const processedVariables = await this.processResourceVariables(user, canvasId, param.variables);
    const updatedCanvas = await this.prisma.canvas.update({
      where: { pk: canvas.pk },
      data: { workflow: JSON.stringify({ variables: processedVariables }) },
    });

    await this.fts.upsertDocument(user, 'canvas', {
      id: canvas.canvasId,
      title: canvas.title,
      createdAt: canvas.createdAt.toJSON(),
      updatedAt: canvas.updatedAt.toJSON(),
      uid: canvas.uid,
      projectId: canvas.projectId,
    });

    return updatedCanvas;
  }

  async createCanvas(user: User, param: UpsertCanvasRequest) {
    // Use the canvasId from param if provided, otherwise generate a new one
    param.canvasId ||= genCanvasID();

    const state = initEmptyCanvasState();
    return this.createCanvasWithState(user, param, state);
  }

  async updateCanvas(user: User, param: UpsertCanvasRequest) {
    const { canvasId, title, minimapStorageKey, projectId } = param;

    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const originalMinimap = canvas.minimapStorageKey;
    const updates: Prisma.CanvasUpdateInput = {};

    if (title !== undefined) {
      updates.title = title;
    }
    if (projectId !== undefined) {
      if (projectId) {
        updates.project = { connect: { projectId } };
      } else {
        updates.project = { disconnect: true };
      }
    }
    if (minimapStorageKey !== undefined) {
      const minimapFile = await this.miscService.findFileAndBindEntity(minimapStorageKey, {
        entityId: canvasId,
        entityType: 'canvas',
      });
      if (!minimapFile) {
        throw new ParamsError('Minimap file not found');
      }
      updates.minimapStorageKey = minimapFile.storageKey;
    }

    const updatedCanvas = await this.prisma.canvas.update({
      where: { canvasId, uid: user.uid, deletedAt: null },
      data: updates,
    });

    if (!updatedCanvas) {
      throw new CanvasNotFoundError();
    }

    // Remove original minimap if it exists
    if (
      originalMinimap &&
      minimapStorageKey !== undefined &&
      minimapStorageKey !== originalMinimap
    ) {
      await this.oss.removeObject(originalMinimap);
    }

    await this.fts.upsertDocument(user, 'canvas', {
      id: updatedCanvas.canvasId,
      title: updatedCanvas.title,
      updatedAt: updatedCanvas.updatedAt.toJSON(),
      uid: updatedCanvas.uid,
      projectId: updatedCanvas.projectId,
    });

    return updatedCanvas;
  }

  async deleteCanvas(user: User, param: DeleteCanvasRequest) {
    const { uid } = user;
    const { canvasId, deleteAllFiles = true } = param;

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    // Mark the canvas as deleted immediately
    await this.prisma.canvas.update({
      where: { canvasId },
      data: { deletedAt: new Date() },
    });

    // Add canvas deletion to queue for async processing
    if (this.postDeleteCanvasQueue) {
      await this.postDeleteCanvasQueue.add(
        'postDeleteCanvas',
        {
          uid,
          canvasId,
          deleteAllFiles,
        },
        {
          jobId: `canvas-cleanup-${canvasId}`,
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
    } else if (isDesktop()) {
      // In desktop mode, process deletion directly
      await this.postDeleteCanvas({
        uid,
        canvasId,
        deleteAllFiles,
      });
    }
  }

  async postDeleteCanvas(jobData: DeleteCanvasJobData) {
    const { uid, canvasId, deleteAllFiles = true } = jobData;
    this.logger.log(`Processing canvas cleanup for ${canvasId}, deleteAllFiles: ${deleteAllFiles}`);

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid, deletedAt: { not: null } }, // Make sure it's already marked as deleted
    });

    if (!canvas) {
      this.logger.warn(`Canvas ${canvasId} not found or not deleted`);
      return;
    }

    const cleanups: Promise<any>[] = [this.fts.deleteDocument({ uid }, 'canvas', canvas.canvasId)];

    if (canvas.stateStorageKey) {
      cleanups.push(this.oss.removeObject(canvas.stateStorageKey));
    }

    if (canvas.minimapStorageKey) {
      cleanups.push(this.oss.removeObject(canvas.minimapStorageKey));
    }

    if (deleteAllFiles) {
      const relations = await this.prisma.canvasEntityRelation.findMany({
        where: { canvasId, deletedAt: null },
      });
      const entities = relations.map((r) => ({
        entityId: r.entityId,
        entityType: r.entityType as EntityType,
      }));
      this.logger.log(`Entities to be deleted: ${JSON.stringify(entities)}`);

      for (const entity of entities) {
        if (this.deleteKnowledgeQueue) {
          await this.deleteKnowledgeQueue.add(
            'deleteKnowledgeEntity',
            {
              uid: canvas.uid,
              entityId: entity.entityId,
              entityType: entity.entityType,
            },
            {
              jobId: entity.entityId,
              removeOnComplete: true,
              removeOnFail: true,
              attempts: 3,
            },
          );
        }
        // Note: In desktop mode, entity deletion would be handled differently
        // or could be processed synchronously if needed
      }

      // Mark relations as deleted
      await this.prisma.canvasEntityRelation.updateMany({
        where: { canvasId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    try {
      await Promise.all(cleanups);
      this.logger.log(`Successfully cleaned up canvas ${canvasId}`);
    } catch (error) {
      this.logger.error(`Error cleaning up canvas ${canvasId}: ${error?.message}`);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  async syncCanvasEntityRelation(canvasId: string) {
    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const releaseLock = await this.redis.acquireLock(`canvas-entity-relation-lock:${canvasId}`);
    if (!releaseLock) {
      this.logger.warn(`Failed to acquire lock for canvas ${canvasId}`);
      return;
    }

    try {
      const { nodes } = await this.canvasSyncService.getCanvasData(
        { uid: canvas.uid },
        { canvasId },
        canvas,
      );

      const entities: Entity[] = nodes
        .map((node) => ({
          entityId: node.data?.entityId,
          entityType: node.type as EntityType,
        }))
        .filter((entity) => entity.entityId && entity.entityType);

      const existingRelations = await this.prisma.canvasEntityRelation.findMany({
        select: { entityId: true },
        where: { canvasId, deletedAt: null },
      });

      // Find relations to be removed (soft delete)
      const entityIds = new Set(entities.map((e) => e.entityId));
      const relationsToRemove = existingRelations.filter(
        (relation) => !entityIds.has(relation.entityId),
      );

      // Find new relations to be created
      const existingEntityIds = new Set(existingRelations.map((r) => r.entityId));
      const relationsToCreate = entities.filter(
        (entity) => !existingEntityIds.has(entity.entityId),
      );

      // Perform bulk operations
      await Promise.all([
        // Soft delete removed relations in bulk
        this.prisma.canvasEntityRelation.updateMany({
          where: {
            canvasId,
            entityId: { in: relationsToRemove.map((r) => r.entityId) },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        }),
        // Create new relations in bulk
        this.prisma.canvasEntityRelation.createMany({
          data: relationsToCreate.map((entity) => ({
            canvasId,
            entityId: entity.entityId,
            entityType: entity.entityType,
          })),
        }),
      ]);
    } finally {
      await releaseLock();
    }
  }

  /**
   * Delete entity nodes from all related canvases
   * @param entities
   */
  async deleteEntityNodesFromCanvases(entities: Entity[]) {
    this.logger.log(`Deleting entity nodes from canvases: ${JSON.stringify(entities)}`);

    // Find all canvases that have relations with these entities
    const relations = await this.prisma.canvasEntityRelation.findMany({
      where: {
        entityId: { in: entities.map((e) => e.entityId) },
        entityType: { in: entities.map((e) => e.entityType) },
        deletedAt: null,
      },
      distinct: ['canvasId'],
    });

    const canvasIds = relations.map((r) => r.canvasId);
    if (canvasIds.length === 0) {
      this.logger.log(`No related canvases found for entities: ${JSON.stringify(entities)}`);
      return;
    }
    this.logger.log(`Found related canvases: ${JSON.stringify(canvasIds)}`);

    const entityIdsToDelete = new Set(entities.map((e) => e.entityId));

    // Load each canvas and remove the nodes
    const limit = pLimit(3);
    await Promise.all(
      canvasIds.map((canvasId) =>
        limit(async () => {
          const canvas = await this.prisma.canvas.findUnique({
            where: { canvasId },
          });
          if (!canvas) return;

          // Remove nodes matching the entities
          const { nodes } = await this.canvasSyncService.getCanvasData(
            { uid: canvas.uid },
            { canvasId },
            canvas,
          );
          await this.canvasSyncService.syncState(
            { uid: canvas.uid },
            {
              canvasId,
              transactions: [
                {
                  txId: genTransactionId(),
                  createdAt: Date.now(),
                  nodeDiffs: nodes
                    .filter((node) => entityIdsToDelete.has(node.data?.entityId))
                    .map((node) => ({
                      type: 'delete',
                      id: node.id,
                      from: node,
                    })),
                  edgeDiffs: [],
                },
              ],
            },
          );

          // Update relations
          await this.prisma.canvasEntityRelation.updateMany({
            where: {
              canvasId,
              entityId: { in: entities.map((e) => e.entityId) },
              entityType: { in: entities.map((e) => e.entityType) },
              deletedAt: null,
            },
            data: { deletedAt: new Date() },
          });
        }),
      ),
    );
  }

  async getCanvasSkillResponses(user: User, canvasId: string) {
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    // Get skillResponse nodes from canvas data
    const { nodes } = await this.canvasSyncService.getCanvasData(user, { canvasId }, canvas);
    const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');

    // Extract resultIds from skillResponse nodes
    const skillResponses = skillResponseNodes.filter((node) => node.data?.entityId);

    return skillResponses;
  }

  async getCanvasContentItems(user: User, canvasId: string, needAllNodes = false) {
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    // Get skillResponse nodes from canvas data
    const { nodes } = await this.canvasSyncService.getCanvasData(user, { canvasId }, canvas);
    const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');

    // Extract resultIds from skillResponse nodes
    const resultIds = skillResponseNodes
      .map((node) => node.data?.entityId)
      .filter((entityId) => entityId);

    const results = await this.prisma.actionResult.findMany({
      select: {
        title: true,
        input: true,
        version: true,
        resultId: true,
        context: true,
        history: true,
      },
      orderBy: { version: 'desc' },
      where: {
        targetId: canvasId,
        targetType: 'canvas',
        type: 'skill',
        resultId: { in: resultIds },
      },
    });

    // Deduplicate results by resultId, keeping the maximum version
    const deduplicatedResults = results.reduce(
      (acc, current) => {
        const existing = acc.find((item) => item.resultId === current.resultId);
        if (!existing || current.version > existing.version) {
          const index = acc.findIndex((item) => item.resultId === current.resultId);
          if (index !== -1) {
            acc[index] = current;
          } else {
            acc.push(current);
          }
        }
        return acc;
      },
      [] as typeof results,
    );

    // Collect content items for title generation
    const contentItems: CanvasContentItem[] = await Promise.all(
      deduplicatedResults.map(async (result) => {
        const { resultId, version, title } = result;
        const steps = await this.prisma.actionStep.findMany({
          where: { resultId, version },
        });
        const answer = steps.map((s) => s.content.slice(0, 500)).join('\n');
        let context: SkillContext = { resources: [], documents: [], codeArtifacts: [] };

        try {
          const contextData = result.context;
          if (contextData && typeof contextData === 'string') {
            context = safeParseJSON(contextData);
          } else if (typeof contextData === 'object' && contextData !== null) {
            context = contextData;
          }
        } catch (error) {
          this.logger.warn(`Failed to parse context for result ${resultId}:`, error);
          context = { resources: [], documents: [], codeArtifacts: [] };
        }
        let history: ActionResult[] = [];

        try {
          const historyData = result.history;
          if (historyData && typeof historyData === 'string') {
            history = safeParseJSON(historyData);
          } else if (Array.isArray(historyData)) {
            history = historyData;
          }
        } catch (error) {
          this.logger.warn(`Failed to parse history for result ${resultId}:`, error);
          history = [];
        }

        return {
          id: resultId,
          title,
          input: safeParseJSON(result.input ?? '{}'),
          contentPreview: answer,
          content: steps.map((s) => s.content).join('\n\n'),
          type: 'skillResponse',
          inputIds: [
            ...(context.resources ?? []).map((r) => r.resourceId),
            ...(context.documents ?? []).map((d) => d.docId),
            ...(context.codeArtifacts ?? []).map((d) => d.artifactId),
            ...(Array.isArray(history) ? history.map((h) => h.resultId) : []),
          ],
        } as CanvasContentItem;
      }),
    );

    // If no action results, try to get all entities associated with the canvas
    if (contentItems.length === 0 || needAllNodes) {
      const relations = await this.prisma.canvasEntityRelation.findMany({
        where: { canvasId, entityType: { in: ['resource', 'document'] }, deletedAt: null },
      });

      const [documents, resources] = await Promise.all([
        this.prisma.document.findMany({
          select: { docId: true, title: true, contentPreview: true },
          where: {
            docId: {
              in: relations.filter((r) => r.entityType === 'document').map((r) => r.entityId),
            },
          },
        }),
        this.prisma.resource.findMany({
          select: { resourceId: true, title: true, contentPreview: true },
          where: {
            resourceId: {
              in: relations.filter((r) => r.entityType === 'resource').map((r) => r.entityId),
            },
          },
        }),
      ]);

      contentItems.push(
        ...documents.map((d) => ({
          id: d.docId,
          title: d.title,
          contentPreview: d.contentPreview,
          content: d.contentPreview, // TODO: check if we need to get the whole content
          type: 'document' as const,
        })),
        ...resources.map((r) => ({
          id: r.resourceId,
          title: r.title,
          contentPreview: r.contentPreview,
          content: r.contentPreview, // TODO: check if we need to get the whole content
          type: 'resource' as const,
        })),
      );
    }

    return contentItems;
  }

  async autoNameCanvas(user: User, param: AutoNameCanvasRequest) {
    const { canvasId, directUpdate = false } = param;
    const contentItems = await this.getCanvasContentItems(user, canvasId);

    const defaultModel = await this.providerService.findDefaultProviderItem(
      user,
      'titleGeneration',
    );
    const model = await this.providerService.prepareChatModel(user, defaultModel.itemId);
    this.logger.log(`Using default model for auto naming: ${model.name}`);

    // Use the new structured title generation approach
    const newTitle = await generateCanvasTitle(contentItems, model, this.logger);

    if (directUpdate && newTitle) {
      await this.updateCanvas(user, {
        canvasId,
        title: newTitle,
      });
    }

    return { title: newTitle };
  }

  async autoNameCanvasFromQueue(jobData: AutoNameCanvasJobData) {
    const { uid, canvasId } = jobData;
    const user = await this.prisma.user.findFirst({ where: { uid } });
    if (!user) {
      this.logger.warn(`user not found for uid ${uid} when auto naming canvas: ${canvasId}`);
      return;
    }

    const result = await this.autoNameCanvas(user, { canvasId, directUpdate: true });
    this.logger.log(`Auto named canvas ${canvasId} with title: ${result.title}`);
  }

  async importCanvas(user: User, param: { file: Buffer; canvasId?: string }) {
    const { file, canvasId } = param;

    let rawData: RawCanvasData;
    try {
      // Parse the uploaded file as RawCanvasData
      rawData = safeParseJSON(file.toString('utf-8'));
    } catch (error) {
      this.logger.warn(`Error importing canvas: ${error?.message}`);
      throw new ParamsError('Failed to parse canvas data');
    }

    // Validate the raw data structure
    if (!Array.isArray(rawData.nodes) || !Array.isArray(rawData.edges)) {
      throw new ParamsError('Invalid canvas data: missing nodes or edges');
    }

    // Extract data from RawCanvasData
    const { nodes, title = 'Imported Canvas', variables } = rawData;

    // Import toolsets and replace them in nodes
    const { replaceToolsetMap } = await this.toolService.importToolsetsFromNodes(user, nodes);
    const newCanvasData = mirrorCanvasData(rawData, { replaceToolsetMap });

    // Create canvas state
    const state: CanvasState = {
      ...initEmptyCanvasState(),
      ...newCanvasData,
    };

    // Generate canvas ID if not provided; avoid collisions for user-provided IDs
    let finalCanvasId = canvasId || genCanvasID();
    if (canvasId) {
      const exists = await this.prisma.canvas.findFirst({
        where: { canvasId, deletedAt: null },
      });
      if (exists) {
        if (exists.uid !== user.uid) {
          throw new ParamsError(`Canvas ID already exists: ${canvasId}`);
        }
        // Avoid collision with an existing canvas owned by the user
        finalCanvasId = genCanvasID();
      }
    }

    // Create the canvas with the imported state
    const canvas = await this.createCanvasWithState(
      user,
      {
        canvasId: finalCanvasId,
        title,
        variables,
      },
      state,
    );

    this.logger.log(`Successfully imported canvas ${finalCanvasId} for user ${user.uid}`);

    return canvas;
  }

  async exportCanvas(user: User, canvasId: string): Promise<string> {
    // Get the canvas raw data
    const canvasData = await this.getCanvasRawData(user, canvasId, { checkOwnership: true });

    // Convert to JSON string
    const jsonData = JSON.stringify(canvasData, null, 2);

    // Create a temporary file path for the export
    const timestamp = Date.now();
    const filename = `canvas-${canvasId}-${timestamp}.json`;
    const tempFilePath = `temp/${user.uid}/${filename}`;

    try {
      // Upload the JSON data as a buffer to object storage
      const buffer = Buffer.from(jsonData, 'utf-8');
      const uploadResult = await this.miscService.uploadBuffer(user, {
        fpath: tempFilePath,
        buf: buffer,
      });

      // Generate a presigned URL that expires in 1 hour (3600 seconds)
      const downloadUrl = await this.miscService.generateTempPublicURL(
        uploadResult.storageKey,
        3600,
      );

      this.logger.log(`Successfully exported canvas ${canvasId} for user ${user.uid}`);

      return downloadUrl;
    } catch (error) {
      this.logger.error(`Error exporting canvas ${canvasId}: ${error?.message}`);
      throw new ParamsError('Failed to export canvas data');
    }
  }

  /**
   * Process resource variables for workflow execution
   * @param user - The user processing the variables
   * @param variables - The workflow variables to process
   * @param canvasId - The target canvas ID
   * @returns Processed variables with updated resource information
   */
  async processResourceVariables(
    user: User,
    canvasId: string,
    variables: WorkflowVariable[],
  ): Promise<WorkflowVariable[]> {
    if (!Array.isArray(variables)) return [];

    const processedVariables = await Promise.all(
      variables.map(async (variable) => {
        const processedValues = await Promise.all(
          (variable.value ?? []).map(async (value) => {
            if (value.type === 'resource' && value.resource) {
              return await this.processResourceValue(user, canvasId, value);
            }
            return value;
          }),
        );
        return {
          ...variable,
          value: processedValues,
        };
      }),
    );

    return processedVariables;
  }

  /**
   * Process a single resource variable value
   * @param user - The user processing the resource
   * @param value - The resource variable value
   * @param canvasId - The target canvas ID
   * @returns Processed resource variable value
   */
  private async processResourceValue(
    user: User,
    canvasId: string,
    value: VariableValue,
  ): Promise<VariableValue> {
    this.logger.log(`Processing resource value for canvas ${canvasId}: ${JSON.stringify(value)}`);

    const { resource } = value;
    if (!resource) return value;

    const { storageKey } = resource;
    if (!storageKey) {
      this.logger.warn('Resource variable missing storageKey; skipping processing');
      return value;
    }

    // Check if static file already exists with entity_id and entity_type
    const resourceFile = await this.prisma.staticFile.findFirst({
      where: { storageKey, deletedAt: null },
    });

    if (resourceFile?.entityId && resourceFile?.entityType === 'resource') {
      // Resource already exists, read it
      this.logger.log(
        `Resource already exists for storageKey: ${storageKey}, entityId: ${resourceFile.entityId}`,
      );
      return value;
    }

    if (!resource.entityId) {
      // New upload - create new resource
      const newResource = await this.resourceService.createResource(
        user,
        {
          title: resource.name,
          resourceType: resource.fileType as ResourceType,
          canvasId,
          storageKey,
        },
        { skipCanvasCheck: true },
      );

      // Update static file with new entity information
      if (resourceFile) {
        await this.prisma.staticFile.update({
          where: { pk: resourceFile.pk },
          data: {
            entityId: newResource.resourceId,
            entityType: 'resource',
          },
        });
      }

      // Update the variable value with new entityId
      return {
        ...value,
        resource: {
          ...resource,
          entityId: newResource.resourceId,
        },
      };
    }

    // Find existing resource - update old resource
    const existingResource = await this.prisma.resource.findUnique({
      where: { resourceId: resource.entityId },
    });

    if (!existingResource) {
      this.logger.warn(`Existing resource not found: ${resource.entityId}`);
      return value;
    }

    // Update existing resource with new storage key
    await this.resourceService.updateResource(
      user,
      {
        title: resource.name,
        resourceType: existingResource.resourceType as ResourceType,
        canvasId,
        storageKey,
        resourceId: existingResource.resourceId,
      },
      { waitFor: 'parse_completed' }, // we must wait for the resource to be parsed
    );

    // Update static file with new entity information
    if (resourceFile) {
      await this.prisma.staticFile.update({
        where: { pk: resourceFile.pk },
        data: {
          entityId: existingResource.resourceId,
          entityType: 'resource',
        },
      });
    }

    return value;
  }

  /**
   * Helper method to pre-generate entity IDs for canvas nodes
   */
  private preGenerateEntityIds(
    nodes: CanvasNode[],
    originalCanvasId: string,
    newCanvasId: string,
  ): Record<string, string> {
    const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');
    const libEntityNodes = nodes.filter((node) =>
      ['document', 'resource', 'codeArtifact'].includes(node.type),
    );

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

    return {
      [originalCanvasId]: newCanvasId,
      ...preGeneratedActionResultIds,
      ...preGeneratedLibIds,
    };
  }

  /**
   * Get workflow variables from Canvas DB field
   * @param user - The user
   * @param param - The get workflow variables request
   * @returns The workflow variables
   */
  async getWorkflowVariables(user: User, param: { canvasId: string }): Promise<WorkflowVariable[]> {
    const { canvasId } = param;
    const canvas = await this.prisma.canvas.findUnique({
      select: { workflow: true },
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) return [];
    try {
      const workflow = canvas.workflow ? safeParseJSON(canvas.workflow) : undefined;
      return workflow?.variables ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Update workflow variables in Canvas DB field
   * @param user - The user
   * @param param - The update workflow variables request
   * @returns The updated workflow variables
   */
  async updateWorkflowVariables(
    user: User,
    param: { canvasId: string; variables: WorkflowVariable[] },
  ): Promise<WorkflowVariable[]> {
    const { canvasId, variables } = param;
    const canvas = await this.prisma.canvas.findUnique({
      select: { workflow: true },
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    let workflowObj: { variables: WorkflowVariable[] } = { variables: [] };
    if (canvas?.workflow) {
      try {
        workflowObj = safeParseJSON(canvas.workflow) ?? {};
      } catch {}
    }

    workflowObj.variables = await this.processResourceVariables(user, canvasId, variables);

    await this.prisma.canvas.update({
      where: { canvasId, uid: user.uid, deletedAt: null },
      data: { workflow: JSON.stringify(workflowObj) },
    });
    return workflowObj.variables;
  }
}
