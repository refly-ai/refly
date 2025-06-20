import { McpServerType, UpsertMcpServerRequest } from '@refly/openapi-schema';
import type { CommunityMcpConfig } from './types';

// Map server type from universal format to Refly format or infer from other fields
export const mapServerType = (type: string, serverConfig?: CommunityMcpConfig): McpServerType => {
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

// Convert community MCP configuration to server request format
export const convertCommunityConfigToServerRequest = (
  config: CommunityMcpConfig,
  apiKey?: string,
): UpsertMcpServerRequest => {
  // Apply API key configuration if provided
  const configuredConfig = apiKey ? applyCommunityMcpApiKey(config, apiKey) : config;

  // Map the type correctly using utility function
  const mappedType = mapServerType(configuredConfig.type, configuredConfig);

  const serverRequest: UpsertMcpServerRequest = {
    name: configuredConfig.name,
    type: mappedType,
    enabled: true,
  };

  // Add URL/command based on type
  if (configuredConfig.url) {
    serverRequest.url = configuredConfig.url;
  }
  if (configuredConfig.command) {
    serverRequest.command = configuredConfig.command;
  }
  if (configuredConfig.args) {
    serverRequest.args = configuredConfig.args;
  }

  // Add environment variables
  if (configuredConfig.env) {
    serverRequest.env = configuredConfig.env;
  }

  // Add headers - ensure it's not null/undefined for sse and streamable types
  if (mappedType === 'sse' || mappedType === 'streamable') {
    serverRequest.headers = configuredConfig.headers || {};
  }

  // Add reconnection settings only for non-stdio types
  if (mappedType !== 'stdio') {
    serverRequest.reconnect = {
      enabled: true,
      maxAttempts: 3,
      delayMs: 1000,
    };
  }

  // Add additional config
  if (configuredConfig.config) {
    serverRequest.config = configuredConfig.config;
  }

  return serverRequest;
};

// Apply API key configuration to community MCP configuration
export const applyCommunityMcpApiKey = (
  config: CommunityMcpConfig,
  apiKey: string,
): CommunityMcpConfig => {
  if (!config.authorization?.length) {
    return config;
  }

  const configured = { ...config };

  // Process authorization configuration
  if (config.authorization?.length) {
    for (const auth of config.authorization) {
      if (auth.type === 'apiKey') {
        switch (auth.apiKeyIn) {
          case 'url': {
            // Replace ${API_KEY} placeholder in URL
            if (configured.url) {
              configured.url = configured.url.replace('${API_KEY}', apiKey);
            }
            break;
          }
          case 'authorizationBearer': {
            // Add Authorization Bearer header
            configured.headers = {
              ...configured.headers,
              Authorization: `Bearer ${apiKey}`,
            };
            break;
          }
          case 'headers': {
            // Add custom header (using paramName or default to 'X-API-Key')
            const headerName = auth.paramName || 'X-API-Key';
            configured.headers = {
              ...configured.headers,
              [headerName]: apiKey,
            };
            break;
          }
        }
      }
    }
  }

  return configured;
};

// Check if community MCP config requires API key
export const requiresApiKey = (config: CommunityMcpConfig): boolean => {
  return config.authorization?.some((auth) => auth.type === 'apiKey') ?? false;
};

// Get auth method display text for a community MCP config
export const getAuthMethodText = (config: CommunityMcpConfig): string => {
  const auth = config.authorization?.find((a) => a.type === 'apiKey');
  if (!auth) return '';

  switch (auth.apiKeyIn) {
    case 'url':
      return 'URL Parameter';
    case 'authorizationBearer':
      return 'Bearer Token';
    case 'headers':
      return `Header (${auth.paramName || 'X-API-Key'})`;
    default:
      return 'API Key';
  }
};

// Check if a community config is already installed based on name
export const isConfigInstalled = (
  config: CommunityMcpConfig,
  installedServers: Array<{ name: string }>,
): boolean => {
  return installedServers.some((server) => server.name === config.name);
};

// Generate a unique name if there's a conflict
export const generateUniqueName = (
  baseName: string,
  installedServers: Array<{ name: string }>,
): string => {
  let uniqueName = baseName;
  let counter = 1;

  while (installedServers.some((server) => server.name === uniqueName)) {
    uniqueName = `${baseName} (${counter})`;
    counter++;
  }

  return uniqueName;
};

// Get description with locale support from translation function
export const getConfigDescription = (
  config: CommunityMcpConfig,
  t: (key: string) => string,
): string => {
  if (!config.description) {
    return '';
  }

  // If description is already a string, return it directly
  if (typeof config.description === 'string') {
    return config.description;
  }

  // If description is an object, get the appropriate language
  const currentLanguage = t('language');
  const languageKey = currentLanguage === '简体中文' ? 'zh-CN' : 'en';

  return config.description[languageKey] || config.description.en || '';
};
