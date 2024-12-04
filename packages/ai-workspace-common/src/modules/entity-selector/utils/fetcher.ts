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
  skill: async (queryPayload) => {
    const res = await getClient().listSkills({
      query: queryPayload,
    });
    const data: SearchResult[] = (res?.data?.data || []).map((item) => ({
      id: item?.name,
      title: item?.displayName,
      domain: 'skill',
      metadata: {
        // configSchema: item?.configSchema,
        // description: item?.description,
        originalItem: item,
      },
    }));
    return { success: res?.data?.success, data };
  },
  tool: async (queryPayload) => {
    // const res = await getClient().listTools({
    //   query: queryPayload,
    // });
    const res = {
      data: {
        success: true,
        data: [
          {
            toolId: 'webSearch',
            displayName: 'Web Search',
          },
          {
            toolId: 'librarySearch',
            displayName: 'Library Search',
          },
          {
            toolId: 'multilingualSearch',
            displayName: 'Multilingual Search',
          },
        ],
      },
    };
    const data: SearchResult[] = (res?.data?.data || []).map((item) => ({
      id: item?.toolId,
      title: item?.displayName,
      domain: 'tool',
    }));
    return { success: res?.data?.success, data };
  },
};
