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
