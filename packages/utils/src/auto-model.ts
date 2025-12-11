import type { ProviderItemConfig } from '@refly/openapi-schema';
import { safeParseJSON } from './parse';

/**
 * Auto model constant
 * This is a special model that can automatically route to the best available model
 */
export const AUTO_MODEL_ID = 'auto';

/**
 * Auto model routing priority list.
 * The model router will try to route to models in this order until it finds an available one
 */
export const AUTO_MODEL_ROUTING_PRIORITY = [
  // Primary
  'global.anthropic.claude-opus-4-5-20251101-v1:0',
  // Fallbacks
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'us.anthropic.claude-sonnet-4-20250514-v1:0',
];

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
