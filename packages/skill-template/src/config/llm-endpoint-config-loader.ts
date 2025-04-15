// packages/skill-template/src/config/llm-endpoint-config-loader.ts

/**
 * 定义 LLM 端点的配置结构。
 * 这应该与 models.config.yaml 中 llm.endpoints 下的条目结构保持一致。
 */
export interface EndpointConfig {
  name: string;
  api_key: string;
  base_url?: string; // 与 YAML 结构保持一致，允许可选
  models: string[];
  configuration?: {
    defaultHeaders?: Record<string, string>;
    [key: string]: any; // 允许其他 Langchain 支持的配置项
  };
  // 根据需要添加其他属性
}

/**
 * 定义 LLM 端点配置加载器的接口。
 * 任何实现此接口的类都必须提供一种根据模型名称查找配置的方法。
 */
export interface LlmEndpointConfigLoader {
  /**
   * 根据模型名称查找并返回相应的 LLM 端点配置。
   * @param modelName 请求的模型名称。
   * @returns 找到的端点配置对象，如果未找到则返回 undefined。
   */
  findLlmEndpointConfig(modelName: string): EndpointConfig | undefined;
}