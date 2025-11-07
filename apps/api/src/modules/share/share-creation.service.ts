import { Injectable, Logger, Optional } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { ShareRecord } from '../../generated/client';
import * as Y from 'yjs';
import { CreateShareRequest, EntityType, SharedCanvasData, User } from '@refly/openapi-schema';
import { PageNotFoundError, ParamsError, ShareNotFoundError } from '@refly/errors';
import { CanvasService } from '../canvas/canvas.service';
import { DocumentService } from '../knowledge/document.service';
import { ResourceService } from '../knowledge/resource.service';
import { ActionService } from '../action/action.service';
import { actionResultPO2DTO } from '../action/action.dto';
import { documentPO2DTO, resourcePO2DTO } from '../knowledge/knowledge.dto';
import pLimit from 'p-limit';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { CreditService } from '../credit/credit.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_CREATE_SHARE } from '../../utils/const';
import type { CreateShareJobData, SharePageData } from './share.dto';
import { codeArtifactPO2DTO } from '../code-artifact/code-artifact.dto';
import { ShareCommonService } from './share-common.service';
import { ShareRateLimitService } from './share-rate-limit.service';
import { ShareExtraData } from './share.dto';
import { SHARE_CODE_PREFIX } from './const';
import { safeParseJSON } from '@refly/utils';
import { generateCoverUrl } from '../workflow-app/workflow-app.dto';
import { omit } from '../../utils';
import { ConfigService } from '@nestjs/config';

function genShareId(entityType: keyof typeof SHARE_CODE_PREFIX): string {
  return SHARE_CODE_PREFIX[entityType] + createId();
}

@Injectable()
export class ShareCreationService {
  private logger = new Logger(ShareCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly documentService: DocumentService,
    private readonly resourceService: ResourceService,
    private readonly actionService: ActionService,
    private readonly codeArtifactService: CodeArtifactService,
    private readonly creditService: CreditService,
    private readonly shareCommonService: ShareCommonService,
    private readonly shareRateLimitService: ShareRateLimitService,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(QUEUE_CREATE_SHARE)
    private readonly createShareQueue?: Queue<CreateShareJobData>,
  ) {}

  /**
   * Process canvas data for sharing - handles media nodes, node processing, and minimap
   * This is a common method used by both createShareForCanvas and createShareForWorkflowApp
   */
  private async processCanvasForShare(
    user: User,
    canvasId: string,
    shareId: string,
    allowDuplication: boolean,
    title?: string,
  ): Promise<SharedCanvasData> {
    const canvasData: SharedCanvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    // If title is provided, use it as the title of the canvas
    if (title) {
      canvasData.title = title;
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations

    // Process resources in parallel
    const resources = await this.prisma.resource.findMany({
      where: {
        uid: user.uid,
        canvasId,
        deletedAt: null,
      },
    });

    const resourceShareRecords = await Promise.all(
      resources.map((resource) => {
        return this.createShareForResource(user, {
          entityId: resource.resourceId,
          entityType: 'resource',
          parentShareId: shareId,
          allowDuplication,
        });
      }),
    );
    canvasData.resources = resourceShareRecords.map((resource) =>
      omit(resource.resource, ['content']),
    );

    // Find all image video audio nodes
    const mediaNodes =
      canvasData.nodes?.filter(
        (node) => node.type === 'image' || node.type === 'video' || node.type === 'audio',
      ) ?? [];

    // Process all images in parallel with concurrency control
    const mediaProcessingPromises = mediaNodes.map((node) => {
      return limit(async () => {
        const storageKey = node.data?.metadata?.storageKey as string;
        if (storageKey) {
          try {
            const mediaUrl = await this.miscService.publishFile(storageKey);
            // Update the node with the published image URL
            if (node.data?.metadata) {
              node.data.metadata[`${node.type}Url`] = mediaUrl;
            }
          } catch (error) {
            this.logger.error(
              `Failed to publish image for storageKey: ${storageKey}, error: ${error.stack}`,
            );
          }
        }
        return node;
      });
    });

    // Wait for all image processing to complete
    await Promise.all(mediaProcessingPromises);

    // Group nodes by type for parallel processing
    const nodesByType = {
      document: [] as typeof canvasData.nodes,
      resource: [] as typeof canvasData.nodes,
      skillResponse: [] as typeof canvasData.nodes,
      codeArtifact: [] as typeof canvasData.nodes,
    };

    // Group nodes by their types
    for (const node of canvasData.nodes ?? []) {
      if (node.type in nodesByType) {
        nodesByType[node.type].push(node);
      }
    }

    // Process each node type in parallel with concurrency control
    const nodeProcessingLimit = pLimit(3); // Limit concurrent operations per type

    const processDocumentNodes = async () => {
      const promises = nodesByType.document.map((node) =>
        nodeProcessingLimit(async () => {
          try {
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
          } catch (error) {
            this.logger.error(
              `Failed to process document node ${node.data?.entityId}, error: ${error.stack}`,
            );
          }
        }),
      );
      await Promise.all(promises);
    };

    const processResourceNodes = async () => {
      const promises = nodesByType.resource.map((node) =>
        nodeProcessingLimit(async () => {
          try {
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
          } catch (error) {
            this.logger.error(
              `Failed to process resource node ${node.data?.entityId}, error: ${error.stack}`,
            );
          }
        }),
      );
      await Promise.all(promises);
    };

    const processSkillResponseNodes = async () => {
      const promises = nodesByType.skillResponse.map((node) =>
        nodeProcessingLimit(async () => {
          try {
            const { shareRecord } = await this.createShareForSkillResponse(user, {
              entityId: node.data?.entityId,
              entityType: 'skillResponse',
              parentShareId: shareId,
              allowDuplication,
            });

            // Query credit usage for this skill response
            const creditCost = await this.creditService.countResultCreditUsage(
              user,
              node.data?.entityId,
            );

            if (node.data) {
              node.data.metadata = {
                ...node.data.metadata,
                shareId: shareRecord?.shareId,
                creditCost,
              };
            }
          } catch (error) {
            this.logger.error(
              `Failed to process skill response node ${node.data?.entityId}, error: ${error.stack}`,
            );
          }
        }),
      );
      await Promise.all(promises);
    };

    const processCodeArtifactNodes = async () => {
      const promises = nodesByType.codeArtifact.map((node) =>
        nodeProcessingLimit(async () => {
          try {
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
          } catch (error) {
            this.logger.error(
              `Failed to process code artifact node ${node.data?.entityId}, error: ${error.stack}`,
            );
          }
        }),
      );
      await Promise.all(promises);
    };

    // Process all node types in parallel
    await Promise.all([
      processDocumentNodes(),
      processResourceNodes(),
      processSkillResponseNodes(),
      processCodeArtifactNodes(),
    ]);

    return canvasData;
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

    // Process canvas data using common method
    const canvasData = await this.processCanvasForShare(
      user,
      canvasId,
      shareId,
      allowDuplication,
      title,
    );

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

    const documentDetail = await this.documentService.getDocumentDetail(user, {
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
      this.shareCommonService.storeVector(user, {
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

    const resourceDetail = await this.resourceService.getResourceDetail(user, {
      resourceId,
    });
    const resource = resourcePO2DTO(resourceDetail);

    // Process resource images
    resource.shareId = shareId;
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
    await this.shareCommonService.storeVector(user, {
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
      await this.miscService.duplicateFile(user, {
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
    const pageContent = { title: '', nodeIds: [] };
    const pageConfig = {
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
          pageContent.title = ydoc.getText('title').toString();
          pageContent.nodeIds = Array.from(ydoc.getArray('nodeIds').toArray());

          // Extract page config
          const pageConfigMap = ydoc.getMap('pageConfig');
          if (pageConfigMap.size > 0) {
            pageConfig.layout = (pageConfigMap.get('layout') as string) || 'slides';
            pageConfig.theme = (pageConfigMap.get('theme') as string) || 'light';
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error reading page state, error: ${error.stack}`);
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations
    const tasks = nodeRelations.map((relation) => {
      return limit(async () => {
        const { relationId, nodeType, entityId } = relation;

        // NOTE: Resources are not stored in canvas any more. This is kept for backward compatibility.
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
          const nodeData = safeParseJSON(relation.nodeData);
          if (nodeData?.metadata?.storageKey) {
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
    const pageData: SharePageData = {
      canvasId: page.canvasId,
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
            ? safeParseJSON(relation.nodeData)
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

  async createShareForWorkflowApp(user: User, param: CreateShareRequest) {
    const { entityId: appId, title, parentShareId, allowDuplication, creditUsage } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: appId,
        entityType: 'workflowApp',
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Generate shareId only if needed
    const shareId = existingShareRecord?.shareId ?? genShareId('workflowApp');

    // Get workflow app data
    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    if (!workflowApp) {
      throw new ShareNotFoundError();
    }

    // Process canvas data using common method
    const canvasData = await this.processCanvasForShare(
      user,
      workflowApp.canvasId,
      shareId,
      allowDuplication,
      title,
    );

    // IMPORTANT: Add canvasId to canvasData for frontend access
    // Frontend needs canvasId for CanvasProvider and other canvas-related operations
    const canvasDataWithId = {
      ...canvasData,
      canvasId: workflowApp.canvasId,
    };

    // Publish minimap
    if (canvasDataWithId.minimapUrl) {
      canvasDataWithId.minimapUrl = await this.miscService.publishFile(canvasDataWithId.minimapUrl);
    }

    // Create public workflow app data
    const publicData = {
      appId: workflowApp.appId,
      title: title || canvasDataWithId.title,
      description: workflowApp.description,
      remixEnabled: workflowApp.remixEnabled,

      coverUrl: workflowApp.coverStorageKey
        ? generateCoverUrl(workflowApp.coverStorageKey)
        : undefined,
      templateContent: workflowApp.templateContent,
      resultNodeIds: workflowApp.resultNodeIds,
      query: workflowApp.query,
      variables: safeParseJSON(workflowApp.variables || '[]'),
      canvasData: canvasDataWithId, // Use the extended canvas data with canvasId
      creditUsage: Math.ceil(creditUsage * this.configService.get('credit.executionCreditMarkup')),
      createdAt: workflowApp.createdAt,
      updatedAt: workflowApp.updatedAt,
    };

    // Upload public workflow app data to Minio
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'workflow-app.json',
      buf: Buffer.from(JSON.stringify(publicData)),
      entityId: appId,
      entityType: 'workflowApp',
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
          title: publicData.title,
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Updated existing share record: ${shareRecord.shareId} for workflow app: ${appId}`,
      );
    } else {
      // Create new shareRecord
      shareRecord = await this.prisma.shareRecord.create({
        data: {
          shareId,
          title: publicData.title,
          uid: user.uid,
          entityId: appId,
          entityType: 'workflowApp',
          storageKey,
          parentShareId,
          allowDuplication,
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for workflow app: ${appId}`,
      );
    }

    return { shareRecord, workflowApp };
  }

  async createShare(user: User, req: CreateShareRequest): Promise<ShareRecord> {
    const entityType = req.entityType as EntityType;

    // Check rate limit before processing share creation
    await this.shareRateLimitService.enforceRateLimit(user.uid, entityType, req.entityId);

    // Try find existing record for idempotency
    const existing = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: req.entityId,
        entityType: entityType,
        uid: user.uid,
        deletedAt: null,
      },
    });
    if (existing) {
      // Ensure async processing continues for refresh use cases
      if (this.createShareQueue) {
        await this.createShareQueue.add('createShare', { user: { uid: user.uid }, req });
      }
      return existing;
    }

    const shareId = genShareId(entityType as keyof typeof SHARE_CODE_PREFIX);

    // Create minimal record to return immediately
    const minimal = await this.prisma.shareRecord.create({
      data: {
        shareId,
        title: req.title ?? '',
        uid: user.uid,
        entityId: req.entityId,
        entityType: entityType,
        storageKey: `share/${shareId}.json`,
        parentShareId: req.parentShareId,
        allowDuplication: req.allowDuplication ?? false,
      },
    });

    // Enqueue async job or fallback to direct processing
    if (this.createShareQueue) {
      await this.createShareQueue.add('createShare', { user: { uid: user.uid }, req });
    } else {
      // In desktop mode, process synchronously
      await this.processCreateShareJob({ user: { uid: user.uid }, req });
    }

    return minimal;
  }

  // Expose internal method for processor and fallback path
  async processCreateShareJob(jobData: CreateShareJobData) {
    const { user, req } = jobData;
    const entityType = req.entityType as EntityType;
    switch (entityType) {
      case 'canvas':
        await this.createShareForCanvas(user, req);
        return;
      case 'document':
        await this.createShareForDocument(user, req);
        return;
      case 'resource':
        await this.createShareForResource(user, req);
        return;
      case 'skillResponse':
        await this.createShareForSkillResponse(user, req);
        return;
      case 'codeArtifact':
        await this.createShareForCodeArtifact(user, req);
        return;
      case 'page':
        await this.createShareForPage(user, req);
        return;
      case 'workflowApp':
        await this.createShareForWorkflowApp(user, req);
        return;
      default:
        throw new ParamsError(`Unsupported entity type ${req.entityType} for sharing`);
    }
  }
}
