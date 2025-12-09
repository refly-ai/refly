import type { LLMModelConfig } from '@refly/openapi-schema';
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
 * @param configStr The provider item config string
 * @returns True if this is the Auto model
 */
export const isAutoModel = (configStr: string | null | undefined): boolean => {
  if (!configStr) {
    return false;
  }
  const config: LLMModelConfig = safeParseJSON(configStr);
  if (!config) {
    return false;
  }
  return config.modelId === AUTO_MODEL_ID;
};
