/**
 * Registry interface definitions
 */

import type {
  DynamicToolDefinition,
  InstantiatedTool,
  ToolInstantiationContext,
  ToolsetConfig,
} from '@refly/openapi-schema';

/**
 * Tool definition registry interface
 * Manages tool definition registration (configuration → definition conversion)
 */
export interface IToolDefinitionRegistry {
  /**
   * Register tools from configuration
   * @param config - Toolset configuration
   * @returns Array of tool definitions
   */
  registerTools(config: ToolsetConfig): DynamicToolDefinition[];

  /**
   * Instantiate tools for a specific user context
   * @param context - Instantiation context
   * @returns Array of instantiated tools
   */
  instantiateTools(context: ToolInstantiationContext): Promise<InstantiatedTool[]>;

  /**
   * Get tool definition by name
   * @param name - Tool name
   * @returns Tool definition or null if not found
   */
  getToolDefinition(name: string): DynamicToolDefinition | null;

  /**
   * Get all registered tool definitions
   * @returns Array of all tool definitions
   */
  getAllDefinitions(): DynamicToolDefinition[];

  /**
   * Clear all registered tools
   */
  clear(): void;
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use IToolDefinitionRegistry instead
 */
export type IToolRegistry = IToolDefinitionRegistry;

/**
 * Configuration loader interface
 * Loads tool configurations from various sources
 */
export interface IConfigLoader {
  /**
   * Load configuration by inventory key
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   * @param toolsetId - Optional toolset ID for user-specific credentials
   * @returns Toolset configuration or null if not found
   */
  loadConfig(inventoryKey: string, toolsetId?: string): Promise<ToolsetConfig | null>;

  /**
   * Load all active configurations from inventory
   * @param authTypeFilter - Optional filter by type (e.g., 'regular', 'builtin', 'oauth')
   * @param uid - Optional user ID to load user-specific credentials
   * @returns Array of toolset configurations
   */
  loadAllConfigs(authTypeFilter?: string, uid?: string): Promise<ToolsetConfig[]>;

  /**
   * Reload configuration (clear cache and load fresh)
   * @param inventoryKey - Toolset inventory key
   * @param toolsetId - Optional toolset ID for user-specific credentials
   * @returns Reloaded configuration or null
   */
  reloadConfig(inventoryKey: string, toolsetId?: string): Promise<ToolsetConfig | null>;
}
