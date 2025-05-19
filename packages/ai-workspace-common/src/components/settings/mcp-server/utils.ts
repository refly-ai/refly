import { McpServerType } from '@refly/openapi-schema';

// Map server type from universal format to Refly format or infer from other fields
export const mapServerType = (type: string, serverConfig?: any): McpServerType => {
  const typeMap: Record<string, McpServerType> = {
    sse: 'sse',
    streamable: 'streamable',
    streamableHttp: 'streamable',
    stdio: 'stdio',
    inMemory: 'sse', // Map inMemory to sse as a fallback
  };

  // If type is valid, use it directly
  if (type && typeMap[type]) {
    return typeMap[type];
  }

  // If type is missing or invalid, infer from other fields
  if (serverConfig) {
    // Check if it's a stdio type (has command)
    if (serverConfig.command) {
      return 'stdio';
    }

    // Check URL patterns
    const url = serverConfig.url || '';
    if (url) {
      // Check for SSE (URL contains 'sse')
      if (url.toLowerCase().includes('sse')) {
        return 'sse';
      }

      // Check for streamable (URL contains 'mcp')
      if (url.toLowerCase().includes('mcp')) {
        return 'streamable';
      }
    }
  }

  // Default fallback
  return 'streamable';
};
