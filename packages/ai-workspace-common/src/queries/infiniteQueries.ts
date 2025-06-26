// generated with @7nohe/openapi-react-query-codegen@2.0.0-beta.3

import { type Options } from '@hey-api/client-fetch';
import { InfiniteData, useInfiniteQuery, UseInfiniteQueryOptions } from '@tanstack/react-query';
import {
  listCanvases,
  listCanvasTemplates,
  listDocuments,
  listLabelClasses,
  listLabelInstances,
  listPages,
  listPilotSessions,
  listProjects,
  listResources,
  listSkillInstances,
  listSkillTriggers,
} from '../requests/services.gen';
import {
  ListCanvasesData,
  ListCanvasesError,
  ListCanvasTemplatesData,
  ListCanvasTemplatesError,
  ListDocumentsData,
  ListDocumentsError,
  ListLabelClassesData,
  ListLabelClassesError,
  ListLabelInstancesData,
  ListLabelInstancesError,
  ListPagesData,
  ListPagesError,
  ListPilotSessionsData,
  ListPilotSessionsError,
  ListProjectsData,
  ListProjectsError,
  ListResourcesData,
  ListResourcesError,
  ListSkillInstancesData,
  ListSkillInstancesError,
  ListSkillTriggersData,
  ListSkillTriggersError,
} from '../requests/types.gen';
import * as Common from './common';
export const useListPagesInfinite = <
  TData = InfiniteData<Common.ListPagesDefaultResponse>,
  TError = ListPagesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPagesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListPagesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listPages({
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
export const useListProjectsInfinite = <
  TData = InfiniteData<Common.ListProjectsDefaultResponse>,
  TError = ListProjectsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListProjectsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListProjectsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listProjects({
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
export const useListLabelClassesInfinite = <
  TData = InfiniteData<Common.ListLabelClassesDefaultResponse>,
  TError = ListLabelClassesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelClassesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListLabelClassesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listLabelClasses({
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
export const useListLabelInstancesInfinite = <
  TData = InfiniteData<Common.ListLabelInstancesDefaultResponse>,
  TError = ListLabelInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListLabelInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListLabelInstancesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listLabelInstances({
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
export const useListSkillInstancesInfinite = <
  TData = InfiniteData<Common.ListSkillInstancesDefaultResponse>,
  TError = ListSkillInstancesError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillInstancesData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListSkillInstancesKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listSkillInstances({
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
export const useListSkillTriggersInfinite = <
  TData = InfiniteData<Common.ListSkillTriggersDefaultResponse>,
  TError = ListSkillTriggersError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListSkillTriggersData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListSkillTriggersKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listSkillTriggers({
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
export const useListPilotSessionsInfinite = <
  TData = InfiniteData<Common.ListPilotSessionsDefaultResponse>,
  TError = ListPilotSessionsError,
  TQueryKey extends Array<unknown> = unknown[],
>(
  clientOptions: Options<ListPilotSessionsData, true> = {},
  queryKey?: TQueryKey,
  options?: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useInfiniteQuery({
    queryKey: Common.UseListPilotSessionsKeyFn(clientOptions, queryKey),
    queryFn: ({ pageParam }) =>
      listPilotSessions({
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
