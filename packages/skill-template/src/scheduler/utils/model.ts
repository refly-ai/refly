import { ModelInfo } from '@refly/openapi-schema';

export const checkIsSupportedModel = (modelInfo: ModelInfo) => {
  return !!modelInfo.capabilities.functionCall;
};

export const checkModelContextLenSupport = (modelInfo: ModelInfo) => {
  return modelInfo?.contextLimit > 8 * 1024;
};
