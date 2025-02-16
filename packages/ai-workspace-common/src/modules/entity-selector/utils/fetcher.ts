import { SearchDomain, SearchResult } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export type DataFetcher = (queryPayload: {
  page: number;
  pageSize: number;
}) => Promise<{ success: boolean; data?: SearchResult[] }>;

export const domainToFetchData: Record<SearchDomain, DataFetcher> = {
  resource: async (queryPayload) => {
    const res = await getClient().listResources({
      query: queryPayload,
    });
    const data: SearchResult[] = (res?.data?.data || []).map((item) => ({
      id: item?.resourceId,
      title: item?.title,
      domain: 'resource',
      metadata: {
        resourceType: item?.resourceType,
      },
      snippets: [
        {
          text: item?.contentPreview,
        },
      ],
      contentPreview: item?.contentPreview,
    }));
    return { success: res?.data?.success, data };
  },
  document: async (queryPayload) => {
    const res = await getClient().listDocuments({
      query: queryPayload,
    });
    const data: SearchResult[] = (res?.data?.data || []).map((item) => ({
      id: item?.docId,
      title: item?.title,
      domain: 'document',
      snippets: [
        {
          text: item?.contentPreview,
        },
      ],
      contentPreview: item?.contentPreview,
    }));
    return { success: res?.data?.success, data };
  },
  canvas: async (queryPayload) => {
    const res = await getClient().listCanvases({
      query: queryPayload,
    });
    const data: SearchResult[] = (res?.data?.data || []).map((item) => ({
      id: item?.canvasId,
      title: item?.title,
      domain: 'canvas',
    }));
    return { success: res?.data?.success, data };
  },
};
