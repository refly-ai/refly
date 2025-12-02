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

interface BedrockApiKeyConfig {
  accessKeyId: string;
  secretAccessKey: string;
}

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params?: Partial<OpenAIBaseInput> | Partial<AzureOpenAIInput>,
  context?: { userId?: string; mode?: string },
): BaseChatModel => {
  let model: BaseChatModel;
  const extraParams = provider.extraParams ? JSON.parse(provider.extraParams) : {};

  const commonParams = {
    ...extraParams,
    ...params,
    ...(config?.disallowTemperature ? { temperature: undefined } : {}),
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
    case 'bedrock':
      if (!extraParams.region) {
        throw new ProviderMisconfigurationError('Region is required for Bedrock provider');
      }

      try {
        const apiKeyConfig = JSON.parse(provider.apiKey) as BedrockApiKeyConfig;
        model = new ChatBedrockConverse({
          model: config.modelId,
          region: extraParams.region,
          credentials: apiKeyConfig,
          maxTokens: config?.maxOutput,
          ...commonParams,
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
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }

  // Automatically wrap with monitoring
  return wrapChatModelWithMonitoring(model, {
    userId: context?.userId,
    modelId: config.modelId,
    provider: provider.providerKey,
    mode: context?.mode,
  });
};

export { BaseChatModel };
