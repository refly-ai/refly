import { safeParseJSON } from '@refly/utils';
import { ProviderItem as ProviderItemModel, Provider as ProviderModel } from '@prisma/client';
import { pick } from '../../utils';
import { normalizeCreditBilling } from '../../utils/credit-billing';
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
    ...pick(provider, [
      'providerId',
      'providerKey',
      'name',
      'baseUrl',
      'enabled',
      'isGlobal',
      'extraParams',
    ]),
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
    creditBilling: normalizeCreditBilling(
      providerItem.creditBilling ? safeParseJSON(providerItem.creditBilling) : undefined,
    ),
    provider: providerPO2DTO(providerItem.provider),
    config: safeParseJSON(providerItem.config || '{}'),
  };
};

export const providerItem2ModelInfo = (
  providerItem: ProviderItemModel & { provider?: ProviderModel },
): ModelInfo => {
  const config: LLMModelConfig = safeParseJSON(providerItem.config || '{}');
  return {
    name: config.modelId,
    label: providerItem.name,
    providerItemId: providerItem.itemId,
    provider: providerItem.provider?.name ?? '',
    tier: providerItem.tier as ModelTier,
    contextLimit: config.contextLimit ?? 0,
    maxOutput: config?.maxOutput ?? 0,
    capabilities: config?.capabilities ?? {},
    isDefault: false,
  };
};
