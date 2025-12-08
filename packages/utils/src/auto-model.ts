import type { LLMModelConfig } from '@refly/openapi-schema';
import { safeParseJSON } from './parse';

/**
 * Auto model constant
 * This is a special model that can automatically route to the best available model
 */
export const AUTO_MODEL_ID = 'auto';

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
