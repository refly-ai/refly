import { useQuery } from '@tanstack/react-query';
import { CommunityProviderResponse } from '../components/settings/model-providers/provider-store-types';
import {
  fetchCommunityProviderConfigs,
  checkCommunityProviderApiHealth,
} from '../requests/provider-community';

/**
 * Query key factory for community providers
 */
export const communityProviderKeys = {
  all: ['community-providers'] as const,
  lists: () => [...communityProviderKeys.all, 'list'] as const,
  list: () => [...communityProviderKeys.lists()] as const,
  health: () => [...communityProviderKeys.all, 'health'] as const,
};

/**
 * Hook to fetch community provider configurations
 */
export const useListCommunityProviders = () => {
  return useQuery<CommunityProviderResponse, Error>({
    queryKey: communityProviderKeys.list(),
    queryFn: fetchCommunityProviderConfigs,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
};

/**
 * Hook to check community provider API health
 */
export const useCommunityProviderApiHealth = () => {
  return useQuery<boolean, Error>({
    queryKey: communityProviderKeys.health(),
    queryFn: checkCommunityProviderApiHealth,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
};
