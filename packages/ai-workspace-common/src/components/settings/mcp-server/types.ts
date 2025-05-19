import { McpServerDTO, McpServerType } from '@refly/openapi-schema';

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
