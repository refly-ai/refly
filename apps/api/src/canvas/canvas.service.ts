import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { MINIO_INTERNAL } from '@/common/minio.service';
import { MinioService } from '@/common/minio.service';
import { PrismaService } from '@/common/prisma.service';
import { MiscService } from '@/misc/misc.service';
import { CollabService } from '@/collab/collab.service';
import { CodeArtifactService } from '@/code-artifact/code-artifact.service';
import { ElasticsearchService } from '@/common/elasticsearch.service';
import { CanvasNotFoundError, ParamsError, StorageQuotaExceeded } from '@refly-packages/errors';
import {
  AutoNameCanvasRequest,
  DeleteCanvasRequest,
  DuplicateCanvasRequest,
  Entity,
  EntityType,
  ListCanvasesData,
  RawCanvasData,
  UpsertCanvasRequest,
  User,
  CanvasNode,
} from '@refly-packages/openapi-schema';
import { Prisma } from '@prisma/client';
import { genCanvasID } from '@refly-packages/utils';
import { DeleteKnowledgeEntityJobData } from '@/knowledge/knowledge.dto';
import { QUEUE_DELETE_KNOWLEDGE_ENTITY, QUEUE_POST_DELETE_CANVAS } from '@/utils/const';
import { AutoNameCanvasJobData, DeleteCanvasJobData } from './canvas.dto';
import { streamToBuffer } from '@/utils';
import { SubscriptionService } from '@/subscription/subscription.service';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import { ActionService } from '@/action/action.service';
import { generateCanvasTitle, CanvasContentItem } from './canvas-title-generator';

@Injectable()
export class CanvasService {
  private logger = new Logger(CanvasService.name);

  constructor(
    private prisma: PrismaService,
    private elasticsearch: ElasticsearchService,
    private collabService: CollabService,
    private miscService: MiscService,
    private actionService: ActionService,
    private knowledgeService: KnowledgeService,
    private codeArtifactService: CodeArtifactService,
    private subscriptionService: SubscriptionService,
    @Inject(MINIO_INTERNAL) private minio: MinioService,
    @InjectQueue(QUEUE_DELETE_KNOWLEDGE_ENTITY)
    private deleteKnowledgeQueue: Queue<DeleteKnowledgeEntityJobData>,
    @InjectQueue(QUEUE_POST_DELETE_CANVAS)
    private postDeleteCanvasQueue: Queue<DeleteCanvasJobData>,
  ) {}

  async listCanvases(user: User, param: ListCanvasesData['query']) {
    const { page = 1, pageSize = 10, projectId } = param;

    const canvases = await this.prisma.canvas.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
        projectId: projectId || null,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return canvases.map((canvas) => ({
      ...canvas,
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

  async getCanvasYDoc(stateStorageKey: string) {
    if (!stateStorageKey) {
      return null;
    }

    try {
      const readable = await this.minio.client.getObject(stateStorageKey);
      if (!readable) {
        throw new Error('Canvas state not found');
      }

      const state = await streamToBuffer(readable);
      if (!state?.length) {
        throw new Error('Canvas state is empty');
      }

      const doc = new Y.Doc();
      Y.applyUpdate(doc, state);

      return doc;
    } catch (error) {
      this.logger.warn(`Error getting canvas YDoc for key ${stateStorageKey}: ${error?.message}`);
      return null;
    }
  }

  async saveCanvasYDoc(stateStorageKey: string, doc: Y.Doc) {
    await this.minio.client.putObject(stateStorageKey, Buffer.from(Y.encodeStateAsUpdate(doc)));
  }

  async getCanvasRawData(user: User, canvasId: string): Promise<RawCanvasData> {
    const canvas = await this.prisma.canvas.findFirst({
      select: {
        title: true,
        uid: true,
        stateStorageKey: true,
        minimapStorageKey: true,
      },
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
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

    const doc = await this.getCanvasYDoc(canvas.stateStorageKey);

    return {
      title: canvas.title,
      nodes: doc?.getArray('nodes').toJSON() ?? [],
      edges: doc?.getArray('edges').toJSON() ?? [],
      owner: {
        uid: canvas.uid,
        name: userPo?.name,
        nickname: userPo?.nickname,
        avatar: userPo?.avatar,
      },
      minimapUrl: canvas.minimapStorageKey
        ? this.miscService.generateFileURL({ storageKey: canvas.minimapStorageKey })
        : undefined,
    };
  }

  async duplicateCanvas(
    user: User,
    param: DuplicateCanvasRequest,
    options?: { checkOwnership?: boolean },
  ) {
    const { title, canvasId, projectId, duplicateEntities } = param;

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, deletedAt: null, uid: options?.checkOwnership ? user.uid : undefined },
    });

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const doc = new Y.Doc();

    if (canvas.stateStorageKey) {
      const readable = await this.minio.client.getObject(canvas.stateStorageKey);
      const state = await streamToBuffer(readable);
      Y.applyUpdate(doc, state);
    }

    const nodes: CanvasNode[] = doc.getArray('nodes').toJSON();
    const libEntityNodes = nodes.filter((node) =>
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

    const stateStorageKey = `state/${newCanvasId}`;

    const newCanvas = await this.prisma.canvas.create({
      data: {
        uid: user.uid,
        canvasId: newCanvasId,
        title: newTitle,
        status: 'duplicating',
        stateStorageKey,
        projectId,
      },
    });

    // This is used to trace the replacement of entities
    // Key is the original entity id, value is the duplicated entity id
    const replaceEntityMap: Record<string, string> = {};

    // Duplicate resources and documents if needed
    if (duplicateEntities) {
      const limit = pLimit(5); // Limit concurrent operations

      await Promise.all(
        libEntityNodes.map((node) =>
          limit(async () => {
            const entityType = node.type;
            const { entityId } = node.data;

            // Create new entity based on type
            switch (entityType) {
              case 'document': {
                const doc = await this.knowledgeService.duplicateDocument(user, {
                  docId: entityId,
                  title: node.data?.title,
                });
                if (doc) {
                  node.data.entityId = doc.docId;
                  replaceEntityMap[entityId] = doc.docId;
                }
                break;
              }
              case 'resource': {
                const resource = await this.knowledgeService.duplicateResource(user, {
                  resourceId: entityId,
                  title: node.data?.title,
                });
                if (resource) {
                  node.data.entityId = resource.resourceId;
                  replaceEntityMap[entityId] = resource.resourceId;
                }
                break;
              }
              case 'codeArtifact': {
                const codeArtifact = await this.codeArtifactService.duplicateCodeArtifact(
                  user,
                  entityId,
                );
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

    doc.transact(() => {
      doc.getText('title').delete(0, doc.getText('title').length);
      doc.getText('title').insert(0, title);

      doc.getArray('nodes').delete(0, doc.getArray('nodes').length);
      doc.getArray('nodes').insert(0, nodes);
    });

    await this.minio.client.putObject(stateStorageKey, Buffer.from(Y.encodeStateAsUpdate(doc)));

    // Update canvas status to completed
    await this.prisma.canvas.update({
      where: { canvasId: newCanvasId },
      data: { status: 'ready' },
    });

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
  }

  async createCanvas(user: User, param: UpsertCanvasRequest) {
    const canvasId = genCanvasID();
    const stateStorageKey = `state/${canvasId}`;
    const canvas = await this.prisma.canvas.create({
      data: {
        uid: user.uid,
        canvasId,
        title: param.title,
        projectId: param.projectId,
        stateStorageKey,
      },
    });

    const ydoc = new Y.Doc();
    ydoc.getText('title').insert(0, param.title);

    await this.saveCanvasYDoc(stateStorageKey, ydoc);

    this.logger.log(`created canvas data: ${JSON.stringify(ydoc.toJSON())}`);

    await this.elasticsearch.upsertCanvas({
      id: canvas.canvasId,
      title: canvas.title,
      createdAt: canvas.createdAt.toJSON(),
      updatedAt: canvas.updatedAt.toJSON(),
      uid: canvas.uid,
      projectId: canvas.projectId,
    });

    return canvas;
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

    // Update title in yjs document
    if (title !== undefined) {
      const connection = await this.collabService.openDirectConnection(canvasId, {
        user,
        entity: updatedCanvas,
        entityType: 'canvas',
      });
      connection.document.transact(() => {
        const title = connection.document.getText('title');
        title.delete(0, title.length);
        title.insert(0, param.title);
      });
      await connection.disconnect();
    }

    // Remove original minimap if it exists
    if (
      originalMinimap &&
      minimapStorageKey !== undefined &&
      minimapStorageKey !== originalMinimap
    ) {
      await this.minio.client.removeObject(originalMinimap);
    }

    await this.elasticsearch.upsertCanvas({
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
    const { canvasId } = param;

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
    await this.postDeleteCanvasQueue.add(
      'postDeleteCanvas',
      {
        uid,
        canvasId,
        deleteAllFiles: param.deleteAllFiles,
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
  }

  async postDeleteCanvas(jobData: DeleteCanvasJobData) {
    const { uid, canvasId, deleteAllFiles } = jobData;
    this.logger.log(`Processing canvas cleanup for ${canvasId}, deleteAllFiles: ${deleteAllFiles}`);

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid, deletedAt: { not: null } }, // Make sure it's already marked as deleted
    });

    if (!canvas) {
      this.logger.warn(`Canvas ${canvasId} not found or not deleted`);
      return;
    }

    const cleanups: Promise<any>[] = [this.elasticsearch.deleteCanvas(canvas.canvasId)];

    if (canvas.stateStorageKey) {
      cleanups.push(this.minio.client.removeObject(canvas.stateStorageKey));
    }

    if (canvas.minimapStorageKey) {
      cleanups.push(this.minio.client.removeObject(canvas.minimapStorageKey));
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

    const ydoc = new Y.Doc();
    await this.collabService.loadDocument({
      document: ydoc,
      documentName: canvas.canvasId,
      context: {
        user: { uid: canvas.uid },
        entity: canvas,
        entityType: 'canvas',
      },
    });
    const nodes = ydoc.getArray('nodes').toJSON();

    const entities: Entity[] = nodes
      .map((node) => ({
        entityId: node.data?.entityId,
        entityType: node.type,
      }))
      .filter((entity) => entity.entityId && entity.entityType);

    const existingRelations = await this.prisma.canvasEntityRelation.findMany({
      where: { canvasId, deletedAt: null },
    });

    // Find relations to be removed (soft delete)
    const entityIds = new Set(entities.map((e) => e.entityId));
    const relationsToRemove = existingRelations.filter(
      (relation) => !entityIds.has(relation.entityId),
    );

    // Find new relations to be created
    const existingEntityIds = new Set(existingRelations.map((r) => r.entityId));
    const relationsToCreate = entities.filter((entity) => !existingEntityIds.has(entity.entityId));

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
        skipDuplicates: true,
      }),
    ]);
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

    // Load each canvas and remove the nodes
    const limit = pLimit(3);
    await Promise.all(
      canvasIds.map((canvasId) =>
        limit(async () => {
          const canvas = await this.prisma.canvas.findUnique({
            where: { canvasId },
          });
          if (!canvas) return;

          // Open connection to get the document
          const connection = await this.collabService.openDirectConnection(canvasId, {
            user: { uid: canvas.uid },
            entity: canvas,
            entityType: 'canvas',
          });

          // Remove nodes matching the entities
          connection.document.transact(() => {
            const nodes = connection.document.getArray('nodes');
            const toRemove: number[] = [];

            nodes.forEach((node: any, index: number) => {
              const entityId = node?.data?.entityId;
              const entityType = node?.type;

              if (entityId && entityType) {
                const matchingEntity = entities.find(
                  (e) => e.entityId === entityId && e.entityType === entityType,
                );
                if (matchingEntity) {
                  toRemove.push(index);
                }
              }
            });

            // Remove nodes in reverse order to maintain correct indices
            toRemove.reverse();
            for (const index of toRemove) {
              nodes.delete(index, 1);
            }
          });

          await connection.disconnect();

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

  async autoNameCanvas(user: User, param: AutoNameCanvasRequest) {
    const { canvasId, directUpdate = false } = param;

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const results = await this.prisma.actionResult.findMany({
      select: { title: true, input: true, version: true, resultId: true },
      where: { targetId: canvasId, targetType: 'canvas' },
    });

    // Collect content items for title generation
    const contentItems: CanvasContentItem[] = await Promise.all(
      results.map(async (result) => {
        const { resultId, version, input, title } = result;
        const steps = await this.prisma.actionStep.findMany({
          where: { resultId, version },
        });
        const parsedInput = JSON.parse(input ?? '{}');
        const question = parsedInput?.query ?? title;
        const answer = steps.map((s) => s.content.slice(0, 500)).join('\n');

        return {
          question,
          answer,
        };
      }),
    );

    // If no action results, try to get all entities associated with the canvas
    if (contentItems.length === 0) {
      const relations = await this.prisma.canvasEntityRelation.findMany({
        where: { canvasId, entityType: { in: ['resource', 'document'] }, deletedAt: null },
      });

      const documents = await this.prisma.document.findMany({
        select: { title: true, contentPreview: true },
        where: { docId: { in: relations.map((r) => r.entityId) } },
      });

      const resources = await this.prisma.resource.findMany({
        select: { title: true, contentPreview: true },
        where: { resourceId: { in: relations.map((r) => r.entityId) } },
      });

      contentItems.push(
        ...documents.map((d) => ({
          title: d.title,
          contentPreview: d.contentPreview,
        })),
        ...resources.map((r) => ({
          title: r.title,
          contentPreview: r.contentPreview,
        })),
      );
    }

    if (contentItems.length === 0) {
      return { title: '' };
    }

    const defaultModel = await this.subscriptionService.getDefaultModel();
    this.logger.log(`Using default model for auto naming: ${defaultModel?.name}`);

    // Use the new structured title generation approach
    const newTitle = await generateCanvasTitle(contentItems, defaultModel, this.logger);

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
}
