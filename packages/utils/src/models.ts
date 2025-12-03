import { TokenUsageItem } from '@refly/openapi-schema';
import { pick } from './typesafe';

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
      };
    }
    aggregatedUsage[key].inputTokens += item.inputTokens;
    aggregatedUsage[key].outputTokens += item.outputTokens;
    aggregatedUsage[key].cacheReadTokens += item.cacheReadTokens ?? 0;
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
      ]),
    };
  });
};
