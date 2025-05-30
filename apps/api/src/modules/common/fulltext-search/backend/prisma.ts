import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SearchDomain, SearchRequest, SearchResult, User } from '@refly/openapi-schema';
import { FulltextDocument, FulltextSearchBackend } from './interface';

@Injectable()
export class PrismaFulltextSearchBackend implements FulltextSearchBackend {
  private readonly logger = new Logger(PrismaFulltextSearchBackend.name);
  private initialized = false;
  private database: 'sqlite' | 'postgresql' = 'sqlite';

  constructor(private readonly prisma: PrismaService) {
    if (process.env.DATABASE_URL?.startsWith('file:')) {
      this.database = 'sqlite';
    } else {
      this.database = 'postgresql';
    }
  }

  /**
   * Initialize the Prisma fulltext search backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.log('Initializing Prisma fulltext search backend');
    // No specific initialization needed for Prisma as the connection is managed by PrismaService
    this.initialized = true;
  }

  /**
   * Search a document from the Prisma database using fulltext search
   * @param user The user who is searching
   * @param index The index name (maps to a table/model in Prisma)
   * @param req The search request
   * @returns The search results
   */
  async searchDocument(
    user: User,
    index: SearchDomain,
    req: SearchRequest,
  ): Promise<SearchResult[]> {
    this.logger.debug(`Searching documents in index ${index} with query: ${req?.query}`);

    if (!req?.query) {
      return [];
    }

    try {
      // The index parameter maps to different Prisma models
      switch (index) {
        case 'document':
          return this.searchDocumentsTable(user, req);
        case 'resource':
          return this.searchResourcesTable(user, req);
        case 'canvas':
          return this.searchCanvasesTable(user, req);
        default:
          this.logger.warn(`Unknown index: ${index}`);
          return [];
      }
    } catch (error) {
      this.logger.error(`Error searching documents: ${error?.message}`, error);
      return [];
    }
  }

  /**
   * Upsert a document into the Prisma database
   * @param index The index name (maps to a table/model in Prisma)
   * @param document The document to upsert
   * @returns true if the document was upserted
   */
  async upsertDocument(_user: User, _index: string, _document: FulltextDocument): Promise<boolean> {
    // There is no need to do anything as the documents are already managed by upstream services
    return true;
  }

  /**
   * Delete a document from the Prisma database
   * @param index The index name (maps to a table/model in Prisma)
   * @param id The document id
   * @returns true if the document was deleted
   */
  async deleteDocument(_user: User, _index: string, _id: string): Promise<boolean> {
    // There is no need to do anything as the documents are already managed by upstream services
    return true;
  }

  /**
   * Duplicate a document from one id to another in the Prisma database
   * @param index The index name (maps to a table/model in Prisma)
   * @param sourceId The source document id
   * @param targetId The target document id
   * @param user The user who is duplicating the document
   * @returns the target document or null if source doesn't exist
   */
  async duplicateDocument(
    _user: User,
    _index: string,
    _sourceId: string,
    _targetId: string,
  ): Promise<FulltextDocument | null> {
    // There is no need to do anything as the documents are already managed by upstream services
    return null;
  }

  private async searchDocumentsTable(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const documents = await this.prisma.document.findMany({
      select: {
        docId: true,
        title: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
      where: {
        uid: user.uid,
        deletedAt: null,
        OR: [
          {
            title: {
              contains: req.query,
              ...(this.database === 'postgresql' && { mode: 'insensitive' }),
            },
          },
        ],
      },
      take: req.limit ?? 20,
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to SearchResult format
    return documents.map((doc) => ({
      id: doc.docId,
      domain: 'document',
      title: doc.title,
      highlightedTitle: doc.title,
      contentPreview: `${doc.contentPreview?.slice(0, 200)}...`,
      snippets: [
        {
          text: doc.contentPreview,
          highlightedText: doc.contentPreview,
        },
      ],
      createdAt: doc.createdAt.toJSON(),
      updatedAt: doc.updatedAt.toJSON(),
    }));
  }

  private async searchResourcesTable(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const resources = await this.prisma.resource.findMany({
      select: {
        resourceId: true,
        title: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
      where: {
        uid: user.uid,
        deletedAt: null,
        OR: [
          {
            title: {
              contains: req.query,
              ...(this.database === 'postgresql' && { mode: 'insensitive' }),
            },
          },
        ],
      },
      take: req.limit ?? 20,
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to SearchResult format
    return resources.map((resource) => ({
      id: resource.resourceId,
      domain: 'resource',
      title: resource.title,
      highlightedTitle: resource.title,
      contentPreview: `${resource.contentPreview?.slice(0, 200)}...`,
      snippets: [
        {
          text: resource.contentPreview,
          highlightedText: resource.contentPreview,
        },
      ],
      createdAt: resource.createdAt.toJSON(),
      updatedAt: resource.updatedAt.toJSON(),
    }));
  }

  private async searchCanvasesTable(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const canvases = await this.prisma.canvas.findMany({
      select: {
        canvasId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
      where: {
        uid: user.uid,
        deletedAt: null,
        OR: [
          {
            title: {
              contains: req.query,
              ...(this.database === 'postgresql' && { mode: 'insensitive' }),
            },
          },
        ],
      },
      take: req.limit ?? 20,
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to SearchResult format
    return canvases.map((canvas) => ({
      id: canvas.canvasId,
      domain: 'canvas',
      title: canvas.title,
      highlightedTitle: canvas.title,
      contentPreview: '',
      snippets: [],
      createdAt: canvas.createdAt.toJSON(),
      updatedAt: canvas.updatedAt.toJSON(),
    }));
  }
}
