import type { ToolsetDefinition } from '@refly/openapi-schema';

/**
 * OAuth toolset config structure
 * Stored in toolset.config field (JSON)
 */
export interface OAuthToolsetConfig {
  /** Composio integration ID (e.g., 'google-drive') */
  integrationId: string;

  /** Composio connected account ID */
  connectedAccountId: string;

  /** Tool definition metadata (fetched from Composio API) */
  definition?: ToolsetDefinition;

  /** Last time definition was synced from Composio API (ISO timestamp) */
  lastDefinitionSync?: string;
}
