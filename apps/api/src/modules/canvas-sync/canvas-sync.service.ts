import { Inject, Injectable, Logger } from '@nestjs/common';
import hash from 'object-hash';
import * as Y from 'yjs';
import {
  SyncCanvasStateRequest,
  User,
  CanvasState,
  GetCanvasStateData,
  GetCanvasTransactionsData,
  CreateCanvasVersionRequest,
  SetCanvasStateRequest,
  CreateCanvasVersionResult,
  CanvasData,
  CanvasNode,
  GenericToolset,
} from '@refly/openapi-schema';
import {
  getCanvasDataFromState,
  getLastTransaction,
  initEmptyCanvasState,
  updateCanvasState,
  mergeCanvasStates,
  CanvasConflictException,
  purgeContextItems,
  calculateCanvasStateDiff,
  shouldCreateNewVersion,
  CanvasNodeFilter,
  prepareAddNode,
  extractToolsetsWithNodes,
  haveToolsetsChanged,
} from '@refly/canvas-common';
import {
  CanvasNotFoundError,
  CanvasVersionNotFoundError,
  OperationTooFrequent,
  ParamsError,
} from '@refly/errors';
import { Canvas as CanvasModel } from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import { LockReleaseFn, RedisService } from '../common/redis.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer, streamToString } from '../../utils';
import { genCanvasVersionId, genTransactionId, safeParseJSON } from '@refly/utils';
import { IContextItem } from '@refly/common-types';

@Injectable()
export class CanvasSyncService {
  private logger = new Logger(CanvasSyncService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
  ) {}

  /**
   * Get canvas YDoc from state storage key
   * @param stateStorageKey - The state storage key
   * @returns The canvas YDoc
   * @deprecated Yjs doc is not used anymore, use getState instead. This is only for backward compatibility.
   */
  async getCanvasYDoc(stateStorageKey: string) {
    if (!stateStorageKey) {
      return null;
    }

    try {
      const readable = await this.oss.getObject(stateStorageKey);
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

  /**
   * Save canvas state (JSON) to object storage
   * @param canvasId - The canvas id
   * @param version - The canvas version
   * @param state - The canvas state
   */
  async saveState(canvasId: string, state: CanvasState) {
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for saveState');
    }

    state.version ||= genCanvasVersionId();
    const stateStorageKey = `canvas-state/${canvasId}/${state.version}`;
    await this.oss.putObject(stateStorageKey, JSON.stringify(state));

    // Extract toolsets from canvas nodes and update canvas usedToolsets if changed
    const { nodes } = getCanvasDataFromState(state);
    const toolsetsWithNodes = extractToolsetsWithNodes(nodes ?? []);
    const newToolsets = toolsetsWithNodes.map((t) => t.toolset);

    // Get current canvas to check existing usedToolsets
    const canvas = await this.prisma.canvas.findUnique({
      select: {
        usedToolsets: true,
      },
      where: {
        canvasId,
      },
    });

    if (canvas) {
      const currentToolsets: GenericToolset[] = safeParseJSON(canvas.usedToolsets) ?? [];
      const hasChanged = haveToolsetsChanged(currentToolsets, newToolsets);

      if (hasChanged) {
        await this.prisma.canvas.update({
          where: { canvasId },
          data: {
            usedToolsets: JSON.stringify(newToolsets),
          },
        });
        this.logger.log(`Updated usedToolsets for canvas ${canvasId}`);
      }
    }

    return stateStorageKey;
  }

  /**
   * Get canvas state from object storage
   * @param canvasId - The canvas id
   * @returns The canvas state
   */
  async getState(
    user: User,
    param: GetCanvasStateData['query'],
    canvasPo?: CanvasModel,
  ): Promise<CanvasState> {
    const { canvasId, version } = param;

    if (!canvasId) {
      throw new ParamsError('Canvas ID is required for getState');
    }

    const canvas =
      canvasPo ??
      (await this.prisma.canvas.findUnique({
        select: {
          version: true,
          stateStorageKey: true,
        },
        where: {
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      }));

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    if (!canvas.version) {
      if (!canvas.stateStorageKey) {
        return initEmptyCanvasState();
      }

      const doc = await this.getCanvasYDoc(canvas.stateStorageKey);
      if (!doc) {
        return initEmptyCanvasState();
      }

      const state = initEmptyCanvasState();
      state.nodes = doc?.getArray('nodes').toJSON() ?? [];
      state.edges = doc?.getArray('edges').toJSON() ?? [];

      const stateStorageKey = await this.saveState(canvasId, state);

      await this.prisma.$transaction([
        this.prisma.canvas.update({
          where: {
            canvasId,
          },
          data: {
            version: state.version,
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

      return state;
    }

    const canvasVersion = await this.prisma.canvasVersion.findFirst({
      select: {
        stateStorageKey: true,
      },
      where: {
        canvasId,
        version: version ?? canvas.version, // use the latest version if not specified
      },
    });

    if (!canvasVersion) {
      throw new CanvasVersionNotFoundError();
    }

    const stream = await this.oss.getObject(canvasVersion.stateStorageKey);
    if (!stream) {
      throw new Error('Canvas state not found');
    }
    const stateStr = await streamToString(stream);

    return JSON.parse(stateStr);
  }

  /**
   * Get actual canvas data to render from state
   * @param user - The user
   * @param param - The get canvas data request
   * @param canvasPo - The canvas PO
   * @returns The canvas data
   */
  async getCanvasData(
    user: User,
    param: GetCanvasStateData['query'],
    canvasPo?: CanvasModel,
  ): Promise<CanvasData> {
    const state = await this.getState(user, param, canvasPo);
    const { nodes, edges } = getCanvasDataFromState(state);
    return { nodes, edges };
  }

  /**
   * Get canvas transactions
   * @param user - The user
   * @param param - The get canvas transactions request
   * @returns The canvas transactions
   */
  async getTransactions(user: User, param: GetCanvasTransactionsData['query']) {
    const { canvasId, version, since } = param;
    const state = await this.getState(user, { canvasId, version });
    const transactions = (state.transactions || []).filter((tx) => tx.createdAt > since);
    return transactions;
  }

  /**
   * Acquire a lock for the canvas state, with optional exponential backoff retry.
   * @param canvasId - The canvas id
   * @param options - The options
   * @param options.maxRetries - Maximum number of retries (default: 3)
   * @param options.initialDelay - Initial delay in ms for backoff (default: 100)
   * @returns A function to release the lock
   * @throws OperationTooFrequent if lock cannot be acquired after retries
   */
  async lockState(canvasId: string, options?: { maxRetries?: number; initialDelay?: number }) {
    const { maxRetries = 3, initialDelay = 100 } = options ?? {};
    const lockKey = `canvas-sync:${canvasId}`;
    let retries = 0;
    let delay = initialDelay;
    while (true) {
      const releaseLock = await this.redis.acquireLock(lockKey);
      if (releaseLock) {
        return releaseLock;
      }
      if (retries >= maxRetries) {
        throw new OperationTooFrequent('Failed to get lock for canvas');
      }
      // Exponential backoff before next retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      retries += 1;
    }
  }

  /**
   * Sync canvas state
   * @param user - The user
   * @param canvasId - The canvas id
   * @param param - The sync canvas state request
   */
  async syncState(
    user: User,
    param: SyncCanvasStateRequest,
    options?: { releaseLock?: LockReleaseFn },
  ) {
    const { canvasId, transactions, version } = param;

    const versionToSync =
      version ??
      (
        await this.prisma.canvas.findUnique({
          select: {
            version: true,
          },
          where: {
            canvasId,
            uid: user.uid,
            deletedAt: null,
          },
        })
      )?.version;

    if (!versionToSync) {
      throw new CanvasVersionNotFoundError();
    }

    if (!transactions?.length) {
      this.logger.warn(`[applyStateUpdate] no transactions to apply for canvas ${canvasId}`);
      return;
    }

    const releaseLock: LockReleaseFn = options?.releaseLock ?? (await this.lockState(canvasId));

    this.logger.log(
      `[syncState] sync state for canvas ${canvasId}, version: ${versionToSync}, ` +
        `transactions: ${transactions.map((tx) => tx.txId).join(', ')}`,
    );
    try {
      const state = await this.getState(user, { canvasId, version: versionToSync });
      updateCanvasState(state, transactions);
      state.updatedAt = Date.now();
      await this.saveState(canvasId, state);
    } catch (err) {
      this.logger.error(
        `[syncState] error syncing canvas state for canvas ${canvasId}: ${err?.stack}`,
      );
      throw err;
    } finally {
      await releaseLock();
    }
  }

  /**
   * Sync canvas state from YDoc for backward compatibility
   * @param user - The user
   * @param canvasId - The canvas id
   * @param yDoc - The YDoc
   */
  async syncCanvasStateFromYDoc(user: User, canvasId: string, yDoc: Y.Doc) {
    try {
      const nodes = yDoc.getArray('nodes').toJSON() ?? [];
      const edges = yDoc.getArray('edges').toJSON() ?? [];

      // Purge context items from nodes with safe handling of undefined contextItems
      const purgedNodes: CanvasNode[] = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...node.data?.metadata,
            contextItems: purgeContextItems(
              Array.isArray(node.data?.metadata?.contextItems)
                ? (node.data?.metadata?.contextItems as IContextItem[])
                : [],
            ),
          },
        },
      }));

      // Lock the canvas state to avoid race conditions
      const releaseLock = await this.lockState(canvasId);
      const currentState = await this.getState(user, { canvasId });
      const currentStateData = getCanvasDataFromState(currentState);

      const diff = calculateCanvasStateDiff(currentStateData, {
        nodes: purgedNodes,
        edges,
      });

      await this.syncState(user, { canvasId, transactions: [diff] }, { releaseLock });
    } catch (error) {
      this.logger.error(
        `Error syncing canvas state from YDoc for canvasId ${canvasId}: ${error?.message}`,
        error?.stack,
      );
      throw error;
    }
  }

  /**
   * Forcefully set canvas state, should only be used in conflict resolution.
   * For normal cases, use syncState instead.
   * @param user - The user
   * @param param - The set canvas state request
   * @returns The new canvas state
   */
  async setState(user: User, param: SetCanvasStateRequest) {
    const { canvasId, state } = param;
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    const releaseLock = await this.lockState(canvasId);
    try {
      await this.saveState(canvasId, state);

      if (canvas.version !== state.version) {
        await this.prisma.canvas.update({
          where: { canvasId },
          data: { version: state.version },
        });
      }
    } finally {
      await releaseLock();
    }
  }

  /**
   * Add a node to the canvas
   * @param user - The user who is adding the node
   * @param canvasId - The id of the canvas to add the node to
   * @param node - The node to add
   * @param connectTo - The nodes to connect to
   * @param options - Additional options including autoLayout
   */
  async addNodeToCanvas(
    user: User,
    canvasId: string,
    node: Pick<CanvasNode, 'type' | 'data'> & Partial<Pick<CanvasNode, 'id'>>,
    connectTo?: CanvasNodeFilter[],
    options?: { autoLayout?: boolean },
  ) {
    const releaseLock = await this.lockState(canvasId);
    const { nodes, edges } = await this.getCanvasData(user, { canvasId });

    this.logger.log(
      `[addNodeToCanvas] add node to canvas ${canvasId}, node: ${JSON.stringify(node)}, ` +
        `connectTo: ${JSON.stringify(connectTo)}, options: ${JSON.stringify(options)}, ` +
        `existing nodes: ${nodes.length}, existing edges: ${edges.length}`,
    );
    const { newNode, newEdges } = prepareAddNode({
      node,
      nodes,
      edges,
      connectTo,
      autoLayout: options?.autoLayout, // Pass autoLayout parameter
    });

    this.logger.log(
      `[addNodeToCanvas] new node: ${JSON.stringify(newNode)}, new edges: ${JSON.stringify(newEdges)}`,
    );

    await this.syncState(
      user,
      {
        canvasId,
        transactions: [
          {
            txId: genTransactionId(),
            createdAt: Date.now(),
            syncedAt: Date.now(),
            source: { type: 'system' },
            nodeDiffs: [
              {
                type: 'add',
                id: newNode.id,
                to: newNode,
              },
            ],
            edgeDiffs: newEdges.map((edge) => ({
              type: 'add',
              id: edge.id,
              to: edge,
            })),
          },
        ],
      },
      { releaseLock },
    );
  }

  async createCanvasVersion(
    user: User,
    param: CreateCanvasVersionRequest,
  ): Promise<CreateCanvasVersionResult> {
    const { canvasId, state } = param;
    const canvas = await this.prisma.canvas.findFirst({ where: { canvasId, uid: user.uid } });
    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    // If no need to create new version, return the current state
    if (!shouldCreateNewVersion(state)) {
      this.logger.log(
        `[createCanvasVersion] no need to create version for canvas ${canvasId}, current version: ${canvas.version}`,
      );
      return {
        canvasId,
        newState: state,
      };
    }

    this.logger.log(
      `[createCanvasVersion] create version for canvas ${canvasId}, current version: ${canvas.version}`,
    );
    const releaseLock = await this.lockState(canvasId);

    try {
      const serverState = await this.getState(user, { canvasId, version: canvas.version });
      if (canvas.version !== state.version) {
        return {
          canvasId,
          conflict: {
            localState: state,
            remoteState: serverState,
          },
        };
      }

      // Merge local and server state to avoid possible data loss
      let finalState: CanvasState;
      try {
        finalState = mergeCanvasStates(state, serverState);
      } catch (error) {
        if (error instanceof CanvasConflictException) {
          return {
            canvasId,
            conflict: {
              localState: state,
              remoteState: serverState,
            },
          };
        }
        // Re-throw other errors to be handled by the caller
        throw error;
      }

      // Mark all unsynced transactions as synced
      // If there are unsynced transactions, save the updated state
      let hasUnsyncedTransactions = false;
      for (const tx of finalState.transactions) {
        if (!tx.syncedAt) {
          hasUnsyncedTransactions = true;
          tx.syncedAt = Date.now();
        }
      }
      if (hasUnsyncedTransactions) {
        await this.saveState(canvasId, finalState);
      }

      const lastTransaction = getLastTransaction(finalState);

      const canvasData = getCanvasDataFromState(state);
      const newState: CanvasState = {
        ...canvasData,
        version: genCanvasVersionId(),
        transactions: [],
        history: [
          ...(finalState.history ?? []),
          {
            version: canvas.version,
            timestamp: lastTransaction?.createdAt ?? Date.now(),
            hash: hash(state),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.logger.log(
        `[createCanvasVersion] create version for canvas ${canvasId}, new version: ${newState.version}`,
      );

      const stateStorageKey = await this.saveState(canvasId, newState);

      await this.prisma.$transaction([
        this.prisma.canvasVersion.create({
          data: { canvasId, stateStorageKey, version: newState.version, hash: '' },
        }),
        this.prisma.canvas.update({
          where: { canvasId },
          data: { version: newState.version },
        }),
      ]);

      return {
        canvasId,
        newState,
      };
    } finally {
      await releaseLock();
    }
  }
}
