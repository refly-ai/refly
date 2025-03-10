import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '@/common/prisma.service';
import { MiscService } from '@/misc/misc.service';
import { ShareRecord } from '@prisma/client';
import {
  CreateShareRequest,
  DeleteShareRequest,
  DuplicateShareRequest,
  Entity,
  ListSharesData,
  User,
} from '@refly-packages/openapi-schema';
import { ParamsError, ShareNotFoundError } from '@refly-packages/errors';
import { ConfigService } from '@nestjs/config';
import { CanvasService } from '@/canvas/canvas.service';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import { ActionService } from '@/action/action.service';
import { actionResultPO2DTO } from '@/action/action.dto';
import { documentPO2DTO, resourcePO2DTO } from '@/knowledge/knowledge.dto';
import pLimit from 'p-limit';

const SHARE_CODE_PREFIX = {
  document: 'doc-',
  canvas: 'can-',
  resource: 'res-',
  skillResponse: 'skr-',
  codeArtifact: 'cod-',
};

function genShareId(entityType: keyof typeof SHARE_CODE_PREFIX): string {
  return SHARE_CODE_PREFIX[entityType] + createId();
}

@Injectable()
export class ShareService {
  private logger = new Logger(ShareService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly knowledgeService: KnowledgeService,
    private readonly actionService: ActionService,
  ) {}

  async listShares(user: User, param: ListSharesData['query']) {
    const { shareId, entityId, entityType } = param;

    const shares = await this.prisma.shareRecord.findMany({
      where: { shareId, entityId, entityType, uid: user.uid, deletedAt: null },
    });

    return shares;
  }

  async createShareForCanvas(user: User, param: CreateShareRequest) {
    const { entityId: canvasId, parentShareId, allowDuplication } = param;

    // Check if shareRecord already exists
    const existingShareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        entityId: canvasId,
        entityType: 'canvas',
        uid: user.uid,
        deletedAt: null,
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
          title: canvas.title,
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
          title: canvas.title,
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

    const documentDetail = await this.knowledgeService.getDocumentDetail(user, {
      docId: documentId,
    });
    const document = documentPO2DTO(documentDetail);

    // Process document images
    document.content = await this.processContentImages(document.content ?? '');
    document.contentPreview = document.content.slice(0, 500);

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'document.json',
      buf: Buffer.from(JSON.stringify(document)),
      entityId: documentId,
      entityType: 'document',
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
          title: document.title,
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
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
    resource.content = await this.processContentImages(resource.content ?? '');
    resource.contentPreview = resource.content.slice(0, 500);

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'resource.json',
      buf: Buffer.from(JSON.stringify(resource)),
      entityId: resourceId,
      entityType: 'resource',
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
          title: resource.title,
          storageKey,
          parentShareId,
          allowDuplication,
          updatedAt: new Date(),
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
        },
      });
      this.logger.log(
        `Created new share record: ${shareRecord.shareId} for resource: ${resourceId}`,
      );
    }

    return { shareRecord, resource };
  }

  async createShareForSkillResponse(user: User, param: CreateShareRequest) {
    const { entityId: resultId, parentShareId, allowDuplication } = param;

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
    const { entityId, entityType, title, shareData, parentShareId, allowDuplication } = param;

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

    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'rawData.json',
      buf: Buffer.from(shareData),
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

  /**
   * Process content images and replace them with public URLs
   * @param content - The content to process
   * @returns The processed content with public URLs
   */
  async processContentImages(content: string) {
    // Extract all markdown image references: ![alt](url)
    const images = content?.match(/!\[.*?\]\((.*?)\)/g);
    if (!images?.length) {
      return content;
    }

    // Set up concurrency limit for image processing
    const limit = pLimit(5); // Limit to 5 concurrent operations

    const privateStaticEndpoint = this.config.get('static.private.endpoint')?.replace(/\/$/, '');

    // Create an array to store all image processing operations and their results
    const imageProcessingTasks = images.map((imageRef) => {
      return limit(async () => {
        // Extract the URL from the markdown image syntax
        const urlMatch = imageRef.match(/!\[.*?\]\((.*?)\)/);
        if (!urlMatch?.[1]) return null;

        const originalUrl = urlMatch[1];

        // Extract the storage key only if private
        if (!originalUrl.startsWith(privateStaticEndpoint)) return null;

        const storageKey = originalUrl.replace(`${privateStaticEndpoint}/`, '');
        if (!storageKey) return null;

        try {
          // Publish the file to public bucket
          const publicUrl = await this.miscService.publishFile(storageKey);

          // Return info needed for replacement
          return {
            originalImageRef: imageRef,
            originalUrl,
            publicUrl,
          };
        } catch (error) {
          this.logger.error(`Failed to publish image for storageKey: ${storageKey}`, error);
          return null;
        }
      });
    });

    // Wait for all image processing tasks to complete
    const processedImages = await Promise.all(imageProcessingTasks);

    // Apply all replacements to the content
    let updatedContent = content;
    for (const result of processedImages) {
      if (result) {
        const { originalImageRef, originalUrl, publicUrl } = result;
        const newImageRef = originalImageRef.replace(originalUrl, publicUrl);
        updatedContent = updatedContent.replace(originalImageRef, newImageRef);
      }
    }

    return updatedContent;
  }

  async createShare(user: User, req: CreateShareRequest): Promise<ShareRecord> {
    switch (req.entityType) {
      case 'canvas':
        return (await this.createShareForCanvas(user, req)).shareRecord;
      case 'document':
        return (await this.createShareForDocument(user, req)).shareRecord;
      case 'resource':
        return (await this.createShareForResource(user, req)).shareRecord;
      case 'skillResponse':
        return (await this.createShareForSkillResponse(user, req)).shareRecord;
      case 'codeArtifact':
        return (await this.createShareForRawData(user, req)).shareRecord;
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

  async duplicateShare(user: User, body: DuplicateShareRequest): Promise<Entity> {
    const { shareId } = body;

    if (!shareId) {
      throw new ParamsError('Share ID is required');
    }

    const shareRecord = await this.prisma.shareRecord.findUnique({
      where: { shareId, deletedAt: null },
    });

    if (!shareRecord) {
      throw new ShareNotFoundError();
    }

    const { entityId, entityType } = shareRecord;
    if (entityType !== 'canvas') {
      throw new ParamsError(`Unsupported entity type ${entityType} for duplication`);
    }

    const newCanvas = await this.canvasService.duplicateCanvas(user, {
      canvasId: entityId,
      duplicateEntities: true,
    });

    return { entityId: newCanvas.canvasId, entityType: 'canvas' };
  }
}
