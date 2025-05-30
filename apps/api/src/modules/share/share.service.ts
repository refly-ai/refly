import { Inject, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { ShareRecord } from '../../generated/client';
import * as Y from 'yjs';
import {
  ActionResult,
  CreateShareRequest,
  DeleteShareRequest,
  Document,
  DuplicateShareRequest,
  Entity,
  EntityType,
  ListSharesData,
  RawCanvasData,
  Resource,
  User,
} from '@refly/openapi-schema';
import {
  PageNotFoundError,
  ParamsError,
  ShareNotFoundError,
  StorageQuotaExceeded,
} from '@refly/errors';
import { ConfigService } from '@nestjs/config';
import { CanvasService } from '../canvas/canvas.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ActionService } from '../action/action.service';
import { actionResultPO2DTO } from '../action/action.dto';
import { documentPO2DTO, resourcePO2DTO } from '../knowledge/knowledge.dto';
import pLimit from 'p-limit';
import { RAGService } from '../rag/rag.service';
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
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { codeArtifactPO2DTO } from '../code-artifact/code-artifact.dto';

const SHARE_CODE_PREFIX: Record<EntityType, string> = {
  document: 'doc-',
  canvas: 'can-',
  resource: 'res-',
  skillResponse: 'skr-',
  codeArtifact: 'cod-',
  page: 'pag-',
  share: 'sha-',
  user: 'usr-',
  project: 'prj-',
};

function genShareId(entityType: keyof typeof SHARE_CODE_PREFIX): string {
  return SHARE_CODE_PREFIX[entityType] + createId();
}

interface ShareExtraData {
  vectorStorageKey: string;
}

@Injectable()
export class ShareService {
  private logger = new Logger(ShareService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ragService: RAGService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly knowledgeService: KnowledgeService,
    private readonly actionService: ActionService,
    private readonly codeArtifactService: CodeArtifactService,
    private readonly subscriptionService: SubscriptionService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private readonly fts: FulltextSearchService,
  ) {}

  async listShares(user: User, param: ListSharesData['query']) {
    const { shareId, entityId, entityType } = param;

    const shares = await this.prisma.shareRecord.findMany({
      where: { shareId, entityId, entityType, uid: user.uid, deletedAt: null },
    });

    return shares;
  }

  async createShareForCanvas(user: User, param: CreateShareRequest) {
    const { entityId: canvasId, title, parentShareId, allowDuplication } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: canvasId,
        entityType: 'canvas',
        uid: user.uid,
        deletedAt: null,
        templateId: null, // ignore canvas templates
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('canvas');

    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new ShareNotFoundError();
    }

    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    // If title is provided, use it as the title of the canvas
    if (title) {
      canvasData.title = title;
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations

    // Find all image nodes
    const imageNodes = canvasData.nodes?.filter((node) => node.type === 'image') ?? [];

    // Process all images in parallel with concurrency control
    const imageProcessingPromises = imageNodes.map((node) => {
      return limit(async () => {
        const storageKey = node.data?.metadata?.storageKey as string;
        if (storageKey) {
          try {
            const imageUrl = await this.miscService.publishFile(storageKey);
            // Update the node with the published image URL
            if (node.data?.metadata) {
              node.data.metadata.imageUrl = imageUrl;
            }
          } catch (error) {
            this.logger.error(`Failed to publish image for storageKey: ${storageKey}`, error);
          }
        }
        return node;
      });
    });

    // Wait for all image processing to complete
    await Promise.all(imageProcessingPromises);

    // Process other node types
    for (const node of canvasData.nodes ?? []) {
      if (node.type === 'document') {
        const { shareRecord, document } = await this.createShareForDocument(user, {
          entityId: node.data?.entityId,
          entityType: 'document',
          parentShareId: shareId,
          allowDuplication,
        });

        if (node.data) {
          node.data.contentPreview = document?.contentPreview;
          node.data.metadata = {
            ...node.data.metadata,
            shareId: shareRecord?.shareId,
          };
        }
      } else if (node.type === 'resource') {
        const { shareRecord, resource } = await this.createShareForResource(user, {
          entityId: node.data?.entityId,
          entityType: 'resource',
          parentShareId: shareId,
          allowDuplication,
        });

        if (node.data) {
          node.data.contentPreview = resource?.contentPreview;
          node.data.metadata = {
            ...node.data.metadata,
            shareId: shareRecord?.shareId,
          };
        }
      } else if (node.type === 'skillResponse') {
        const { shareRecord } = await this.createShareForSkillResponse(user, {
          entityId: node.data?.entityId,
          entityType: 'skillResponse',
          parentShareId: shareId,
          allowDuplication,
        });

        if (node.data) {
          node.data.metadata = {
            ...node.data.metadata,
            shareId: shareRecord?.shareId,
          };
        }
      } else if (node.type === 'codeArtifact') {
        const { shareRecord } = await this.createShareForCodeArtifact(user, {
          entityId: node.data?.entityId,
          entityType: 'codeArtifact',
          parentShareId: shareId,
          allowDuplication,
        });

        if (node.data) {
          node.data.metadata = {
            ...node.data.metadata,
            shareId: shareRecord?.shareId,
          };
        }
      }
    }

    // Publish minimap
    if (canvas.minimapStorageKey) {
      const minimapUrl = await this.miscService.publishFile(canvas.minimapStorageKey);
      canvasData.minimapUrl = minimapUrl;
    }

    // Upload public canvas data to Minio
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'canvas.json',
      buf: Buffer.from(JSON.stringify(canvasData)),
      entityId: canvasId,
      entityType: 'canvas',
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: canvasData.title,
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for canvas: ${canvasId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: canvasData.title,
          uid: user.uid,
          entityId: canvasId,
          entityType: 'canvas',
          storageKey,
          parentShareId,
          allowDuplication,
        },
      });
      this.logger.log(`Created new share record: ${shareRecord.shareId} for canvas: ${canvasId}`);
    }

    return { shareRecord, canvas };
  }

  async storeVector(
    user: User,
    param: {
      shareId: string;
      entityId: string;
      entityType: 'document' | 'resource';
      vectorStorageKey: string;
    },
  ) {
    const { shareId, entityId, entityType, vectorStorageKey } = param;
    const vector = await this.ragService.serializeToAvro(user, {
      nodeType: entityType as 'document' | 'resource',
      ...(entityType === 'document' && {
        docId: entityId,
      }),
      ...(entityType === 'resource' && {
        resourceId: entityId,
      }),
    });
    await this.miscService.uploadBuffer(user, {
      fpath: 'vector.avro',
      buf: vector.data,
      entityId: shareId,
      entityType: 'share',
      visibility: 'public',
      storageKey: vectorStorageKey,
    });
  }

  async restoreVector(
    user: User,
    param: {
      entityId: string;
      entityType: 'document' | 'resource';
      vectorStorageKey: string;
    },
  ) {
    const { entityId, entityType, vectorStorageKey } = param;
    const vector = await this.miscService.downloadFile({
      storageKey: vectorStorageKey,
      visibility: 'public',
    });
    await this.ragService.deserializeFromAvro(user, {
      data: vector,
      ...(entityType === 'document' && {
        targetDocId: entityId,
      }),
      ...(entityType === 'resource' && {
        targetResourceId: entityId,
      }),
    });
  }

  async createShareForDocument(user: User, param: CreateShareRequest) {
    const { entityId: documentId, parentShareId, allowDuplication } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: documentId,
        entityType: 'document',
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('document');

    const documentDetail = await this.knowledgeService.getDocumentDetail(user, {
      docId: documentId,
    });
    const document = documentPO2DTO(documentDetail);

    // Process document images
    document.content = await this.miscService.processContentImages(document.content ?? '');
    document.contentPreview = document.content.slice(0, 500);

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'document.json',
      buf: Buffer.from(JSON.stringify(document)),
      entityId: documentId,
      entityType: 'document',
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    // Duplicate state and store vector
    const extraData: ShareExtraData = {
      vectorStorageKey: `share/${shareId}-vector`,
    };
    await Promise.all([
      this.storeVector(user, {
        shareId,
        entityId: documentId,
        entityType: 'document',
        vectorStorageKey: extraData.vectorStorageKey,
      }),
    ]);

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: document.title,
          storageKey,
          parentShareId,
          allowDuplication,
          extraData: JSON.stringify(extraData),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for document: ${documentId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: document.title,
          uid: user.uid,
          entityId: documentId,
          entityType: 'document',
          storageKey,
          parentShareId,
          allowDuplication,
          extraData: JSON.stringify(extraData),
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for document: ${documentId}`,
      );
    }

    return { shareRecord, document };
  }

  async createShareForResource(user: User, param: CreateShareRequest) {
    const { entityId: resourceId, parentShareId, allowDuplication } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: resourceId,
        entityType: 'resource',
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('resource');

    const resourceDetail = await this.knowledgeService.getResourceDetail(user, {
      resourceId,
    });
    const resource = resourcePO2DTO(resourceDetail);

    // Process resource images
    resource.content = await this.miscService.processContentImages(resource.content ?? '');
    resource.contentPreview = resource.content.slice(0, 500);

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'resource.json',
      buf: Buffer.from(JSON.stringify(resource)),
      entityId: resourceId,
      entityType: 'resource',
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    // Duplicate and store vector
    const extraData: ShareExtraData = {
      vectorStorageKey: `share/${shareId}-vector`,
    };
    await this.storeVector(user, {
      shareId,
      entityId: resourceId,
      entityType: 'resource',
      vectorStorageKey: extraData.vectorStorageKey,
    });

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: resource.title,
          storageKey,
          parentShareId,
          allowDuplication,
          extraData: JSON.stringify(extraData),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for resource: ${resourceId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: resource.title,
          uid: user.uid,
          entityId: resourceId,
          entityType: 'resource',
          storageKey,
          parentShareId,
          allowDuplication,
          extraData: JSON.stringify(extraData),
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for resource: ${resourceId}`,
      );
    }

    return { shareRecord, resource };
  }

  async createShareForCodeArtifact(user: User, param: CreateShareRequest) {
    const { entityId, entityType, title, parentShareId, allowDuplication } = param;

    if (entityType !== 'codeArtifact') {
      throw new ParamsError('Entity type must be codeArtifact');
    }

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId,
        entityType: 'codeArtifact',
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('codeArtifact');

    // Get the code artifact data from either the shareData or shareDataStorageKey
    const codeArtifactData = await this.codeArtifactService.getCodeArtifactDetail(user, entityId);
    const codeArtifact = codeArtifactPO2DTO(codeArtifactData);

    // Upload the code artifact data to storage
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'codeArtifact.json',
      buf: Buffer.from(JSON.stringify(codeArtifact)),
      entityId,
      entityType: 'codeArtifact',
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: title ?? 'Code Artifact',
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for code artifact: ${entityId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: title ?? 'Code Artifact',
          uid: user.uid,
          entityId,
          entityType: 'codeArtifact',
          storageKey,
          parentShareId,
          allowDuplication,
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for code artifact: ${entityId}`,
      );
    }

    return { shareRecord };
  }

  async createShareForSkillResponse(user: User, param: CreateShareRequest) {
    const { entityId: resultId, parentShareId, allowDuplication, coverStorageKey } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: resultId,
        entityType: 'skillResponse',
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('skillResponse');

    const actionResultDetail = await this.actionService.getActionResult(user, {
      resultId,
    });
    const actionResult = actionResultPO2DTO(actionResultDetail);

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'skillResponse.json',
      buf: Buffer.from(JSON.stringify(actionResult)),
      entityId: resultId,
      entityType: 'skillResponse',
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    if (coverStorageKey) {
      await this.miscService.duplicateFile({
        sourceFile: {
          storageKey: coverStorageKey,
          visibility: 'public',
        },
        targetFile: {
          storageKey: `share-cover/${shareId}.png`,
          visibility: 'public',
        },
      });
    }

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: actionResult.title ?? 'Skill Response',
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for skill response: ${resultId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: actionResult.title ?? 'Skill Response',
          uid: user.uid,
          entityId: resultId,
          entityType: 'skillResponse',
          storageKey,
          parentShareId,
          allowDuplication,
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for skill response: ${resultId}`,
      );
    }

    return { shareRecord, actionResult };
  }

  async createShareForRawData(user: User, param: CreateShareRequest) {
    const {
      entityId,
      entityType,
      title,
      shareData,
      shareDataStorageKey,
      parentShareId,
      allowDuplication,
    } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId,
        entityType,
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId =
      existingShareRecord?.shareId ?? genShareId(entityType as keyof typeof SHARE_CODE_PREFIX);

    let rawData: Buffer | null;
    if (shareData) {
      rawData = Buffer.from(shareData);
    } else if (shareDataStorageKey) {
      rawData = await this.miscService.downloadFile({
        storageKey: shareDataStorageKey,
        visibility: 'public',
      });
    }

    if (!rawData) {
      throw new ParamsError('Share data is required either by shareData or shareDataStorageKey');
    }

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'rawData.json',
      buf: rawData,
      entityId,
      entityType,
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    let shareRecord = existingShareRecord;

    if (existingShareRecord) {
      // Update existing shareRecord
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: param.title ?? 'Raw Data',
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for raw data: ${entityId}`,
      );
    } else {
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title,
          uid: user.uid,
          entityId,
          entityType,
          storageKey,
          parentShareId,
          allowDuplication,
        },
      });

      this.logger.log(`Created new share record: ${shareRecord.shareId} for raw data: ${entityId}`);
    }

    return { shareRecord };
  }

  async createShareForPage(user: User, param: CreateShareRequest) {
    const { entityId: pageId, title, parentShareId, allowDuplication } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: pageId,
        entityType: 'page' as EntityType,
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('page');

    // Get page detail
    const page = await this.prisma.page.findFirst({
      where: {
        pageId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!page) {
      throw new PageNotFoundError();
    }

    // Get page node relations
    const nodeRelations = await this.prisma.pageNodeRelation.findMany({
      where: {
        pageId,
        deletedAt: null,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    // Read page current state
    let pageContent = {};
    let pageConfig = {
      layout: 'slides',
      theme: 'light',
    };

    try {
      // Read page state from storage service
      if (page.stateStorageKey) {
        const stateBuffer = await this.miscService.downloadFile({
          storageKey: page.stateStorageKey,
          visibility: 'private',
        });

        if (stateBuffer) {
          const update = new Uint8Array(stateBuffer);
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, update);

          // Extract page content
          const title = ydoc.getText('title').toString();
          const nodeIds = Array.from(ydoc.getArray('nodeIds').toArray());

          pageContent = {
            title,
            nodeIds,
          };

          // Extract page config
          const pageConfigMap = ydoc.getMap('pageConfig');
          if (pageConfigMap.size > 0) {
            pageConfig = {
              layout: (pageConfigMap.get('layout') as string) || 'slides',
              theme: (pageConfigMap.get('theme') as string) || 'light',
            };
          }
        }
      }
    } catch (error) {
      this.logger.error('Error reading page state:', error);
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations
    const tasks = nodeRelations.map((relation) => {
      return limit(async () => {
        const { relationId, nodeType, entityId } = relation;
        if (nodeType === 'resource') {
          const { shareRecord } = await this.createShareForResource(user, {
            entityId,
            entityType: 'resource',
            parentShareId,
            allowDuplication,
          });
          return { relationId, shareId: shareRecord.shareId };
        }
        if (nodeType === 'document') {
          const { shareRecord } = await this.createShareForDocument(user, {
            entityId,
            entityType: 'document',
            parentShareId,
            allowDuplication,
          });
          return { relationId, shareId: shareRecord.shareId };
        }
        if (nodeType === 'codeArtifact') {
          const { shareRecord } = await this.createShareForCodeArtifact(user, {
            entityId,
            entityType: 'codeArtifact',
            parentShareId,
            allowDuplication,
          });
          return { relationId, shareId: shareRecord.shareId };
        }
        if (nodeType === 'skillResponse') {
          const { shareRecord } = await this.createShareForSkillResponse(user, {
            entityId,
            entityType: 'skillResponse',
            parentShareId,
            allowDuplication,
          });
          return { relationId, shareId: shareRecord.shareId };
        }
        if (nodeType === 'image') {
          // Publish image to public bucket
          const nodeData = JSON.parse(relation.nodeData);
          if (nodeData.metadata?.storageKey) {
            nodeData.metadata.imageUrl = await this.miscService.publishFile(
              nodeData.metadata.storageKey,
            );
          }
          relation.nodeData = JSON.stringify(nodeData);
        }

        return { relationId, shareId: null };
      });
    });

    const relationShareResults = await Promise.all(tasks);
    const relationShareMap = new Map<string, string>();
    for (const { relationId, shareId } of relationShareResults) {
      if (shareId) {
        relationShareMap.set(relationId, shareId);
      }
    }

    // Create page data object
    const pageData = {
      page: {
        pageId: page.pageId,
        title: title || page.title,
        description: page.description,
        status: page.status,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
      content: pageContent,
      nodeRelations: nodeRelations.map((relation) => {
        const shareId = relationShareMap.get(relation.relationId);
        const nodeData = relation.nodeData
          ? typeof relation.nodeData === 'string'
            ? JSON.parse(relation.nodeData)
            : relation.nodeData
          : {};

        return {
          relationId: relation.relationId,
          pageId: relation.pageId,
          nodeId: relation.nodeId,
          nodeType: relation.nodeType,
          entityId: relation.entityId,
          orderIndex: relation.orderIndex,
          shareId: relationShareMap.get(relation.relationId),
          nodeData: {
            ...nodeData,
            metadata: {
              ...nodeData.metadata,
              shareId,
            },
          },
        };
      }),
      pageConfig,
      snapshotTime: new Date(),
    };

    // Upload page content to storage service
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'page.json',
      buf: Buffer.from(JSON.stringify(pageData)),
      entityId: pageId,
      entityType: 'page' as EntityType,
      visibility: 'public',
      storageKey: `share/${shareId}.json`,
    });

    let shareRecord: ShareRecord;

    if (existingShareRecord) {
      // Update existing share record
      shareRecord = await this.prisma.shareRecord.update({
        where: {
          pk: existingShareRecord.pk,
        },
        data: {
          title: pageData.page.title,
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(`Updated existing share record: ${shareRecord.shareId} for page: ${pageId}`);
    } else {
      // Create new share record
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: pageData.page.title,
          uid: user.uid,
          entityId: pageId,
          entityType: 'page' as EntityType,
          storageKey,
          parentShareId,
          allowDuplication,
          extraData: JSON.stringify({
            description: page.description,
          }),
        },
      });
      this.logger.log(`Created new share record: ${shareRecord.shareId} for page: ${pageId}`);
    }

    return { shareRecord, pageData };
  }

  async createShare(user: User, req: CreateShareRequest): Promise<ShareRecord> {
    const entityType = req.entityType as EntityType;

    switch (entityType) {
      case 'canvas':
        return (await this.createShareForCanvas(user, req)).shareRecord;
      case 'document':
        return (await this.createShareForDocument(user, req)).shareRecord;
      case 'resource':
        return (await this.createShareForResource(user, req)).shareRecord;
      case 'skillResponse':
        return (await this.createShareForSkillResponse(user, req)).shareRecord;
      case 'codeArtifact':
        return (await this.createShareForCodeArtifact(user, req)).shareRecord;
      case 'page':
        return (await this.createShareForPage(user, req)).shareRecord;
      default:
        throw new ParamsError(`Unsupported entity type ${req.entityType} for sharing`);
    }
  }

  async deleteShare(user: User, body: DeleteShareRequest) {
    const { shareId } = body;

    const mainRecord = await this.prisma.shareRecord.findFirst({
      where: { shareId, uid: user.uid, deletedAt: null },
    });

    if (!mainRecord) {
      throw new ShareNotFoundError();
    }

    const childRecords = await this.prisma.shareRecord.findMany({
      where: { parentShareId: shareId, uid: user.uid, deletedAt: null },
    });
    const allRecords = [mainRecord, ...childRecords];

    await this.prisma.shareRecord.updateMany({
      data: { deletedAt: new Date() },
      where: { pk: { in: allRecords.map((r) => r.pk) } },
    });

    await this.miscService.batchRemoveObjects(
      user,
      allRecords.map((r) => ({
        storageKey: r.storageKey,
        visibility: 'public',
      })),
    );
  }

  async duplicateSharedDocument(user: User, param: DuplicateShareRequest): Promise<Entity> {
    const { shareId, projectId } = param;

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

    // Generate a new document ID
    const newDocId = genDocumentID();

    const newStorageKey = `doc/${newDocId}.txt`;
    const newStateStorageKey = `state/${newDocId}`;

    const documentDetail: Document = JSON.parse(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

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
        this.restoreVector(user, {
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

  async duplicateSharedResource(user: User, param: DuplicateShareRequest): Promise<Entity> {
    const { shareId, projectId } = param;

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

    // Generate a new document ID
    const newResourceId = genResourceID();

    const newStorageKey = `resource/${newResourceId}.txt`;

    const resourceDetail: Resource = safeParseJSON(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

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
        this.restoreVector(user, {
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

  async duplicateSharedCodeArtifact(user: User, param: DuplicateShareRequest): Promise<Entity> {
    const { shareId } = param;

    // Find the source record
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    // Generate a new code artifact ID
    const newCodeArtifactId = genCodeArtifactID();

    // Download the shared code artifact data
    const codeArtifactDetail = safeParseJSON(
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

    const newStorageKey = `code-artifact/${newCodeArtifactId}`;
    await this.oss.putObject(newStorageKey, codeArtifactDetail.content);

    // Create a new code artifact record
    await this.prisma.codeArtifact.create({
      data: {
        ...pick(codeArtifactDetail, ['title', 'codeType', 'description']),
        artifactId: newCodeArtifactId,
        uid: user.uid,
        storageKey: newStorageKey,
        language: codeArtifactDetail.language,
        title: codeArtifactDetail.title,
        type: codeArtifactDetail.type,
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
    },
  ): Promise<Entity> {
    const { shareId, projectId } = param;
    const { replaceEntityMap, target } = extra ?? {};

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
    const result: ActionResult = JSON.parse(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    // Create a new action result record
    await this.prisma.$transaction([
      this.prisma.actionResult.create({
        data: {
          ...pick(result, ['version', 'title', 'tier', 'status']),
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

    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });
    if (!record) {
      throw new ShareNotFoundError();
    }

    const canvasData: RawCanvasData = JSON.parse(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    const newCanvasId = genCanvasID();
    const stateStorageKey = `state/${newCanvasId}`;

    const { nodes, edges } = canvasData;

    const libEntityNodes = nodes.filter((node) =>
      ['document', 'resource', 'codeArtifact'].includes(node.type),
    );

    // Check storage quota before creating a new canvas
    const { available } = await this.subscriptionService.checkStorageUsage(user);
    if (available < libEntityNodes.length) {
      throw new StorageQuotaExceeded();
    }

    await this.prisma.canvas.create({
      data: {
        uid: user.uid,
        canvasId: newCanvasId,
        title: canvasData.title,
        status: 'duplicating',
        stateStorageKey,
        projectId,
      },
    });

    // Duplicate library entities
    const limit = pLimit(5); // Limit concurrent operations
    const replaceEntityMap: Record<string, string> = {
      [record.entityId]: newCanvasId,
    };

    await Promise.all(
      libEntityNodes.map((node) =>
        limit(async () => {
          const entityType = node.type;
          const { entityId, metadata } = node.data;
          const shareId = metadata?.shareId as string;

          if (!shareId) return;

          // Create new entity based on type
          const nodeDupParam = { shareId, projectId };
          switch (entityType) {
            case 'document': {
              const doc = await this.duplicateSharedDocument(user, nodeDupParam);
              if (doc) {
                node.data.entityId = doc.entityId;
                replaceEntityMap[entityId] = doc.entityId;
              }
              break;
            }
            case 'resource': {
              const resource = await this.duplicateSharedResource(user, nodeDupParam);
              if (resource) {
                node.data.entityId = resource.entityId;
                replaceEntityMap[entityId] = resource.entityId;
              }
              break;
            }
            case 'codeArtifact': {
              const codeArtifact = await this.duplicateSharedCodeArtifact(user, nodeDupParam);
              if (codeArtifact) {
                node.data.entityId = codeArtifact.entityId;
                replaceEntityMap[entityId] = codeArtifact.entityId;
              }
              break;
            }
          }

          // Remove the shareId from the metadata
          node.data.metadata.shareId = undefined;

          // Replace the projectId with the new project ID
          node.data.metadata.projectId = projectId;
        }),
      ),
    );

    const resultIds = nodes
      .filter((node) => node.type === 'skillResponse')
      .map((node) => node.data.entityId);

    for (const resultId of resultIds) {
      replaceEntityMap[resultId] = genActionResultID();
    }

    await Promise.all(
      nodes
        .filter((node) => node.type === 'skillResponse')
        .map((node) =>
          limit(async () => {
            const shareId = node.data.metadata.shareId as string;
            if (!shareId) return;

            const result = await this.duplicateSharedSkillResponse(
              user,
              { shareId, projectId },
              {
                replaceEntityMap,
                target: { entityId: newCanvasId, entityType: 'canvas' },
              },
            );
            if (result) {
              node.data.entityId = result.entityId;
            }

            // Remove the shareId from the metadata
            node.data.metadata.shareId = undefined;

            // Replace the projectId with the new project ID
            node.data.metadata.projectId = projectId;

            // Replace the context with the new entity ID
            if (node.data.metadata.contextItems) {
              node.data.metadata.contextItems = JSON.parse(
                batchReplaceRegex(
                  JSON.stringify(node.data.metadata.contextItems),
                  replaceEntityMap,
                ),
              );
            }

            // Replace the structuredData with the new entity ID
            if (node.data.metadata.structuredData) {
              node.data.metadata.structuredData = JSON.parse(
                batchReplaceRegex(
                  JSON.stringify(node.data.metadata.structuredData),
                  replaceEntityMap,
                ),
              );
            }
          }),
        ),
    );

    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText('title').insert(0, canvasData.title);
      doc.getArray('nodes').insert(0, nodes);
      doc.getArray('edges').insert(0, edges);
    });

    await this.miscService.uploadBuffer(user, {
      fpath: stateStorageKey,
      buf: Buffer.from(Y.encodeStateAsUpdate(doc)),
      entityId: newCanvasId,
      entityType: 'canvas',
      visibility: 'private',
      storageKey: stateStorageKey,
    });

    // Update canvas status to completed
    await this.prisma.canvas.update({
      where: { canvasId: newCanvasId },
      data: { status: 'ready' },
    });

    await this.prisma.duplicateRecord.create({
      data: {
        sourceId: record.entityId,
        targetId: newCanvasId,
        entityType: 'canvas',
        uid: user.uid,
        shareId,
        status: 'finish',
      },
    });

    return { entityId: newCanvasId, entityType: 'canvas' };
  }

  async duplicateSharedPage(user: User, shareId: string): Promise<Entity> {
    // 查找分享记录
    const record = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });

    if (!record) {
      throw new ShareNotFoundError();
    }

    // 生成新的页面ID (使用PagesService的生成方式)
    const newPageId = `page-${createId()}`;
    const stateStorageKey = `pages/${user.uid}/${newPageId}/state.update`;

    // 下载分享的页面数据
    const pageData = JSON.parse(
      (
        await this.miscService.downloadFile({
          storageKey: record.storageKey,
          visibility: 'public',
        })
      ).toString(),
    );

    // 创建新的页面记录
    await this.prisma.$queryRawUnsafe(
      `
      INSERT INTO "pages" ("page_id", "uid", "title", "description", "state_storage_key", "status", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `,
      newPageId,
      user.uid,
      pageData.page.title,
      pageData.page.description,
      stateStorageKey,
      'draft',
    );

    // 创建Y.doc存储页面状态
    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText('title').insert(0, pageData.page.title);
      const nodeIds = Array.isArray(pageData.content.nodeIds) ? pageData.content.nodeIds : [];
      doc.getArray('nodeIds').insert(0, nodeIds);
      doc.getMap('pageConfig').set('layout', pageData.pageConfig.layout || 'slides');
      doc.getMap('pageConfig').set('theme', pageData.pageConfig.theme || 'light');
    });

    // 上传状态
    const state = Y.encodeStateAsUpdate(doc);
    await this.miscService.uploadBuffer(user, {
      fpath: 'page-state.update',
      buf: Buffer.from(state),
      entityId: newPageId,
      entityType: 'page' as EntityType,
      visibility: 'private',
      storageKey: stateStorageKey,
    });

    // 复制页面节点关联
    if (Array.isArray(pageData.nodeRelations) && pageData.nodeRelations.length > 0) {
      for (const relation of pageData.nodeRelations) {
        const relationId = `pnr-${createId()}`;
        await this.prisma.$queryRawUnsafe(
          `
          INSERT INTO "page_node_relations" ("relation_id", "page_id", "node_id", "node_type", "entity_id", "order_index", "node_data", "created_at", "updated_at")
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `,
          relationId,
          newPageId,
          relation.nodeId,
          relation.nodeType,
          relation.entityId,
          relation.orderIndex,
          JSON.stringify(relation.nodeData || {}),
        );
      }
    }

    // 创建复制记录
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

    // 根据shareId前缀确定类型
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

  /**
   * 获取分享数据的通用方法
   * @param storageKey 存储键
   * @returns 分享内容对象
   */
  async getSharedData(storageKey: string): Promise<any> {
    try {
      const contentBuffer = await this.miscService.downloadFile({
        storageKey,
        visibility: 'public',
      });

      return JSON.parse(contentBuffer.toString());
    } catch (error) {
      this.logger.error(`Error reading shared content from ${storageKey}:`, error);
      throw new Error('无法读取分享内容');
    }
  }
}
