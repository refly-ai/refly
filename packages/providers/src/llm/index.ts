import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';
import { AzureChatOpenAI, AzureOpenAIInput, OpenAIBaseInput } from '@langchain/openai';
import { ChatBedrockConverse } from '@langchain/aws';
import { wrapChatModelWithMonitoring } from '../monitoring/langfuse-wrapper';
import { ProviderMisconfigurationError } from '@refly/errors';
import { ChatVertexAI } from '@langchain/google-vertexai';

interface BedrockApiKeyConfig {
  accessKeyId: string;
  secretAccessKey: string;
}

interface BedrockExtraParams {
  region?: string;
  regions?: string[];
}

/**
 * Select region for Bedrock provider with the following priority:
 * 1. If `region` is specified, use it directly (backward compatible)
 * 2. Otherwise, randomly select from `regions` array (load balancing)
 * 3. If neither is specified, throw an error
 */
const selectBedrockRegion = (extraParams: BedrockExtraParams): string => {
  // Priority 1: Use fixed region if specified
  if (extraParams.region) {
    return extraParams.region;
  }

  // Priority 2: Randomly select from regions array
  if (extraParams.regions && extraParams.regions.length > 0) {
    const randomIndex = Math.floor(Math.random() * extraParams.regions.length);
    return extraParams.regions[randomIndex];
  }

  // Neither region nor regions is specified
  throw new ProviderMisconfigurationError(
    'Region is required for Bedrock provider. Specify either "region" (single) or "regions" (array) in extraParams.',
  );
};

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params?: Partial<OpenAIBaseInput> | Partial<AzureOpenAIInput>,
  context?: { userId?: string },
): BaseChatModel => {
  let model: BaseChatModel;
  const extraParams = provider.extraParams ? JSON.parse(provider.extraParams) : {};

  // Extract route data from config if present (for Auto model routing)
  const routeData = (config as any).routeData;

  const commonParams = {
    ...extraParams,
    ...params,
    ...(config?.disallowTemperature ? { temperature: undefined } : {}),
    // Include route data and tags for monitoring
    ...(routeData ? { metadata: routeData, tags: ['auto-routed'] } : {}),
  };

  switch (provider?.providerKey) {
    case 'openai':
      model = new EnhancedChatOpenAI({
        model: config.modelId,
        apiKey: provider.apiKey,
        configuration: {
          baseURL: provider.baseUrl,
        },
        maxTokens: config?.maxOutput,
        reasoning: config?.capabilities?.reasoning ? { effort: 'medium' } : undefined,
        ...commonParams,
      });
      break;
    case 'ollama':
      model = new ChatOllama({
        model: config.modelId,
        baseUrl: provider.baseUrl?.replace(/\/v1\/?$/, ''),
        ...commonParams,
      });
      break;
    case 'fireworks':
      model = new ChatFireworks({
        model: config.modelId,
        apiKey: provider.apiKey,
        maxTokens: config?.maxOutput,
        ...commonParams,
      });
      break;
    case 'azure':
      model = new AzureChatOpenAI({
        model: config.modelId,
        azureOpenAIApiKey: provider.apiKey,
        maxTokens: config?.maxOutput,
        reasoningEffort: config?.capabilities?.reasoning ? 'medium' : undefined,
        ...commonParams,
      });
      break;
    case 'bedrock': {
      const selectedRegion = selectBedrockRegion(extraParams as BedrockExtraParams);
      // Exclude region/regions from commonParams to prevent overriding selectedRegion
      const { region: _region, regions: _regions, ...bedrockCommonParams } = commonParams;

      try {
        const apiKeyConfig = JSON.parse(provider.apiKey) as BedrockApiKeyConfig;
        model = new ChatBedrockConverse({
          model: config.modelId,
          region: selectedRegion,
          credentials: apiKeyConfig,
          maxTokens: config?.maxOutput,
          ...bedrockCommonParams,
          ...(config?.capabilities?.reasoning
            ? {
                additionalModelRequestFields: {
                  thinking: {
                    type: 'enabled',
                    budget_tokens: 2000, // Must be over 1024
                  },
                },
                temperature: undefined, // Temperature must be 1 or unset for reasoning to work
              }
            : {}),
        });
      } catch (error) {
        throw new ProviderMisconfigurationError(`Invalid bedrock api key config: ${error}`);
      }
      break;
    }
    case 'vertex': {
      model = new ChatVertexAI({
        model: config.modelId,
        location: 'global',
        maxOutputTokens: config?.maxOutput,
        ...commonParams,
        ...(config?.capabilities?.reasoning ? { reasoning: { effort: 'medium' } } : {}),
      });
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }

  // Automatically wrap with monitoring
  return wrapChatModelWithMonitoring(model, {
    userId: context?.userId,
    modelId: config.modelId,
    provider: provider.providerKey,
  });
};

export { BaseChatModel };
