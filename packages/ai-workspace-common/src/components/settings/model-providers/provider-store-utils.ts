import { Provider } from '@refly/openapi-schema';
import { CommunityProviderConfig } from './provider-store-types';

/**
 * Convert community provider config to create provider request format
 */
export const convertCommunityConfigToProviderRequest = (
  config: CommunityProviderConfig,
  userConfig?: {
    apiKey?: string;
    baseUrl?: string;
    [key: string]: any;
  },
) => {
  return {
    name: config.name,
    providerKey: config.providerKey,
    categories: config.categories,
    apiKey: userConfig?.apiKey || '',
    baseUrl: userConfig?.baseUrl || config.baseUrl || '',
    enabled: true,
    ...(userConfig || {}),
  };
};

/**
 * Check if a community provider is already installed
 */
export const isProviderInstalled = (
  config: CommunityProviderConfig,
  installedProviders: Provider[],
): boolean => {
  return installedProviders.some(
    (provider) => provider.providerKey === config.providerKey && provider.name === config.name,
  );
};

/**
 * Check if a community provider requires API key
 */
export const requiresApiKey = (config: CommunityProviderConfig): boolean => {
  // Most providers require API key except for local/self-hosted ones
  const noApiKeyProviders = ['ollama', 'localai', 'text-generation-webui'];
  return !noApiKeyProviders.includes(config.providerKey);
};

/**
 * Filter providers based on search and filter criteria
 */
export const filterProviders = (
  providers: CommunityProviderConfig[],
  filters: {
    searchText: string;
    selectedCategory: string;
    selectedPricing: string;
    selectedTags: string[];
  },
): CommunityProviderConfig[] => {
  return providers.filter((provider) => {
    // Search filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const matchesSearch =
        provider.name.toLowerCase().includes(searchLower) ||
        provider.providerKey.toLowerCase().includes(searchLower) ||
        (typeof provider.description === 'string'
          ? provider.description.toLowerCase().includes(searchLower)
          : provider.description.en?.toLowerCase().includes(searchLower) ||
            provider.description['zh-CN']?.toLowerCase().includes(searchLower)) ||
        provider.author?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Category filter
    if (filters.selectedCategory && filters.selectedCategory !== 'all') {
      if (!provider.categories.includes(filters.selectedCategory as any)) {
        return false;
      }
    }

    // Pricing filter
    if (filters.selectedPricing && filters.selectedPricing !== 'all') {
      if (provider.pricing !== filters.selectedPricing) {
        return false;
      }
    }

    // Tags filter
    if (filters.selectedTags.length > 0) {
      const hasMatchingTag = filters.selectedTags.some((tag) => provider.tags?.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  });
};
