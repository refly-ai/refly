import { CommunityMcpResponse } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/types';

// Community MCP configuration API URL
const COMMUNITY_MCP_API_URL = 'https://static.refly.ai/mcp-config/mcp-catalog.json';

/**
 * Fetch community MCP configurations from external API
 * @returns Promise containing community MCP configurations
 */
export const fetchCommunityMcpConfigs = async (): Promise<CommunityMcpResponse> => {
  try {
    const response = await fetch(COMMUNITY_MCP_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Add cache control to avoid excessive requests
      cache: 'default',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response data structure
    if (!data || typeof data !== 'object' || !Array.isArray(data.servers)) {
      throw new Error('Invalid response format: response should contain a servers array');
    }

    // Return the response with metadata
    return {
      servers: data.servers,
      version: data.version || response.headers.get('x-version') || undefined,
      lastUpdated:
        data.lastUpdated || response.headers.get('last-modified') || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to fetch community MCP configurations:', error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Failed to fetch community MCP configurations: ${error.message}`);
    }

    throw new Error('Failed to fetch community MCP configurations: Unknown error');
  }
};

/**
 * Check if the community MCP API is available
 * @returns Promise<boolean> indicating if the API is reachable
 */
export const checkCommunityMcpApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(COMMUNITY_MCP_API_URL, {
      method: 'HEAD',
      cache: 'no-cache',
    });

    return response.ok;
  } catch (error) {
    console.warn('Community MCP API health check failed:', error);
    return false;
  }
};
