import { LLMModelConfig } from '@refly/openapi-schema';

export const checkIsSupportedModel = (modelInfo: LLMModelConfig) => {
  return !!modelInfo?.capabilities?.functionCall;
};
