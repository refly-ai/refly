// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { InfiniteData, useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import {
  getCreditRecharge,
  getCreditUsage,
  getWebhookHistory,
  listCanvases,
  listCanvasTemplates,
  listCodeArtifacts,
  listDocuments,
  listDriveFiles,
  listResources,
  listWorkflowApps,
  listWorkflowExecutions,
  searchWorkflowsViaApi,
} from '@refly/openapi-schema';
import {
  GetCreditRechargeData,
  GetCreditRechargeError,
  GetCreditUsageData,
  GetCreditUsageError,
  GetWebhookHistoryData,
  GetWebhookHistoryError,
  ListCanvasesData,
  ListCanvasesError,
  ListCanvasTemplatesData,
  ListCanvasTemplatesError,
  ListCodeArtifactsData,
  ListCodeArtifactsError,
  ListDocumentsData,
  ListDocumentsError,
  ListDriveFilesData,
  ListDriveFilesError,
  ListResourcesData,
  ListResourcesError,
  ListWorkflowAppsData,
  ListWorkflowAppsError,
  ListWorkflowExecutionsData,
  ListWorkflowExecutionsError,
  SearchWorkflowsViaApiData,
  SearchWorkflowsViaApiError,
} from '@refly/openapi-schema';
import * as Common from './common';
export const useListCanvasesInfinite = <
  TData = InfiniteData<Common.ListCanvasesDefaultResponse>,
  TError = ListCanvasesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListCanvasesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listCanvases({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListDriveFilesInfinite = <
  TData = InfiniteData<Common.ListDriveFilesDefaultResponse>,
  TError = ListDriveFilesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDriveFilesData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListDriveFilesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listDriveFiles({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListCanvasTemplatesInfinite = <
  TData = InfiniteData<Common.ListCanvasTemplatesDefaultResponse>,
  TError = ListCanvasTemplatesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCanvasTemplatesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListCanvasTemplatesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listCanvasTemplates({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListResourcesInfinite = <
  TData = InfiniteData<Common.ListResourcesDefaultResponse>,
  TError = ListResourcesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListResourcesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListResourcesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listResources({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListDocumentsInfinite = <
  TData = InfiniteData<Common.ListDocumentsDefaultResponse>,
  TError = ListDocumentsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListDocumentsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListDocumentsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listDocuments({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListCodeArtifactsInfinite = <
  TData = InfiniteData<Common.ListCodeArtifactsDefaultResponse>,
  TError = ListCodeArtifactsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListCodeArtifactsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListCodeArtifactsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listCodeArtifacts({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListWorkflowExecutionsInfinite = <
  TData = InfiniteData<Common.ListWorkflowExecutionsDefaultResponse>,
  TError = ListWorkflowExecutionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowExecutionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListWorkflowExecutionsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listWorkflowExecutions({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useListWorkflowAppsInfinite = <
  TData = InfiniteData<Common.ListWorkflowAppsDefaultResponse>,
  TError = ListWorkflowAppsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListWorkflowAppsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListWorkflowAppsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listWorkflowApps({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useGetWebhookHistoryInfinite = <
  TData = InfiniteData<Common.GetWebhookHistoryDefaultResponse>,
  TError = GetWebhookHistoryError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetWebhookHistoryData, true>,
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseGetWebhookHistoryKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      getWebhookHistory({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useSearchWorkflowsViaApiInfinite = <
  TData = InfiniteData<Common.SearchWorkflowsViaApiDefaultResponse>,
  TError = SearchWorkflowsViaApiError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<SearchWorkflowsViaApiData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseSearchWorkflowsViaApiKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      searchWorkflowsViaApi({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useGetCreditRechargeInfinite = <
  TData = InfiniteData<Common.GetCreditRechargeDefaultResponse>,
  TError = GetCreditRechargeError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditRechargeData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseGetCreditRechargeKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      getCreditRecharge({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
export const useGetCreditUsageInfinite = <
  TData = InfiniteData<Common.GetCreditUsageDefaultResponse>,
  TError = GetCreditUsageError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<GetCreditUsageData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseGetCreditUsageKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      getCreditUsage({
        ...clientOptions,
        query: { ...clientOptions.query, page: pageParam as number },
      }).then((response) => response.data as TData) as TData,
    initialPageParam: '1',
    getNextPageParam: (response) =>
      (
        response as {
          nextPage: number;
        }
      ).nextPage,
    ...options,
  });
