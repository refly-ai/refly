import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import {
  SyncCanvasStateRequest,
  User,
  CanvasState,
  GetCanvasStateData,
} from '@refly/openapi-schema';
import { initEmptyCanvasState, updateCanvasState } from '@refly/canvas-common';
import { CanvasNotFoundError, CanvasVersionNotFoundError } from '@refly/errors';
import { Canvas as CanvasModel } from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer, streamToString } from '../../utils';
import { genCanvasVersionId } from '@refly/utils';

@Injectable()
export class CanvasSyncService {
  private logger = new Logger(CanvasSyncService.name);

  constructor(
    private prisma: PrismaService,
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
    state.version ||= genCanvasVersionId();
    const stateStorageKey = `canvas-state/${canvasId}/${state.version}`;
    await this.oss.putObject(stateStorageKey, JSON.stringify(state));
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
   * Sync canvas state
   * @param user - The user
   * @param canvasId - The canvas id
   * @param param - The sync canvas state request
   */
  async syncState(user: User, param: SyncCanvasStateRequest) {
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

    // TODO: concurrency control, queue the updates
    const state = await this.getState(user, { canvasId, version });
    updateCanvasState(state, transactions);
    await this.saveState(canvasId, state);
  }
}
