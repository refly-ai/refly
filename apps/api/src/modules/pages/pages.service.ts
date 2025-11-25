import { Injectable, Logger, Inject } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer } from '../../utils';
import { User } from '@refly/openapi-schema';
import { CanvasNotFoundError, PageNotFoundError } from '@refly/errors';
import { ShareCreationService } from '../share/share-creation.service';
import { UpdatePageDto, ResolveUserResponse, CanvasData, NodeInfo } from './pages.dto';
import { createId } from '@paralleldrive/cuid2';
import {
  Page as PageModel,
  PageNodeRelation as PageNodeRelationModel,
  Prisma,
} from '@prisma/client';

// Generate unique IDs
const genPageId = (): string => `page-${createId()}`;
const genPageNodeRelationId = (): string => `pnr-${createId()}`;

@Injectable()
export class PagesService {
  private logger = new Logger(PagesService.name);

  constructor(
    private prisma: PrismaService,
    private canvasService: CanvasService,
    private shareCreationService: ShareCreationService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
  ) {}

  // List all pages for a user
  async listPages(
    user: User,
    page = 1,
    pageSize = 20,
  ): Promise<{
    pages: PageModel[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pages = await this.prisma.page.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.page.count({
      where: {
        uid: user.uid,
        deletedAt: null,
      },
    });

    return {
      pages,
      total,
      page,
      pageSize,
    };
  }

  // Get page details - used for editing
  async getPageDetail(user: User | ResolveUserResponse, pageId: string) {
    const { uid } = user as User;

    const page = await this.prisma.page.findFirst({
      where: {
        pageId,
        uid,
        deletedAt: null,
      },
    });

    if (!page) {
      throw new PageNotFoundError();
    }

    const nodeRelations = await this.prisma.pageNodeRelation.findMany({
      where: {
        pageId,
        deletedAt: null,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    return {
      page,
      nodeRelations,
    };
  }

  // Update page - save edit state
  async updatePage(user: User | ResolveUserResponse, pageId: string, param: UpdatePageDto) {
    const { uid } = user as User;
    const { title, nodeRelations, nodeRelationOrders, pageConfig } = param;

    // Check if page exists
    const page = await this.prisma.page.findFirst({
      where: {
        pageId,
        uid,
        deletedAt: null,
      },
    });

    if (!page) {
      throw new PageNotFoundError();
    }

    // Use transaction for all database operations
    return await this.prisma.$transaction(async (tx) => {
      // Start update operations
      let updatePage = page;

      // If title is updated
      if (title !== undefined) {
        const updated = await tx.page.update({
          where: {
            pageId,
          },
          data: {
            title,
            updatedAt: new Date(),
          },
        });
        updatePage = updated;
      }

      // If only updating node order
      let updatedRelations = undefined;
      if (nodeRelationOrders && nodeRelationOrders.length > 0) {
        this.logger.log('Updating node relation orders', nodeRelationOrders);

        // Get current page node relations
        const existingRelations = await tx.pageNodeRelation.findMany({
          where: {
            pageId,
            deletedAt: null,
          },
        });

        // Group existing relations by relationId for easy lookup
        const relationsByRelationId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelationModel>, relation) => {
            acc[relation.relationId] = relation;
            return acc;
          },
          {},
        );

        // Only update node order
        const updatedRelationsPromises = nodeRelationOrders.map(async (relation) => {
          const { relationId, orderIndex } = relation;

          // Check if this relation ID exists
          if (relationsByRelationId[relationId]) {
            // Only update order
            const updated = await tx.pageNodeRelation.update({
              where: {
                relationId,
              },
              data: {
                orderIndex,
                updatedAt: new Date(),
              },
            });
            return updated;
          }
          // If relation ID not found, return null
          return null;
        });

        // Filter out null values
        const results = await Promise.all(updatedRelationsPromises);
        updatedRelations = results.filter(Boolean);
      }
      // If complete node relation update
      else if (nodeRelations && nodeRelations.length > 0) {
        // Get current page node relations
        const existingRelations = await tx.pageNodeRelation.findMany({
          where: {
            pageId,
            deletedAt: null,
          },
        });

        // Group existing relations by nodeId for easy lookup
        const relationsByNodeId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelationModel>, relation) => {
            acc[relation.nodeId] = relation;
            return acc;
          },
          {},
        );

        // Update existing relations or create new ones
        const updatedRelationsPromises = nodeRelations.map(async (relation, index) => {
          const { nodeId, nodeType, entityId, nodeData, orderIndex = index } = relation;

          // Check if this node relation already exists
          if (relationsByNodeId[nodeId]) {
            // Update existing relation
            const updated = await tx.pageNodeRelation.update({
              where: {
                relationId: relationsByNodeId[nodeId].relationId,
              },
              data: {
                nodeType,
                entityId,
                orderIndex,
                nodeData: typeof nodeData === 'string' ? nodeData : JSON.stringify(nodeData || {}),
                updatedAt: new Date(),
              },
            });
            return updated;
          }
          // Create new relation
          const relationId = genPageNodeRelationId();
          const nodeDataStr =
            typeof nodeData === 'string' ? nodeData : JSON.stringify(nodeData || {});

          const created = await tx.pageNodeRelation.create({
            data: {
              relationId,
              pageId,
              nodeId,
              nodeType,
              entityId,
              orderIndex,
              nodeData: nodeDataStr,
            },
          });
          return created;
        });

        updatedRelations = await Promise.all(updatedRelationsPromises);
      }

      // Handle non-database operations after transaction (like updating page state file)
      if (pageConfig) {
        try {
          // Read existing state file
          let ydoc = new Y.Doc();

          if (page.stateStorageKey) {
            try {
              const stateStream = await this.oss.getObject(page.stateStorageKey);
              const stateBuffer = await streamToBuffer(stateStream);

              if (stateBuffer) {
                const update = new Uint8Array(stateBuffer);
                Y.applyUpdate(ydoc, update);
              }
            } catch (error) {
              // If file doesn't exist, use new Y.Doc()
              this.logger.error('Error reading state file, creating new:', error);
              ydoc = new Y.Doc();
            }
          }

          // Update pageConfig
          const pageConfigMap = ydoc.getMap('pageConfig');
          for (const [key, value] of Object.entries(pageConfig)) {
            pageConfigMap.set(key, value);
          }

          // Save updated state
          const update = Y.encodeStateAsUpdate(ydoc);
          await this.oss.putObject(page.stateStorageKey, Buffer.from(update));
        } catch (error) {
          this.logger.error('Error saving page state:', error);
        }
      }

      return {
        page: updatePage,
        nodeRelations: updatedRelations,
      };
    });
  }

  // Share page - create public share link
  async sharePage(user: User | ResolveUserResponse, pageId: string) {
    const { uid } = user as User;

    // Check if page exists
    const page = await this.prisma.page.findFirst({
      where: {
        pageId,
        uid,
        deletedAt: null,
      },
    });

    if (!page) {
      throw new PageNotFoundError();
    }

    // Use ShareService to create share
    const shareRecord = await this.shareCreationService.createShare(user as User, {
      entityId: pageId,
      entityType: 'page',
      title: page.title,
      allowDuplication: false, // Default: do not allow duplication
    });

    return {
      pageId,
      canvasId: page.canvasId,
      shareId: shareRecord.shareId,
    };
  }

  // Delete page node
  async deletePageNode(user: User | ResolveUserResponse, pageId: string, nodeId: string) {
    const { uid } = user as User;

    // Check if page exists
    const page = await this.prisma.page.findFirst({
      where: {
        pageId,
        uid,
        deletedAt: null,
      },
    });

    if (!page) {
      throw new PageNotFoundError();
    }

    // Check if node relation exists
    const nodeRelation = await this.prisma.pageNodeRelation.findFirst({
      where: {
        pageId,
        nodeId,
        deletedAt: null,
      },
    });

    if (!nodeRelation) {
      throw new PageNotFoundError();
    }

    // Soft delete node relation
    await this.prisma.pageNodeRelation.update({
      where: {
        relationId: nodeRelation.relationId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      pageId,
      canvasId: page.canvasId,
      nodeId,
    };
  }

  /**
   * Get page associated with a canvas
   * @param user Current user
   * @param canvasId Canvas ID
   * @returns Page and node relations
   */
  async getPageByCanvasId(user: User, canvasId: string) {
    // Check if canvas exists and user has access
    const canvas = await this.prisma.canvas.findFirst({
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!canvas) {
      throw new CanvasNotFoundError('Canvas not found or access denied');
    }

    // Find page associated with canvas using canvas_id field
    // Ensure we only get one page (the most recent one)
    const page = await this.prisma.page.findFirst({
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!page) {
      return { page: null, nodeRelations: [] };
    }

    // Get page node relations
    const nodeRelations = await this.prisma.pageNodeRelation.findMany({
      where: {
        pageId: page.pageId,
        deletedAt: null,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    return { page, nodeRelations };
  }

  /**
   * Check if the user has permission to access the specified canvas
   * @param tx Prisma transaction object
   * @param canvasId Canvas ID
   * @param uid User ID
   * @returns Found canvas or null
   */
  private async getCanvasWithAccess(tx: Prisma.TransactionClient, canvasId: string, uid: string) {
    return tx.canvas.findFirst({
      where: {
        canvasId,
        uid,
        deletedAt: null,
      },
    });
  }

  /**
   * Find the page associated with a canvas
   * @param tx Prisma transaction object
   * @param canvasId Canvas ID
   * @param uid User ID
   * @returns Found page or undefined
   */
  private async findCanvasPage(tx: Prisma.TransactionClient, canvasId: string, uid: string) {
    return tx.page.findFirst({
      where: {
        canvasId,
        uid,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Create a new canvas page
   * @param tx Prisma transaction object
   * @param uid User ID
   * @param canvasTitle Canvas title
   * @param canvasId Canvas ID
   * @returns Newly created page
   */
  private async createNewCanvasPage(
    tx: Prisma.TransactionClient,
    uid: string,
    canvasTitle: string,
    canvasId: string,
  ) {
    // Generate pageId
    const pageId = genPageId();
    const stateStorageKey = `pages/${uid}/${pageId}/state.update`;
    const title = canvasTitle || 'Untitled Page';

    // Create new Page record
    const createdPage = await tx.page.create({
      data: {
        pageId,
        uid,
        title,
        stateStorageKey,
        status: 'draft',
        canvasId,
      },
    });

    // Create initial Y.doc to store page state
    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText('title').insert(0, title);
      doc.getMap('pageConfig').set('layout', 'slides');
      doc.getMap('pageConfig').set('theme', 'default');
    });

    // Upload Y.doc - Convert Y.Doc to Uint8Array, then to Buffer
    const state = Y.encodeStateAsUpdate(doc);
    await this.oss.putObject(stateStorageKey, Buffer.from(state));

    return createdPage;
  }

  /**
   * Get existing node relations for a page
   * @param tx Prisma transaction object
   * @param pageId Page ID
   * @returns Set of node IDs
   */
  private async getExistingNodeRelations(tx: Prisma.TransactionClient, pageId: string) {
    const existingNodeRelations = await tx.pageNodeRelation.findMany({
      where: {
        pageId,
        deletedAt: null,
      },
      select: {
        nodeId: true,
      },
    });

    return new Set(existingNodeRelations.map((relation) => relation.nodeId));
  }

  /**
   * Get the current maximum order index for a page
   * @param tx Prisma transaction object
   * @param pageId Page ID
   * @returns Maximum order index
   */
  private async getMaxOrderIndex(tx: Prisma.TransactionClient, pageId: string) {
    const result = await tx.pageNodeRelation.aggregate({
      where: {
        pageId,
        deletedAt: null,
      },
      _max: {
        orderIndex: true,
      },
    });

    return result._max.orderIndex ?? -1;
  }

  /**
   * Create a new node relation
   * @param tx Prisma transaction object
   * @param pageId Page ID
   * @param node Node information
   * @param orderIndex Order index
   * @returns Created node relation
   */
  private async createNodeRelation(
    tx: Prisma.TransactionClient,
    pageId: string,
    node: NodeInfo,
    orderIndex: number,
  ) {
    const relationId = genPageNodeRelationId();
    const nodeData =
      typeof node.nodeData === 'string' ? node.nodeData : JSON.stringify(node.nodeData || {});

    return tx.pageNodeRelation.create({
      data: {
        relationId,
        pageId,
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        orderIndex,
        nodeData,
      },
    });
  }

  /**
   * Update an existing node relation
   * @param tx Prisma transaction object
   * @param pageId Page ID
   * @param node Node information
   * @returns Updated node relation
   */
  private async updateNodeRelation(tx: Prisma.TransactionClient, pageId: string, node: NodeInfo) {
    const nodeData =
      typeof node.nodeData === 'string' ? node.nodeData : JSON.stringify(node.nodeData || {});

    return tx.pageNodeRelation
      .updateMany({
        where: {
          pageId,
          nodeId: node.nodeId,
          deletedAt: null,
        },
        data: {
          nodeType: node.nodeType,
          entityId: node.entityId,
          nodeData: nodeData,
          updatedAt: new Date(),
        },
      })
      .then(() => {
        return tx.pageNodeRelation.findFirst({
          where: {
            pageId,
            nodeId: node.nodeId,
            deletedAt: null,
          },
        });
      });
  }

  /**
   * Get all node relations for a page
   * @param tx Prisma transaction object
   * @param pageId Page ID
   * @returns All node relations
   */
  private async getAllNodeRelations(tx: Prisma.TransactionClient, pageId: string) {
    return tx.pageNodeRelation.findMany({
      where: {
        pageId,
        deletedAt: null,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });
  }

  /**
   * Extract node information from canvas data
   * @param canvasData Canvas data
   * @param nodeIds Array of node IDs to extract
   * @returns Array of node information
   */
  private extractNodeInfoFromCanvas(canvasData: CanvasData, nodeIds: string[]): NodeInfo[] {
    if (!canvasData || !canvasData.nodes || canvasData.nodes.length === 0) {
      return [];
    }

    return nodeIds
      .map((nodeId) => {
        // Find matching node in Canvas nodes array
        // Note: Canvas node ID may be stored in data.entityId
        const node = canvasData.nodes.find((n) => n.data?.entityId === nodeId);

        if (!node) {
          this.logger.warn(`Node ${nodeId} not found in canvas, skipping it`);
          return null;
        }

        return {
          nodeId: nodeId,
          nodeType: node.type || 'unknown',
          entityId: node.data?.entityId || nodeId,
          nodeData: node.data || {},
          isNew: true,
        };
      })
      .filter((info): info is NodeInfo => info !== null);
  }

  /**
   * Add nodes to a canvas page
   * If page doesn't exist, create a new one
   * @param user Current user
   * @param canvasId Canvas ID
   * @param addNodesDto Nodes to add
   * @returns Updated page and node relations
   */
  async addNodesToCanvasPage(user: User, canvasId: string, addNodesDto: { nodeIds: string[] }) {
    // Use transaction for all database operations
    return this.prisma.$transaction(async (tx) => {
      // 1. Check if canvas exists and user has access
      const canvas = await this.getCanvasWithAccess(tx, canvasId, user.uid);
      if (!canvas) {
        throw new CanvasNotFoundError('Canvas not found or access denied');
      }

      // 2. Find page associated with canvas
      let page = await this.findCanvasPage(tx, canvasId, user.uid);

      // 3. If no page exists, create a new one
      if (!page) {
        page = await this.createNewCanvasPage(tx, user.uid, canvas.title, canvasId);
      }

      // 4. Get raw Canvas data, including node information
      const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

      // 5. Handle case when canvas has no nodes
      if (!canvasData || !canvasData.nodes || canvasData.nodes.length === 0) {
        this.logger.warn(`Canvas ${canvasId} has no nodes, returning empty node relations`);
        return {
          page,
          nodeRelations: [],
        };
      }

      // 6. Get existing node relations for the current page
      const existingNodeIds = await this.getExistingNodeRelations(tx, page.pageId);

      // 7. Filter out node IDs that already exist and those that need to be added
      const newNodeIds =
        addNodesDto.nodeIds?.filter((nodeId) => !existingNodeIds.has(nodeId)) ?? [];
      const existingNodeIdsToUpdate =
        addNodesDto.nodeIds?.filter((nodeId) => existingNodeIds.has(nodeId)) ?? [];

      // 8. If there are no new nodes to add and no existing nodes to update, directly return the current page and node relations
      if (newNodeIds.length === 0 && existingNodeIdsToUpdate.length === 0) {
        const currentNodeRelations = await this.getAllNodeRelations(tx, page.pageId);
        return {
          page,
          nodeRelations: currentNodeRelations,
        };
      }

      // 9. Extract node information from Canvas data
      const nodeInfos = this.extractNodeInfoFromCanvas(canvasData, newNodeIds);

      // 10. Extract information for existing nodes that need to be updated
      const existingNodeInfos = this.extractNodeInfoFromCanvas(
        canvasData,
        existingNodeIdsToUpdate,
      ).map((info) => ({ ...info, isNew: false }));

      // 11. Combine new and existing node infos
      const allNodeInfos = [...nodeInfos, ...existingNodeInfos];

      // 12. If all nodes are invalid, return current page and node relations
      if (allNodeInfos.length === 0) {
        this.logger.warn(`No valid nodes found for canvas ${canvasId}, returning current state`);
        const currentNodeRelations = await this.getAllNodeRelations(tx, page.pageId);
        return {
          page,
          nodeRelations: currentNodeRelations,
        };
      }

      // 13. Get the current maximum order_index (only needed for new nodes)
      const startOrderIndex = (await this.getMaxOrderIndex(tx, page.pageId)) + 1;

      // 14. Process all node relations (both new and existing) in parallel
      const nodeRelationsPromises = allNodeInfos.map((node, index) => {
        if (node.isNew) {
          // For new nodes, create new relations
          return this.createNodeRelation(tx, page.pageId, node, startOrderIndex + index);
        }

        // For existing nodes, update their data
        return this.updateNodeRelation(tx, page.pageId, node);
      });

      // Wait for all operations to complete
      await Promise.all(nodeRelationsPromises);

      // 15. Get all node relations (including both new and existing ones)
      const allNodeRelations = await this.getAllNodeRelations(tx, page.pageId);

      return {
        page,
        nodeRelations: allNodeRelations,
      };
    });
  }
}
