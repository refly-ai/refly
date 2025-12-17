import type { ProviderItemConfig } from '@refly/openapi-schema';
import { safeParseJSON } from './parse';

/**
 * Auto model constant
 * This is a special model that can automatically route to the best available model
 */
export const AUTO_MODEL_ID = 'auto';

/**
 * Auto model routing priority list (legacy fallback).
 * The model router will try to route to models in this order until it finds an available one
 */
export const AUTO_MODEL_ROUTING_PRIORITY = [
  // Primary
  'global.anthropic.claude-opus-4-5-20251101-v1:0',
  // Fallbacks
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
];

/**
 * Get the random list for Auto model routing from environment variable
 * @returns Array of model IDs to rotate between, or empty array if not configured
 */
const getAutoModelRandomList = (): string[] => {
  const randomListStr = process.env.AUTO_MODEL_ROUTING_RANDOM_LIST;
  if (!randomListStr?.trim()) {
    return [];
  }
  return randomListStr
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
};

/**
 * Randomly select one model ID from the random list
 * @returns A randomly selected model ID, or null if list is empty
 */
export const selectAutoModel = (): string | null => {
  const randomList = getAutoModelRandomList();
  if (randomList.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * randomList.length);
  return randomList[randomIndex];
};

/**
 * Tool-based routing configuration
 */
export interface ToolBasedRoutingConfig {
  enabled: boolean;
  targetTools: string[];
  matchedModelId: string | null;
  unmatchedModelId: string | null;
}

/**
 * Get tool-based routing configuration from environment variables
 * @returns Tool-based routing configuration
 */
export const getToolBasedRoutingConfig = (): ToolBasedRoutingConfig => {
  const enabled = process.env.AUTO_MODEL_ROUTING_TOOL_BASED_ENABLED === 'true';

  const targetToolsStr = process.env.AUTO_MODEL_ROUTING_TOOL_BASED_TARGET_TOOLS;
  const targetTools = targetToolsStr
    ? targetToolsStr
        .split(',')
        .map((tool) => tool.trim())
        .filter((tool) => tool.length > 0)
    : [];

  const matchedModelId = process.env.AUTO_MODEL_ROUTING_TOOL_BASED_MATCHED_MODEL_ID?.trim() || null;
  const unmatchedModelId =
    process.env.AUTO_MODEL_ROUTING_TOOL_BASED_UNMATCHED_MODEL_ID?.trim() || null;

  return {
    enabled,
    targetTools,
    matchedModelId,
    unmatchedModelId,
  };
};

/**
 * Check if the given provider item config is the Auto model
 * @param config The provider item config (string or ProviderItemConfig)
 * @returns True if this is the Auto model
 */
export const isAutoModel = (config: string | ProviderItemConfig | null | undefined): boolean => {
  if (!config) {
    return false;
  }

  // If config is already an object, use it directly
  let modelConfig: ProviderItemConfig | null = null;
  if (typeof config === 'string') {
    modelConfig = safeParseJSON(config);
  } else {
    modelConfig = config;
  }

  if (!modelConfig) {
    return false;
  }

  // Check if config has modelId property and if it equals AUTO_MODEL_ID
  // This works for all config types in the union (LLMModelConfig, EmbeddingModelConfig, etc.)
  return 'modelId' in modelConfig && modelConfig.modelId === AUTO_MODEL_ID;
};
