import {
  ActionResult,
  InvokeSkillRequest,
  LLMModelConfig,
  MediaGenerationModelConfig,
  Provider,
  ProviderItem,
} from '@refly/openapi-schema';

export type ModelConfigMap = {
  chat?: LLMModelConfig;
  copilot?: LLMModelConfig;
  agent?: LLMModelConfig;
  queryAnalysis?: LLMModelConfig;
  titleGeneration?: LLMModelConfig;
  image?: MediaGenerationModelConfig;
  video?: MediaGenerationModelConfig;
  audio?: MediaGenerationModelConfig;
};

export interface InvokeSkillJobData extends InvokeSkillRequest {
  uid: string;
  rawParam: string;
  result?: ActionResult;
  provider?: Provider;
  providerItem?: ProviderItem;
  modelConfigMap?: ModelConfigMap;
  /** Serialized OpenTelemetry trace context for cross-pod propagation */
  traceCarrier?: Record<string, string>;
}
