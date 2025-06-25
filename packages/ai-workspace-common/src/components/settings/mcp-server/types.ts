import { McpServerDTO, McpServerType } from '@refly/openapi-schema';

// Authorization type for community MCP
export interface CommunityMcpAuthorization {
  type: 'apiKey';
  apiKeyIn: 'url' | 'authorizationBearer' | 'headers';
  paramName?: string; // For headers type
}

// Community MCP configuration type
export interface CommunityMcpConfig {
  name: string;
  description:
    | string
    | {
        en: string;
        'zh-CN': string;
      };
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  config?: Record<string, any>;
  documentation?: string;
  author?: string;
  version?: string;
  tags?: string[];
  icon?: string;
  authorization?: CommunityMcpAuthorization[];
}

// Community MCP response type
export interface CommunityMcpResponse {
  servers: CommunityMcpConfig[];
  version?: string;
  lastUpdated?: string;
}

// Community MCP card props
export interface CommunityMcpCardProps {
  config: CommunityMcpConfig;
  isInstalled: boolean;
  isInstalling?: boolean;
  onInstall?: (config: CommunityMcpConfig) => void;
}

// Community MCP list props
export interface CommunityMcpListProps {
  visible: boolean;
  installedServers: McpServerDTO[];
  onInstallSuccess: () => void;
}

// Community MCP filter state
export interface CommunityMcpFilterState {
  searchText: string;
  selectedType: McpServerType | 'all';
}

// Form data type for MCP server
export interface McpServerFormData {
  name: string;
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    delayMs?: number;
  };
  config?: Record<string, any>;
  enabled?: boolean;
}

// Props for MCP server form component
export interface McpServerFormProps {
  initialData?: McpServerDTO;
  onSubmit: (data: McpServerFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

// Props for MCP server list component
export interface McpServerListProps {
  visible: boolean;
}

// Props for MCP server detail component
export interface McpServerDetailProps {
  server: McpServerDTO;
  onEdit: () => void;
  onDelete: () => void;
}

// Props for MCP server delete modal
export interface McpServerDeleteModalProps {
  serverName: string;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

// Props for MCP server JSON editor
export interface McpServerJsonEditorProps {
  value: McpServerFormData | McpServerFormData[];
  onChange: (value: McpServerFormData | McpServerFormData[]) => void;
  readOnly?: boolean;
}

// Props for MCP server batch import component
export interface McpServerBatchImportProps {
  onSuccess: () => void;
}

// Props for community MCP API key configuration modal
export interface CommunityMcpApiKeyModalProps {
  visible: boolean;
  config: CommunityMcpConfig;
  onClose: () => void;
  onSuccess?: (apiKey: string) => void;
  loading?: boolean;
}

// API key configuration data
export interface ApiKeyConfiguration {
  apiKey: string;
  [key: string]: any; // Additional configuration fields if needed
}
