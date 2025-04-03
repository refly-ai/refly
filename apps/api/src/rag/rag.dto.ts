import { ResourceType } from '@refly-packages/openapi-schema';

export type ContentNodeType = 'resource' | 'document';

export interface DocumentPayload {
  title: string;
  nodeType: ContentNodeType;
  url?: string;
  docId?: string;
  projectId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
  [key: string]: any; // any other fields
}

export interface ContentPayload extends DocumentPayload {
  seq: number;
  content: string;
}

export interface ContentNode {
  id: string;
  vector: number[];
  payload: ContentPayload;
}

export interface RetrieveFilter {
  nodeTypes?: ContentNodeType[];
  urls?: string[];
  docIds?: string[];
  resourceIds?: string[];
  projectIds?: string[];
}

export interface HybridSearchParam {
  query: string;
  vector?: number[];
  filter?: RetrieveFilter;
  limit?: number;
}

export interface ReaderResult {
  code: number;
  status: number;
  data: {
    title: string;
    url: string;
    content: string;
    publishedTime?: string;
  };
}
