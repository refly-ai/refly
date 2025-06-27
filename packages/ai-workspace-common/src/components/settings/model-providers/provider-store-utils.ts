import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
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
 * Get localized description from community provider config
 */
export const getLocalizedDescription = (
  description: string | { en: string; 'zh-CN': string },
  currentLanguage = 'en',
): string => {
  if (typeof description === 'string') {
    return description;
  }

  // Check for Chinese language
  if (currentLanguage === 'Chinese' || currentLanguage === 'zh-CN') {
    return description['zh-CN'] || description.en || '';
  }

  return description.en || description['zh-CN'] || '';
};

/**
 * Get provider pricing badge color
 */
export const getPricingBadgeColor = (pricing?: string): string => {
  switch (pricing) {
    case 'free':
      return '#52c41a'; // Green
    case 'paid':
      return '#f5222d'; // Red
    case 'freemium':
      return '#faad14'; // Orange
    default:
      return '#8c8c8c'; // Gray
  }
};

/**
 * Get provider category badge color
 */
export const getCategoryBadgeColor = (category: string): string => {
  switch (category) {
    case 'llm':
      return '#1677ff'; // Blue
    case 'embedding':
      return '#52c41a'; // Green
    case 'reranker':
      return '#fa8c16'; // Orange
    default:
      return '#8c8c8c'; // Gray
  }
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

/**
 * Sort providers by popularity and other criteria
 */
export const sortProviders = (providers: CommunityProviderConfig[]): CommunityProviderConfig[] => {
  return [...providers].sort((a, b) => {
    // First, sort by tags (official and popular)
    const aIsOfficial = a.tags?.includes('official') || false;
    const bIsOfficial = b.tags?.includes('official') || false;
    const aIsPopular = a.tags?.includes('popular') || false;
    const bIsPopular = b.tags?.includes('popular') || false;

    if (aIsOfficial && !bIsOfficial) return -1;
    if (!aIsOfficial && bIsOfficial) return 1;
    if (aIsPopular && !bIsPopular) return -1;
    if (!aIsPopular && bIsPopular) return 1;

    // Then sort by popularity score
    const aPopularity = a.popularity || 0;
    const bPopularity = b.popularity || 0;
    if (aPopularity !== bPopularity) {
      return bPopularity - aPopularity;
    }

    // Finally, sort alphabetically
    return a.name.localeCompare(b.name);
  });
};

/**
 * Get unique tags from providers list
 */
export const getAvailableTags = (providers: CommunityProviderConfig[]): string[] => {
  const tagSet = new Set<string>();
  for (const provider of providers) {
    if (provider.tags) {
      for (const tag of provider.tags) {
        tagSet.add(tag);
      }
    }
  }
  return Array.from(tagSet).sort();
};
