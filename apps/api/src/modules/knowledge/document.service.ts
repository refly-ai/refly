import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Document as DocumentPO, Prisma } from '../../generated/client';
import { RAGService } from '../rag/rag.service';
import { PrismaService } from '../common/prisma.service';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';
import {
  ListDocumentsData,
  GetDocumentDetailData,
  UpsertDocumentRequest,
  DeleteDocumentRequest,
  DuplicateDocumentRequest,
  User,
  CanvasNode,
} from '@refly/openapi-schema';
import {
  QUEUE_CLEAR_CANVAS_ENTITY,
  QUEUE_POST_DELETE_KNOWLEDGE_ENTITY,
  streamToString,
} from '../../utils';
import {
  genDocumentID,
  markdown2StateUpdate,
  safeParseJSON,
  pick,
  incrementalMarkdownUpdate,
} from '@refly/utils';
import { DocumentDetail, PostDeleteKnowledgeEntityJobData } from './knowledge.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { MiscService } from '../misc/misc.service';
import {
  StorageQuotaExceeded,
  DocumentNotFoundError,
  ParamsError,
  ActionResultNotFoundError,
  CanvasNotFoundError,
  ProjectNotFoundError,
} from '@refly/errors';
import { DeleteCanvasNodesJobData } from '../canvas/canvas.dto';
import { DocxParser } from '../knowledge/parsers/docx.parser';
import { PdfParser } from '../knowledge/parsers/pdf.parser';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { CollabService } from '../collab/collab.service';
import { CollabContext } from '../collab/collab.dto';

@Injectable()
export class DocumentService {
  private logger = new Logger(DocumentService.name);

  constructor(
    private prisma: PrismaService,
    private ragService: RAGService,
    private miscService: MiscService,
    private collabService: CollabService,
    private canvasSyncService: CanvasSyncService,
    private subscriptionService: SubscriptionService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
    @Inject(FULLTEXT_SEARCH) private fts: FulltextSearchService,
    @Optional()
    @InjectQueue(QUEUE_CLEAR_CANVAS_ENTITY)
    private canvasQueue?: Queue<DeleteCanvasNodesJobData>,
    @Optional()
    @InjectQueue(QUEUE_POST_DELETE_KNOWLEDGE_ENTITY)
    private postDeleteKnowledgeQueue?: Queue<PostDeleteKnowledgeEntityJobData>,
  ) {}

  async listDocuments(user: User, param: ListDocumentsData['query']) {
    const { page = 1, pageSize = 10, order = 'creationDesc', projectId, canvasId } = param;

    const orderBy: Prisma.DocumentOrderByWithRelationInput = {};
    if (order === 'creationAsc') {
      orderBy.pk = 'asc';
    } else {
      orderBy.pk = 'desc';
    }

    return this.prisma.document.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
        projectId,
        canvasId,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });
  }

  async getDocumentDetail(
    user: User,
    params: GetDocumentDetailData['query'],
  ): Promise<DocumentDetail> {
    const { docId } = params;

    if (!docId) {
      throw new ParamsError('Document ID is required');
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        docId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.oss.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    return { ...doc, content };
  }

  async exportDocument(
    user: User,
    params: { docId: string; format: 'markdown' | 'docx' | 'pdf' },
  ): Promise<Buffer> {
    const { docId, format } = params;

    if (!docId) {
      throw new ParamsError('Document ID is required');
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        docId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new DocumentNotFoundError('Document not found');
    }

    let content: string;
    if (doc.storageKey) {
      const contentStream = await this.oss.getObject(doc.storageKey);
      content = await streamToString(contentStream);
    }

    // Process images in the document content
    if (content) {
      content = await this.miscService.processContentImages(content);
    }

    // 添加文档标题作为 H1 标题
    const title = doc.title || 'Untitled';
    const markdownContent = `# ${title}\n\n${content || ''}`;

    // 根据格式转换内容
    switch (format) {
      case 'markdown':
        return Buffer.from(markdownContent);
      case 'docx': {
        const docxParser = new DocxParser();
        const docxData = await docxParser.parse(markdownContent);
        return docxData.buffer;
      }
      case 'pdf': {
        const pdfParser = new PdfParser();
        const pdfData = await pdfParser.parse(markdownContent);
        return pdfData.buffer;
      }
      default:
        throw new ParamsError('Unsupported format');
    }
  }

  private async saveDocumentState(user: User, document: DocumentPO, content: string) {
    const { docId } = document;

    // Save initial content and ydoc state to object storage
    const collabContext: CollabContext = {
      user,
      entity: document,
      entityType: 'document',
    };
    const connection = await this.collabService.openDirectConnection(docId, collabContext);
    try {
      incrementalMarkdownUpdate(connection.document, content);
    } finally {
      if (connection) await connection.disconnect().catch(() => undefined);
    }
  }

  private async updateDocumentStorageSize(document: DocumentPO) {
    const { docId, storageKey, stateStorageKey } = document;
    const [storageStat, stateStorageStat] = await Promise.all([
      this.oss.statObject(storageKey),
      this.oss.statObject(stateStorageKey),
    ]);
    const storageSize = storageStat.size + stateStorageStat.size;
    await this.prisma.document.update({
      where: { docId },
      data: { storageSize },
    });
  }

  private async doCreateDocument(
    user: User,
    param: UpsertDocumentRequest,
    options?: { checkStorageQuota?: boolean },
  ) {
    if (options?.checkStorageQuota) {
      const usageResult = await this.subscriptionService.checkStorageUsage(user);
      if (usageResult.available < 1) {
        throw new StorageQuotaExceeded();
      }
    }

    param.docId ||= genDocumentID();
    param.title ||= '';
    param.initialContent ||= '';

    if (param.canvasId) {
      const canvas = await this.prisma.canvas.findUnique({
        select: { pk: true },
        where: { canvasId: param.canvasId, uid: user.uid, deletedAt: null },
      });
      if (!canvas) {
        throw new CanvasNotFoundError();
      }
    }

    if (param.projectId) {
      const project = await this.prisma.project.findUnique({
        select: { pk: true },
        where: { projectId: param.projectId, uid: user.uid, deletedAt: null },
      });
      if (!project) {
        throw new ProjectNotFoundError();
      }
    }

    const existingDoc = await this.prisma.document.findUnique({
      where: { docId: param.docId },
    });
    if (existingDoc && existingDoc.uid !== user.uid) {
      throw new ParamsError(`Document ${param.docId} already exists for another user`);
    }

    const createInput: Prisma.DocumentCreateInput = {
      docId: param.docId,
      title: param.title,
      uid: user.uid,
      readOnly: param.readOnly ?? false,
      contentPreview: param.initialContent?.slice(0, 500),
      ...(param.canvasId ? { canvas: { connect: { canvasId: param.canvasId } } } : {}),
      ...(param.projectId ? { project: { connect: { projectId: param.projectId } } } : {}),
    };

    createInput.storageKey = `doc/${param.docId}.txt`;
    createInput.stateStorageKey = `state/${param.docId}`;

    // Save initial content and ydoc state to object storage
    await this.oss.putObject(createInput.storageKey, param.initialContent);

    // Add to vector store
    if (param.initialContent) {
      this.ragService
        .indexDocument(user, {
          pageContent: param.initialContent,
          metadata: {
            nodeType: 'document',
            docId: param.docId,
            title: param.title,
            projectId: param.projectId,
          },
        })
        .then(({ size }) => {
          // TODO: the vector size is not updated to DB.
          createInput.vectorSize = size;
        })
        .catch((error) => {
          this.logger.error(`failed to index document ${param.docId}: ${error.stack}`);
        });
    }

    const doc = await this.prisma.document.upsert({
      where: { docId: param.docId },
      create: createInput,
      update: {
        ...pick(param, ['title', 'readOnly', 'projectId']),
        contentPreview: createInput.contentPreview,
      },
    });

    if (existingDoc) {
      await this.saveDocumentState(user, existingDoc, param.initialContent);
    } else {
      // Create new state from fresh
      const ydoc = markdown2StateUpdate(param.initialContent);
      await this.oss.putObject(createInput.stateStorageKey, Buffer.from(ydoc));
    }

    await this.fts.upsertDocument(user, 'document', {
      id: param.docId,
      ...pick(doc, ['title', 'uid', 'projectId']),
      content: param.initialContent,
      createdAt: doc.createdAt.toJSON(),
      updatedAt: doc.updatedAt.toJSON(),
    });

    if (param.canvasId && param.resultId) {
      await this.canvasSyncService.addNodesToCanvas(user, param.canvasId, [
        {
          node: {
            type: 'document',
            data: {
              title: doc.title,
              entityId: doc.docId,
              metadata: {
                status: 'finish',
                parentResultId: param.resultId,
              },
              contentPreview: doc.contentPreview,
            },
          },
          connectTo: [{ type: 'skillResponse', entityId: param.resultId }],
        },
      ]);
    }

    await this.subscriptionService.syncStorageUsage(user);

    // Update storage size asynchronously
    this.updateDocumentStorageSize(doc).catch((error) => {
      this.logger.error(`failed to update document storage size: ${error.stack}`);
    });

    return doc;
  }

  async createDocument(
    user: User,
    param: UpsertDocumentRequest,
    options?: { checkStorageQuota?: boolean },
  ) {
    // Store workflow node execution to update status at the end
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;

    // Check if this document is related to action result
    if (param.resultId) {
      const result = await this.prisma.actionResult.findFirst({
        where: { resultId: param.resultId, uid: user.uid },
        orderBy: { version: 'desc' },
      });
      if (!result) {
        throw new ActionResultNotFoundError(`Action result ${param.resultId} not found`);
      }
      if (result.targetType === 'canvas') {
        param.canvasId = result.targetId;
      }
      if (result.projectId) {
        param.projectId = result.projectId;
      }

      // Check if this action result is created by a workflow node execution
      if (result.workflowNodeExecutionId) {
        const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
          where: {
            nodeExecutionId: result.workflowNodeExecutionId,
          },
        });
        const parsed = nodeExecution?.childNodeIds
          ? safeParseJSON(nodeExecution.childNodeIds)
          : undefined;
        const childNodeIds = Array.isArray(parsed)
          ? parsed.filter((id: unknown): id is string => typeof id === 'string')
          : [];
        if (childNodeIds.length > 0) {
          const docNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
            where: {
              nodeId: { in: childNodeIds },
              status: 'waiting',
              nodeType: 'document',
              executionId: nodeExecution.executionId,
            },
            orderBy: { createdAt: 'asc' },
          });
          if (docNodeExecution?.entityId) {
            param.docId = docNodeExecution.entityId;

            const nodeData: CanvasNode = safeParseJSON(docNodeExecution.nodeData);
            nodeExecutionToUpdate = {
              nodeExecutionId: docNodeExecution.nodeExecutionId,
              nodeData,
            };
          }
        }
      }
    }

    try {
      const doc = await this.doCreateDocument(user, param, options);

      // Update workflow node execution status to finish if exists
      if (nodeExecutionToUpdate) {
        await this.prisma.workflowNodeExecution.update({
          where: {
            nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
          },
          data: {
            title: param.title,
            entityId: param.docId,
            status: 'finish',
            nodeData: JSON.stringify({
              ...nodeExecutionToUpdate.nodeData,
              data: {
                ...nodeExecutionToUpdate.nodeData.data,
                title: param.title,
                entityId: param.docId,
              },
            }),
          },
        });
      }

      return doc;
    } catch (error) {
      // Update workflow node execution status to failed if exists
      if (nodeExecutionToUpdate) {
        try {
          await this.prisma.workflowNodeExecution.update({
            where: {
              nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
            },
            data: {
              status: 'failed',
            },
          });
        } catch (updateError) {
          this.logger.error(
            `Failed to update workflow node execution status to failed: ${updateError.stack}`,
          );
        }
      }
      throw error;
    }
  }

  async batchUpdateDocument(user: User, param: UpsertDocumentRequest[]) {
    const docIds = param.map((p) => p.docId);
    if (docIds.length !== new Set(docIds).size) {
      throw new ParamsError('Duplicate document IDs');
    }

    const count = await this.prisma.document.count({
      where: { docId: { in: docIds }, uid: user.uid, deletedAt: null },
    });

    if (count !== docIds.length) {
      throw new DocumentNotFoundError('Some of the documents cannot be found');
    }

    await this.prisma.$transaction(
      param.map((p) =>
        this.prisma.document.update({
          where: { docId: p.docId },
          data: pick(p, ['title', 'readOnly']),
        }),
      ),
    );

    // TODO: update elastcisearch docs and qdrant data points
  }

  async deleteDocument(user: User, param: DeleteDocumentRequest) {
    const { uid } = user;
    const { docId } = param;

    const doc = await this.prisma.document.findFirst({
      where: { docId, uid, deletedAt: null },
    });
    if (!doc) {
      throw new DocumentNotFoundError();
    }

    await this.prisma.document.update({
      where: { docId },
      data: { deletedAt: new Date() },
    });

    await this.subscriptionService.syncStorageUsage(user);

    await this.postDeleteKnowledgeQueue?.add('postDeleteKnowledgeEntity', {
      uid,
      entityId: docId,
      entityType: 'document',
    });
  }

  async postDeleteDocument(user: User, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { docId, deletedAt: { not: null } },
    });
    if (!doc) {
      this.logger.warn(`Deleted document ${docId} not found`);
      return;
    }

    const cleanups: Promise<any>[] = [
      this.prisma.labelInstance.updateMany({
        where: { entityType: 'document', entityId: docId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.ragService.deleteDocumentNodes(user, docId),
      this.fts.deleteDocument(user, 'document', docId),
      this.canvasQueue?.add('deleteNodes', {
        entities: [{ entityId: docId, entityType: 'document' }],
      }),
    ];

    if (doc.storageKey) {
      cleanups.push(this.oss.removeObject(doc.storageKey));
    }

    if (doc.stateStorageKey) {
      cleanups.push(this.oss.removeObject(doc.stateStorageKey));
    }

    await Promise.all(cleanups);
  }

  /**
   * Duplicate an existing document
   * @param user The user duplicating the document
   * @param param The duplicate document request param
   * @returns The newly created document
   */
  async duplicateDocument(user: User, param: DuplicateDocumentRequest) {
    const { docId: sourceDocId, title: newTitle, canvasId } = param;

    // Check storage quota
    const usageResult = await this.subscriptionService.checkStorageUsage(user);
    if (usageResult.available < 1) {
      throw new StorageQuotaExceeded();
    }

    // Find the source document
    const sourceDoc = await this.prisma.document.findFirst({
      where: { docId: sourceDocId, deletedAt: null },
    });
    if (!sourceDoc) {
      throw new DocumentNotFoundError(`Document ${sourceDocId} not found`);
    }

    // Generate a new document ID
    const newDocId = genDocumentID();

    const newStorageKey = `doc/${newDocId}.txt`;
    const newStateStorageKey = `state/${newDocId}`;

    // Create the new document using the existing createDocument method
    const newDoc = await this.prisma.document.create({
      data: {
        ...pick(sourceDoc, [
          'wordCount',
          'contentPreview',
          'storageSize',
          'vectorSize',
          'readOnly',
          'canvasId',
        ]),
        docId: newDocId,
        title: newTitle ?? sourceDoc.title,
        uid: user.uid,
        storageKey: newStorageKey,
        stateStorageKey: newStateStorageKey,
        canvasId,
      },
    });

    const dupRecord = await this.prisma.duplicateRecord.create({
      data: {
        uid: user.uid,
        sourceId: sourceDoc.docId,
        targetId: newDocId,
        entityType: 'document',
        status: 'pending',
      },
    });

    const migrations: Promise<any>[] = [
      this.oss.duplicateFile(sourceDoc.storageKey, newStorageKey),
      this.oss.duplicateFile(sourceDoc.stateStorageKey, newStateStorageKey),
      this.ragService.duplicateDocument({
        sourceUid: sourceDoc.uid,
        targetUid: user.uid,
        sourceDocId: sourceDoc.docId,
        targetDocId: newDocId,
      }),
      this.fts.duplicateDocument(user, 'document', sourceDoc.docId, newDocId),
    ];

    if (sourceDoc.uid !== user.uid) {
      migrations.push(
        this.miscService.duplicateFilesNoCopy(user, {
          sourceEntityId: sourceDoc.docId,
          sourceEntityType: 'document',
          sourceUid: sourceDoc.uid,
          targetEntityId: newDocId,
          targetEntityType: 'document',
        }),
      );
    }

    try {
      // Duplicate the files and index
      await Promise.all(migrations);

      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'finish' },
      });

      await this.subscriptionService.syncStorageUsage(user);
    } catch (error) {
      await this.prisma.duplicateRecord.update({
        where: { pk: dupRecord.pk },
        data: { status: 'failed' },
      });
      throw error;
    }

    return newDoc;
  }
}
