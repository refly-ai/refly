import { TokenUsageItem } from '@refly-packages/openapi-schema';

/**
 * Aggregate token usage items by model tier and name
 */
export const aggregateTokenUsage = (usageItems: TokenUsageItem[]): TokenUsageItem[] => {
  const aggregatedUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      modelProvider: string;
    }
  > = {};

  for (const item of usageItems) {
    if (!item) continue;
    const key = `${item.tier}:${item.modelName}`;
    if (!aggregatedUsage[key]) {
      aggregatedUsage[key] = { inputTokens: 0, outputTokens: 0, modelProvider: item.modelProvider };
    }
    aggregatedUsage[key].inputTokens += item.inputTokens;
    aggregatedUsage[key].outputTokens += item.outputTokens;
  }

  return Object.entries(aggregatedUsage)
    .map(([key, value]) => {
      const [tier, modelName] = key.split(':');
      return {
        tier,
        modelName,
        modelProvider: value.modelProvider,
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,
      };
    })
    .sort((a, b) => {
      if (a.tier === b.tier) {
        return a.modelName.localeCompare(b.modelName);
      }
      return a.tier.localeCompare(b.tier);
    });
};
