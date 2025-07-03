import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

import { CommunityMcpResponse } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/types';
import {
  checkCommunityMcpApiHealth,
  fetchCommunityMcpConfigs,
} from '@refly-packages/ai-workspace-common/requests/mcp-community';

// Query key for community MCP configurations
export const useCommunityMcpConfigsKey = 'CommunityMcpConfigs';

// Query key function
export const UseCommunityMcpConfigsKeyFn = (queryKey?: Array<unknown>) => [
  useCommunityMcpConfigsKey,
  ...(queryKey ?? []),
];

// Type definitions for community MCP configs query
export type CommunityMcpConfigsDefaultResponse = CommunityMcpResponse;
export type CommunityMcpConfigsQueryResult<
  TData = CommunityMcpConfigsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;

/**
 * React Query hook to fetch community MCP configurations
 * @param queryKey - Additional query key parameters
 * @param options - React Query options
 * @returns Query result with community MCP configurations
 */
export const useListCommunityMcpConfigs = <
  TData = CommunityMcpConfigsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: UseCommunityMcpConfigsKeyFn(queryKey),
    queryFn: () => fetchCommunityMcpConfigs() as Promise<TData>,
    // Cache for 5 minutes to avoid excessive requests
    staleTime: 5 * 60 * 1000,
    // Keep cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    // Retry failed requests up to 3 times
    retry: 3,
    // Retry delay with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Don't refetch on window focus by default (can be overridden)
    refetchOnWindowFocus: false,
    ...options,
  });

// Query key for API health check
export const useCommunityMcpApiHealthKey = 'CommunityMcpApiHealth';

// Query key function for health check
export const UseCommunityMcpApiHealthKeyFn = (queryKey?: Array<unknown>) => [
  useCommunityMcpApiHealthKey,
  ...(queryKey ?? []),
];

// Type definitions for health check query
export type CommunityMcpApiHealthDefaultResponse = boolean;
export type CommunityMcpApiHealthQueryResult<
  TData = CommunityMcpApiHealthDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;

/**
 * React Query hook to check community MCP API health
 * @param queryKey - Additional query key parameters
 * @param options - React Query options
 * @returns Query result with API health status
 */
export const useCommunityMcpApiHealth = <
  TData = CommunityMcpApiHealthDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: UseCommunityMcpApiHealthKeyFn(queryKey),
    queryFn: () => checkCommunityMcpApiHealth() as Promise<TData>,
    // Cache health check for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Keep cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry failed requests once
    retry: 1,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    ...options,
  });
