import { CommunityProviderResponse } from '../components/settings/model-providers/provider-store-types';

const COMMUNITY_PROVIDER_API_URL = 'https://static.refly.ai/config/provider-catalog.json';

// Check if we're in development environment
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Fetch community provider configurations
 * In development: read from local config file
 * In production: fetch from remote API
 */
export const fetchCommunityProviderConfigs = async (): Promise<CommunityProviderResponse> => {
  try {
    let data: any;

    if (isDevelopment) {
      // In development, read from local config file
      const configModule = await import('../../../../config/provider-catalog.json');
      data = configModule.default || configModule;
    } else {
      // In production, fetch from remote API
      const response = await fetch(COMMUNITY_PROVIDER_API_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch community providers: ${response.status} ${response.statusText}`,
        );
      }

      data = await response.json();
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format: expected object');
    }

    // Handle both direct array format and object with providers property
    let providers = [];
    if (Array.isArray(data)) {
      providers = data;
    } else if (data.providers && Array.isArray(data.providers)) {
      providers = data.providers;
    } else {
      throw new Error('Invalid response format: providers array not found');
    }

    // Transform providers to match expected format
    const transformedProviders = providers.map((provider: any) => ({
      ...provider,
      providerId: provider.providerId || provider.name.toLowerCase().replace(/\s+/g, '-'),
      // Map 'categories' to match expected format
      categories: provider.categories || [],
    }));

    return {
      providers: transformedProviders,
      meta: data.meta || {
        total: transformedProviders.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error fetching community provider configs:', error);
    throw error;
  }
};

/**
 * Check community provider API health
 * Using real API health check
 */
export const checkCommunityProviderApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(COMMUNITY_PROVIDER_API_URL, {
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    return response.ok;

    // Commented out mock implementation
    /*
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return true for mock data
    return true;
    */
  } catch (error) {
    console.error('Community provider API health check failed:', error);
    return false;
  }
};
