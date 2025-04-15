// apps/api/src/config/yaml-llm-endpoint-config-loader.ts

import {
  LlmEndpointConfigLoader,
  EndpointConfig,
} from '../../../../packages/skill-template/src/config/llm-endpoint-config-loader'; // 使用相对路径
// 导入并重命名现有的 YAML 加载函数，以避免命名冲突，并明确其来源
import { findLlmEndpointConfig as findLlmEndpointConfigFromYaml } from './yaml-config.loader';
import { Injectable, Logger } from '@nestjs/common'; // 假设使用 NestJS，如果不是，请替换为相应的日志库

/**
 * LlmEndpointConfigLoader 接口的 YAML 实现。
 * 它使用 yaml-config.loader.ts 中的逻辑从 models.config.yaml 文件加载配置。
 * 使用 @Injectable() 使其可以在 NestJS 中被注入。
 */
@Injectable() // 使其成为 NestJS 可注入的服务
export class YamlLlmEndpointConfigLoader implements LlmEndpointConfigLoader {
  private readonly logger = new Logger(YamlLlmEndpointConfigLoader.name);

  /**
   * 实现 LlmEndpointConfigLoader 接口的方法。
   * 调用 yaml-config.loader.ts 中的函数来查找配置。
   * @param modelName 请求的模型名称。
   * @returns 找到的端点配置，如果未找到则返回 undefined。
   */
  findLlmEndpointConfig(modelName: string): EndpointConfig | undefined {
    this.logger.debug(
      `Finding LLM endpoint config for model: ${modelName} using YAML loader implementation.`,
    );
    // 调用现有的加载逻辑。
    // 注意：需要确保 yaml-config.loader.ts 中导出的 findLlmEndpointConfig 函数
    // 返回的类型与 EndpointConfig 接口兼容或进行适当的类型断言/转换。
    // 这里假设返回类型兼容，如果需要，可以添加更严格的类型检查或转换。
    const config = findLlmEndpointConfigFromYaml(modelName);

    if (!config) {
      this.logger.warn(
        `LLM endpoint config not found for model: ${modelName} in models.config.yaml`,
      );
      return undefined;
    }

    // 可以选择性地进行更详细的类型验证，确保 config 包含所有必需的 EndpointConfig 字段
    // 例如: if (!config.name || !config.api_key || !config.models) { ... }

    // 明确返回类型为 EndpointConfig | undefined
    return config as EndpointConfig | undefined;
  }
}