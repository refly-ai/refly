import {
  ProviderItem as ProviderItemModel,
  Provider as ProviderModel,
} from '../../generated/client';
import { pick } from '../../utils';
import {
  Provider,
  ProviderItem,
  ProviderCategory,
  ModelInfo,
  LLMModelConfig,
  ModelTier,
} from '@refly/openapi-schema';

export const providerPO2DTO = (provider: ProviderModel): Provider => {
  if (!provider) {
    return undefined;
  }

  return {
    ...pick(provider, ['providerId', 'providerKey', 'name', 'baseUrl', 'enabled', 'isGlobal']),
    categories: provider.categories ? (provider.categories.split(',') as ProviderCategory[]) : [],
  };
};

export const providerItemPO2DTO = (
  providerItem: ProviderItemModel & { provider?: ProviderModel },
): ProviderItem => {
  return {
    ...pick(providerItem, ['providerId', 'itemId', 'name', 'enabled', 'order']),
    group: providerItem.groupName,
    category: providerItem.category as ProviderCategory,
    tier: providerItem.tier as ModelTier,
    provider: providerPO2DTO(providerItem.provider),
    config: JSON.parse(providerItem.config || '{}'),
  };
};

export const providerItem2ModelInfo = (
  providerItem: ProviderItemModel & { provider?: ProviderModel },
): ModelInfo => {
  const config: LLMModelConfig = JSON.parse(providerItem.config || '{}');
  return {
    name: config.modelId,
    label: providerItem.name,
    provider: providerItem.provider?.name ?? '',
    tier: providerItem.tier as ModelTier,
    contextLimit: config.contextLimit ?? 0,
    maxOutput: config?.maxOutput ?? 0,
    capabilities: config?.capabilities ?? {},
    isDefault: false,
  };
};
