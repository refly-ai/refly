import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SearchDomain, SearchRequest, SearchResult, User } from '@refly/openapi-schema';
import { FulltextDocument, FulltextSearchBackend } from './backend/interface';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { PrismaFulltextSearchBackend } from './backend/prisma';
import { ElasticsearchFulltextSearchBackend } from './backend/elasticsearch';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';

@Injectable()
export class FulltextSearchService implements OnModuleInit {
  private readonly logger = new Logger(FulltextSearchService.name);

  constructor(private readonly backend: FulltextSearchBackend) {}

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        await this.backend.initialize();
        this.logger.log('Fulltext search service initialized');
      },
      {
        logger: this.logger,
        label: 'FulltextSearchService.onModuleInit',
      },
    );
  }

  /**
   * Search a document from the search index
   * @param user The document owner
   * @param index The index name
   * @param req The search request
   * @returns The search results
   */
  async searchDocument(
    user: User,
    index: SearchDomain,
    req: SearchRequest,
  ): Promise<SearchResult[]> {
    return this.backend.searchDocument(user, index, req);
  }

  /**
   * Upsert a document into the search index
   * @param user The document owner
   * @param index The index name
   * @param document The document to upsert
   * @returns true if the document was upserted, false if it didn't exist
   */
  async upsertDocument(
    user: User,
    index: SearchDomain,
    document: FulltextDocument,
  ): Promise<boolean> {
    return this.backend.upsertDocument(user, index, document);
  }

  /**
   * Remove a document from the search index
   * @param user The document owner
   * @param index The index name
   * @param id The document id
   * @returns true if the document was removed, false if it didn't exist
   */
  async deleteDocument(user: User, index: SearchDomain, id: string): Promise<boolean> {
    return this.backend.deleteDocument(user, index, id);
  }

  /**
   * Duplicate a document from one id to another
   * @param user The user who is duplicating the document
   * @param index The index name
   * @param sourceId The source document id
   * @param targetId The target document id
   * @returns the target document or null if source doesn't exist
   */
  async duplicateDocument(
    user: User,
    index: SearchDomain,
    sourceId: string,
    targetId: string,
  ): Promise<FulltextDocument | null> {
    return this.backend.duplicateDocument(user, index, sourceId, targetId);
  }
}

export const createFulltextSearchFactory = () => {
  return (prisma: PrismaService, configService: ConfigService) => {
    const backendType = configService.get('fulltextSearch.backend');

    let backend: FulltextSearchBackend;
    if (backendType === 'prisma') {
      backend = new PrismaFulltextSearchBackend(prisma);
    } else if (backendType === 'elasticsearch') {
      backend = new ElasticsearchFulltextSearchBackend(
        configService.get('fulltextSearch.elasticsearch'),
      );
    } else {
      throw new Error(`Unknown backend type: ${backendType}`);
    }

    return new FulltextSearchService(backend);
  };
};

// Export the provider tokens
export * from './tokens';
