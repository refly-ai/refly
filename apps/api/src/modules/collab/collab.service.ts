import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';
import { Request } from 'express';
import { WebSocket } from 'ws';
import { Server, Hocuspocus } from '@hocuspocus/server';
import { RAGService } from '../rag/rag.service';
import { CodeArtifact, Prisma } from '../../generated/client';
import { UpsertCodeArtifactRequest, User } from '@refly/openapi-schema';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';
import { PrismaService } from '../common/prisma.service';
import {
  genCodeArtifactID,
  IDPrefix,
  incrementalMarkdownUpdate,
  state2Markdown,
} from '@refly/utils';
import { streamToBuffer } from '../../utils/stream';
import { CollabContext, isCanvasContext, isDocumentContext } from './collab.dto';
import { QUEUE_SYNC_CANVAS_ENTITY } from '../../utils/const';
import ms from 'ms';
import pLimit from 'p-limit';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { isDesktop } from '../../utils/runtime';

@Injectable()
export class CollabService {
  private logger = new Logger(CollabService.name);
  private server: Hocuspocus;

  constructor(
    private rag: RAGService,
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private fts: FulltextSearchService,
    @Optional() @InjectQueue(QUEUE_SYNC_CANVAS_ENTITY) private canvasQueue?: Queue,
  ) {
    const extensions = [];
    // if (!isDesktop()) {
    //   extensions.push(new Redis({ redis: this.redis.getClient() }));
    // }

    this.server = Server.configure({
      port: this.config.get<number>('wsPort'),
      onAuthenticate: (payload) => this.authenticate(payload),
      onLoadDocument: (payload) => this.loadDocument(payload),
      onStoreDocument: (payload) => this.storeDocument(payload),
      afterUnloadDocument: async (payload) => {
        this.logger.log(`afterUnloadDocument ${payload.documentName}`);
      },
      onDisconnect: async (payload) => {
        this.logger.log(`onDisconnect ${payload.documentName}`);
      },
      extensions,
    });
  }

  handleConnection(connection: WebSocket, request: Request) {
    this.server.handleConnection(connection, request);
  }

  async signCollabToken(user: User) {
    const token = randomUUID();
    const tokenExpiry = ms(String(this.config.get('auth.collab.tokenExpiry')));
    const expiresAt = Date.now() + tokenExpiry;
    await this.redis.setex(`collab:token:${token}`, tokenExpiry / 1000, user.uid);

    return { token, expiresAt };
  }

  private async validateCollabToken(token: string): Promise<string | null> {
    return this.redis.get(`collab:token:${token}`);
  }

  async authenticate({ token, documentName }: { token: string; documentName: string }) {
    // First validate the UID
    let uid: string | null = null;
    if (isDesktop()) {
      uid = this.config.get('local.uid');
    } else {
      // Validate the token from Redis
      uid = await this.validateCollabToken(token);
    }

    if (!uid) {
      throw new Error('Invalid or expired collab token');
    }

    const user = await this.prisma.user.findFirst({
      where: { uid },
    });
    if (!user) {
      throw new Error('user not found');
    }

    let context: CollabContext;
    if (documentName.startsWith(IDPrefix.DOCUMENT)) {
      const doc = await this.prisma.document.findFirst({
        where: { docId: documentName, deletedAt: null },
      });
      if (!doc) {
        throw new Error(`document not found: ${documentName}`);
      }
      context = { user, entity: doc, entityType: 'document' };
    } else if (documentName.startsWith(IDPrefix.CANVAS)) {
      const canvas = await this.prisma.canvas.findFirst({
        where: { canvasId: documentName, deletedAt: null },
      });
      if (!canvas) {
        throw new Error(`canvas not found: ${documentName}`);
      }
      context = { user, entity: canvas, entityType: 'canvas' };
    } else {
      throw new Error(`unknown document name: ${documentName}`);
    }

    if (context.entity.uid !== user.uid) {
      throw new Error(`user not authorized: ${documentName}`);
    }

    this.logger.log(`document connected: ${documentName}`);

    // Set contextual data to use it in other hooks
    return context;
  }

  async loadDocument({
    document,
    documentName,
    context,
  }: {
    document: Y.Doc;
    documentName: string;
    context: CollabContext;
  }) {
    const { entity } = context;

    if (!entity) {
      this.logger.warn(`entity not found for ${documentName}`);
      return null;
    }

    const { stateStorageKey } = entity;

    if (!stateStorageKey) {
      this.logger.warn(`stateStorageKey not found for ${documentName}`);
      return null;
    }

    try {
      const readable = await this.oss.getObject(stateStorageKey);
      const state = await streamToBuffer(readable);
      Y.applyUpdate(document, state);

      const title = document.getText('title')?.toJSON();
      if (!title) {
        document.getText('title').insert(0, entity.title);
      }
    } catch (err) {
      this.logger.error(`fetch state failed for ${stateStorageKey}, err: ${err.stack}`);
      return null;
    }
  }

  private async storeDocumentEntity({
    state,
    document,
    context,
  }: {
    state: Buffer;
    document: Y.Doc;
    context: Extract<CollabContext, { entityType: 'document' }>;
  }) {
    const { user, entity: doc } = context;

    if (!doc) {
      this.logger.warn(`document is empty for context: ${JSON.stringify(context)}`);
      return;
    }

    const title = document.getText('title').toJSON();

    const content = state2Markdown(state);
    const storageKey = doc.storageKey || `doc/${doc.docId}.txt`;
    const stateStorageKey = doc.stateStorageKey || `state/${doc.docId}`;

    // Save content and ydoc state to object storage
    await Promise.all([
      this.oss.putObject(storageKey, content),
      this.oss.putObject(stateStorageKey, state),
    ]);

    // Prepare document updates
    const docUpdates: Prisma.DocumentUpdateInput = {};
    if (!doc.storageKey) {
      docUpdates.storageKey = storageKey;
    }
    if (!doc.stateStorageKey) {
      docUpdates.stateStorageKey = stateStorageKey;
    }
    if (doc.contentPreview !== content.slice(0, 500)) {
      docUpdates.contentPreview = content.slice(0, 500);
    }
    if (doc.title !== title) {
      docUpdates.title = title;
    }

    // Re-calculate storage size
    const [storageStat, stateStorageStat] = await Promise.all([
      this.oss.statObject(storageKey),
      this.oss.statObject(stateStorageKey),
    ]);
    docUpdates.storageSize = storageStat.size + stateStorageStat.size;

    // Re-index content to elasticsearch and vector store
    const [, { size }] = await Promise.all([
      this.fts.upsertDocument(user, 'document', {
        id: doc.docId,
        content,
        title,
        uid: doc.uid,
        updatedAt: new Date().toJSON(),
      }),
      this.rag.indexDocument(user, {
        pageContent: content,
        metadata: {
          nodeType: 'document',
          title: doc.title,
          docId: doc.docId,
        },
      }),
    ]);
    docUpdates.vectorSize = size;

    const updatedDoc = await this.prisma.document.update({
      where: { docId: doc.docId },
      data: docUpdates,
    });
    context.entity = updatedDoc;
  }

  private async storeCanvasEntity({
    document,
    context,
  }: {
    state: Buffer;
    document: Y.Doc;
    context: Extract<CollabContext, { entityType: 'canvas' }>;
  }) {
    const { user, entity: canvas } = context;

    if (!canvas) {
      this.logger.warn(`canvas is empty for context: ${JSON.stringify(context)}`);
      return;
    }

    const cleanedDocument = await this.cleanCanvasDocument(user, canvas.canvasId, document);
    const cleanedState = Buffer.from(Y.encodeStateAsUpdate(cleanedDocument));
    const title = cleanedDocument.getText('title').toJSON();

    const stateStorageKey = canvas.stateStorageKey || `state/${canvas.canvasId}`;
    await this.oss.putObject(stateStorageKey, cleanedState);

    const stateStorageStat = await this.oss.statObject(stateStorageKey);

    const canvasUpdates: Prisma.CanvasUpdateInput = {
      storageSize: stateStorageStat.size,
    };
    if (!canvas.stateStorageKey) {
      canvasUpdates.stateStorageKey = stateStorageKey;
    }
    if (canvas.title !== title) {
      canvasUpdates.title = title;
    }
    this.logger.log(`canvas ${canvas.canvasId} updates: ${JSON.stringify(canvasUpdates)}`);

    const updatedCanvas = await this.prisma.canvas.update({
      where: { canvasId: canvas.canvasId, uid: user.uid },
      data: canvasUpdates,
    });
    context.entity = updatedCanvas;

    await this.fts.upsertDocument(user, 'canvas', {
      id: canvas.canvasId,
      title,
      uid: canvas.uid,
      updatedAt: new Date().toJSON(),
    });

    // Add sync canvas entity job with debouncing
    await this.canvasQueue?.add(
      'syncCanvasEntity',
      { canvasId: canvas.canvasId },
      {
        jobId: canvas.canvasId, // Use consistent jobId for deduplication
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async storeDocument({ document, context }: { document: Y.Doc; context: CollabContext }) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document));

    if (isDocumentContext(context)) {
      return this.storeDocumentEntity({ state, document, context });
    }
    if (isCanvasContext(context)) {
      return this.storeCanvasEntity({ state, document, context });
    }
    this.logger.warn(`unknown context entity type: ${JSON.stringify(context)}`);
    return null;
  }

  /**
   * Clean canvas document by removing legacy code artifact nodes and processing them
   * @param user - The user performing the cleanup
   * @param canvasId - The canvas id
   * @param document - The canvas document to clean
   * @returns The cleaned document
   */
  async cleanCanvasDocument(user: User, canvasId: string, document: Y.Doc) {
    const nodes = document.getArray('nodes').toJSON() ?? [];
    const legacyArtifactNodes = nodes.filter(
      (node) =>
        node.type === 'codeArtifact' &&
        node.data?.entityId &&
        (node.data?.contentPreview || node.data?.metadata?.code),
    );

    if (!legacyArtifactNodes.length) {
      return document;
    }

    // Acquire lock to prevent concurrent processing
    const releaseLock = await this.redis.acquireLock(`code-artifact-process:${canvasId}`);

    if (!releaseLock) {
      this.logger.warn(`failed to acquire lock to clean canvas: ${canvasId}`);
      return document;
    }

    try {
      const limit = pLimit(5);
      const processedArtifacts = await Promise.all(
        legacyArtifactNodes.map((node) =>
          limit(() =>
            this.processLegacyCodeArtifact(user, node.data?.entityId, {
              title: node.data?.metadata?.title,
              type: node.data?.metadata?.type,
              language: node.data?.metadata?.language,
              content: node.data?.contentPreview || node.data?.metadata?.code,
            }),
          ),
        ),
      );
      const processedArtifactMap = new Map<string, CodeArtifact>();
      for (const artifact of processedArtifacts) {
        const { originArtifactId, newArtifact } = artifact;
        if (newArtifact) {
          processedArtifactMap.set(originArtifactId, newArtifact);
        }
      }

      const cleanNodes = nodes.map((node: any) => {
        if (node.type === 'codeArtifact' && processedArtifactMap.has(node.data?.entityId)) {
          const newArtifact = processedArtifactMap.get(node.data?.entityId);
          const status = node.data?.metadata?.status;
          return {
            ...node,
            data: {
              ...node.data,
              entityId: newArtifact.artifactId,
              contentPreview: undefined,
              metadata: {
                ...node.data.metadata,
                code: undefined,
                status: status === 'finished' ? 'finish' : status, // convert 'finished' to 'finish'
              },
            },
          };
        }
        return node;
      });

      document.transact(() => {
        document.getArray('nodes').delete(0, document.getArray('nodes').length);
        document.getArray('nodes').insert(0, cleanNodes);
      });

      return document;
    } finally {
      await releaseLock();
    }
  }

  async processLegacyCodeArtifact(
    user: User,
    artifactId: string,
    param: UpsertCodeArtifactRequest,
  ) {
    try {
      const newArtifactId = genCodeArtifactID();
      const storageKey = `code-artifact/${newArtifactId}`;
      const newArtifact = await this.prisma.codeArtifact.upsert({
        where: { artifactId },
        create: {
          artifactId: newArtifactId,
          uid: user.uid,
          storageKey,
          type: param.type,
          language: param.language,
          title: param.title,
        },
        update: {},
      });
      if (param.content) {
        await this.oss.putObject(storageKey, param.content);
      }
      return { originArtifactId: artifactId, newArtifact };
    } catch (err) {
      this.logger.error(`failed to process legacy code artifact: ${artifactId}, err: ${err.stack}`);
      return { originArtifactId: artifactId, newArtifact: null };
    }
  }

  async openDirectConnection(documentName: string, context?: CollabContext) {
    return this.server.openDirectConnection(documentName, context);
  }

  async modifyDocument(documentName: string, update: string) {
    const { document } = await this.server.openDirectConnection(documentName);
    incrementalMarkdownUpdate(document, update);
  }
}
