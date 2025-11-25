import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import {
  DeleteShareRequest,
  ListSharesData,
  User,
  SharedCanvasData,
  EntityType,
} from '@refly/openapi-schema';
import { ShareNotFoundError } from '@refly/errors';
import { RAGService } from '../rag/rag.service';
import { ShareRateLimitService } from './share-rate-limit.service';
import { safeParseJSON } from '@refly/utils';
import { DriveService } from '../drive/drive.service';
import pLimit from 'p-limit';

@Injectable()
export class ShareCommonService {
  private logger = new Logger(ShareCommonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RAGService,
    private readonly miscService: MiscService,
    private readonly shareRateLimitService: ShareRateLimitService,
    private readonly driveService: DriveService,
  ) {}

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
      nodeType: entityType,
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

  async listShares(user: User, param: ListSharesData['query']) {
    const { shareId, entityId, entityType } = param;

    const shares = await this.prisma.shareRecord.findMany({
      where: { shareId, entityId, entityType, uid: user.uid, deletedAt: null },
    });

    return shares;
  }

  async deleteShare(user: User, body: DeleteShareRequest) {
    const { shareId } = body;

    const mainRecord = await this.prisma.shareRecord.findFirst({
      where: { shareId, uid: user.uid, deletedAt: null },
    });

    if (!mainRecord) {
      throw new ShareNotFoundError();
    }

    // Check rate limit before processing share deletion
    await this.shareRateLimitService.enforceRateLimit(
      user.uid,
      mainRecord.entityType as EntityType,
      mainRecord.entityId,
    );

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
      { force: true }, // share static files must be deleted
    );
  }

  /**
   * Common method to get shared data
   * @param storageKey object storage key
   * @returns shared data object
   */
  async getSharedData(storageKey: string): Promise<any> {
    try {
      const contentBuffer = await this.miscService.downloadFile({
        storageKey,
        visibility: 'public',
      });

      return safeParseJSON(contentBuffer.toString());
    } catch (error) {
      this.logger.error(`Error reading shared content from ${storageKey}, ${error.stack}`);
      throw new ShareNotFoundError();
    }
  }

  /**
   * Handle file duplication and cleanup for share creation/update
   * This is the main entry point for processing files when creating or updating shares
   */
  async processFilesForShare(
    user: User,
    canvasData: SharedCanvasData,
    shareId: string,
    existingShareRecord: any | null,
  ): Promise<void> {
    // If updating an existing share, clean up old files first
    if (existingShareRecord) {
      await this.cleanupOldSharedFiles(user, shareId);
    }

    // Duplicate drive files for the share to make it independent from original canvas
    if (canvasData.files && canvasData.files.length > 0) {
      const { fileIdMap, storageKeyMap } = await this.duplicateDriveFilesForShare(
        user,
        canvasData.files,
        shareId,
      );

      // Update canvasData.files with new fileIds
      canvasData.files = canvasData.files.map((file: any) => ({
        ...file,
        storageKey: storageKeyMap.get(file.fileId) ?? file.storageKey,
        fileId: fileIdMap.get(file.fileId) ?? file.fileId,
        canvasId: shareId, // Use shareId as the logical canvasId for shared files
      }));

      // Update file references in nodes (e.g., contextItems in skillResponse nodes)
      if (canvasData.nodes) {
        this.updateFileReferencesInNodes(canvasData.nodes, fileIdMap);
      }

      this.logger.log(
        `Duplicated ${canvasData.files.length} files for share ${shareId}. FileId mappings: ${JSON.stringify(Array.from(fileIdMap.entries()))}`,
      );
    } else {
      // No files in current canvas, clear files array
      canvasData.files = [];
    }
  }

  /**
   * Duplicate drive files for share to make it independent from original canvas
   * This ensures that deleting original files won't affect the shared content
   */
  async duplicateDriveFilesForShare(
    user: User,
    files: SharedCanvasData['files'],
    shareId: string,
  ): Promise<{
    storageKeyMap: Map<string, string>;
    fileIdMap: Map<string, string>;
  }> {
    if (!files || files.length === 0) {
      return {
        storageKeyMap: new Map(),
        fileIdMap: new Map(),
      };
    }

    const storageKeyMap = new Map<string, string>();
    const fileIdMap = new Map<string, string>();
    const limit = pLimit(10);

    const promises = files.map((file) =>
      limit(async () => {
        try {
          const { storageKey: newStorageKey, fileId: newFileId } =
            (await this.driveService.duplicateDriveFile(user, file, shareId)) as any;

          fileIdMap.set(file.fileId, newFileId);
          storageKeyMap.set(file.fileId, newStorageKey);

          this.logger.log(
            `Successfully duplicated drive file ${file.fileId} to ${newFileId} for share ${shareId}`,
          );
        } catch (error) {
          this.logger.error(`Failed to duplicate drive file ${file.fileId}: ${error.stack}`);
        }
      }),
    );

    await Promise.all(promises);
    return { fileIdMap, storageKeyMap };
  }

  /**
   * Clean up old shared files when updating a share
   * This removes database records (soft delete)
   */
  private async cleanupOldSharedFiles(user: User, shareId: string): Promise<void> {
    try {
      // Find all files belonging to this share
      const oldFiles = await this.prisma.driveFile.findMany({
        where: {
          uid: user.uid,
          canvasId: shareId,
          deletedAt: null,
        },
      });

      if (oldFiles.length === 0) {
        return;
      }

      this.logger.log(`Cleaning up ${oldFiles.length} old files for share ${shareId}`);

      // Soft delete database records
      const limit = pLimit(10);
      const promises = oldFiles.map((file) =>
        limit(async () => {
          try {
            await this.prisma.driveFile.update({
              where: { pk: file.pk },
              data: { deletedAt: new Date() },
            });

            this.logger.log(`Soft deleted drive file record: ${file.fileId}`);
          } catch (error) {
            this.logger.error(`Failed to delete file ${file.fileId}: ${error.stack}`);
          }
        }),
      );

      await Promise.all(promises);
      this.logger.log(`Successfully cleaned up old files for share ${shareId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old shared files for ${shareId}: ${error.stack}`);
    }
  }

  /**
   * Update file references in canvas nodes
   * Replaces old fileIds with new fileIds in node metadata (e.g., contextItems)
   */
  private updateFileReferencesInNodes(nodes: any[], fileIdMap: Map<string, string>): void {
    if (!nodes || nodes.length === 0 || fileIdMap.size === 0) {
      return;
    }

    for (const node of nodes) {
      // Check skillResponse nodes for contextItems
      if (node.type === 'skillResponse' && node.data?.metadata?.contextItems) {
        const contextItems = node.data.metadata.contextItems;
        for (const item of contextItems) {
          if (item.type === 'file' && item.entityId) {
            const newFileId = fileIdMap.get(item.entityId);
            if (newFileId) {
              item.entityId = newFileId;
              this.logger.debug(
                `Updated file reference in node ${node.id}: ${item.entityId} -> ${newFileId}`,
              );
            }
          }
        }
      }

      // Check for query string that might contain file references
      if (node.data?.metadata?.query && typeof node.data.metadata.query === 'string') {
        let query = node.data.metadata.query;
        let updated = false;

        // Replace file references in query string (format: @{type=file,id=df-xxx,...})
        for (const [oldId, newId] of fileIdMap.entries()) {
          const oldPattern = new RegExp(`id=${oldId}`, 'g');
          if (oldPattern.test(query)) {
            query = query.replace(oldPattern, `id=${newId}`);
            updated = true;
          }
        }

        if (updated) {
          node.data.metadata.query = query;
          this.logger.debug(`Updated file references in query for node ${node.id}`);
        }
      }
    }
  }
}
