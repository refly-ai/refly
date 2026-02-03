import type { AgentMode, TokenUsageItem } from '@refly/openapi-schema';
import type { ModelScene } from '@refly/common-types';
import { pick } from './typesafe';

/**
 * Map agent mode to model scene
 * @param mode - Agent mode (copilot_agent, node_agent, or undefined)
 * @returns Model scene (copilot, agent, or chat)
 */
export const getModelSceneFromMode = (mode?: AgentMode | string): ModelScene => {
  if (mode === 'copilot_agent') return 'copilot';
  if (mode === 'node_agent') return 'agent';
  return 'chat';
};

/**
 * Known vision-capable model patterns.
 * Models matching these patterns support image input natively.
 */
export const VISION_CAPABLE_MODEL_PATTERNS = [
  'claude-3',
  'claude-sonnet-4',
  'claude-opus-4',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4-vision',
  'gemini-2',
  'gemini-1.5',
  'gemini-pro-vision',
] as const;

/**
 * Check if a model is known to support vision capability based on its model ID.
 * This allows auto-enabling vision for models even if not explicitly configured in the database.
 *
 * @param modelId - The model identifier to check
 * @returns true if the model is known to support vision
 */
export const isKnownVisionModel = (modelId: string | undefined | null): boolean => {
  if (!modelId) return false;
  const lowerModelId = modelId.toLowerCase();
  return VISION_CAPABLE_MODEL_PATTERNS.some((pattern) =>
    lowerModelId.includes(pattern.toLowerCase()),
  );
};

/**
 * Aggregate token usage items by model name
 */
export const aggregateTokenUsage = (usageItems: TokenUsageItem[]): TokenUsageItem[] => {
  const aggregatedUsage: Record<string, TokenUsageItem> = {};

  for (const item of usageItems) {
    if (!item) continue;
    const key = item.modelName;
    if (!aggregatedUsage[key]) {
      aggregatedUsage[key] = {
        ...pick(item, ['modelProvider', 'modelName', 'modelLabel', 'providerItemId']),
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      };
    }
    aggregatedUsage[key].inputTokens += item.inputTokens;
    aggregatedUsage[key].outputTokens += item.outputTokens;
    aggregatedUsage[key].cacheReadTokens += item.cacheReadTokens ?? 0;
    aggregatedUsage[key].cacheWriteTokens += item.cacheWriteTokens ?? 0;
  }

  return Object.entries(aggregatedUsage).map(([key, value]) => {
    const modelName = key;
    return {
      modelName,
      ...pick(value, [
        'modelProvider',
        'modelLabel',
        'providerItemId',
        'inputTokens',
        'outputTokens',
        'cacheReadTokens',
        'cacheWriteTokens',
      ]),
    };
  });
};
