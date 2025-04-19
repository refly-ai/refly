import { SearchDomain, SearchRequest, SearchResult, User } from '@refly/openapi-schema';

export type FulltextDocument = Record<string, unknown> & {
  id: string;
};

/**
 * Fulltext search backend interface
 */
export interface FulltextSearchBackend {
  /**
   * Initialize the fulltext search backend
   */
  initialize(): Promise<void>;

  /**
   * Search a document from the search index
   * @param user The document owner
   * @param index The index name
   * @param query The query string
   * @returns The search results
   */
  searchDocument(user: User, index: SearchDomain, req: SearchRequest): Promise<SearchResult[]>;

  /**
   * Upsert a document into the search index
   * @param user The document owner
   * @param index The index name
   * @param document The document to upsert
   * @returns true if the document was upserted, false if it didn't exist
   */
  upsertDocument(user: User, index: SearchDomain, document: FulltextDocument): Promise<boolean>;

  /**
   * Remove an object from storage
   * @param user The document owner
   * @param index The index name
   * @param id The document id
   * @returns true if the object was removed, false if it didn't exist
   */
  deleteDocument(user: User, index: SearchDomain, id: string): Promise<boolean>;

  /**
   * Duplicate a document from one id to another
   * @param user The user who is duplicating the document
   * @param index The index name
   * @param sourceId The source document id
   * @param targetId The target document id
   * @returns the target document or null if source doesn't exist
   */
  duplicateDocument(
    user: User,
    index: SearchDomain,
    sourceId: string,
    targetId: string,
  ): Promise<FulltextDocument | null>;
}
