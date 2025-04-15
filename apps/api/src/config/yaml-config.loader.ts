import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Logger } from '@nestjs/common';

const MODELS_CONFIG_PATH = '/app/apps/api/models.config.yaml'; // 统一配置文件路径
const logger = new Logger('YamlConfigLoader');

// --- 类型定义 (与 CONFIG_YAML.md 保持一致) ---

// LLM
interface LlmEndpointConfig {
  name: string;
  api_key: string;
  base_url?: string;
  models: string[];
  configuration?: Record<string, any>;
}
interface LlmConfigSection {
  endpoints: LlmEndpointConfig[];
}

// Embedding
interface EmbeddingProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
  // 可以根据需要添加其他特定于提供商的字段
  [key: string]: any; // 允许其他属性
}
interface EmbeddingConfigSection {
  providers: Record<string, EmbeddingProviderConfig>;
}

// Rerank
interface RerankProviderConfig {
  baseUrl?: string;
  modelName: string;
  apiKey?: string | null;
  topN: number;
  relevanceThreshold: number;
  // 可以根据需要添加其他特定于提供商的字段
  [key: string]: any; // 允许其他属性
}
interface RerankConfigSection {
  defaultProvider: string;
  providers: Record<string, RerankProviderConfig>;
}

// --- Parser 配置定义 (新增) ---
interface ParserProviderConfig {
  [key: string]: any; // 允许任何特定于提供商的配置
}
interface ParserConfigSection {
  defaultProvider?: string; // 改为可选，因为工厂有默认值
  providers?: Record<string, ParserProviderConfig>;
}

// --- PDF Parser 配置定义 (修改) ---
interface MarkerLocalCliConfig { // 新增 marker_local 的类型定义
  output_format: 'markdown' | 'json' | 'html';
  use_llm?: boolean;
  force_ocr?: boolean;
  languages?: string; // Comma-separated
  llm_service?: string; // e.g., "gemini", "ollama", "openai"
  executable_path?: string;
  extra_cli_args?: string[];
}

interface PdfParserConfig {
  provider: 'mineru' | 'marker' | 'marker_local'; // 增加 'marker_local'
  mineru?: {
    api_key: string;
    api_base?: string;
    is_ocr?: boolean;
    enable_formula?: boolean;
    enable_table?: boolean;
    layout_model?: string;
    language?: string;
    max_polls?: number;
    poll_interval?: number;
    callback?: string;
    seed?: string;
    extra_formats?: string[];
  };
  marker?: { // Marker API 配置 (从 .env 读取，这里只是占位符)
    // api_key, api_url etc. are handled via process.env
  };
  marker_local?: MarkerLocalCliConfig; // 新增 marker_local 配置项
}

// --- Web Search 配置定义 (新增) ---
export interface WebSearchProviderConfig { // <--- 添加 export
  baseUrl?: string;
  requestTimeoutMs?: number;
  // 可以根据需要添加其他特定于提供商的字段
  [key: string]: any; // 允许其他属性
}
interface WebSearchConfigSection {
  defaultProvider: string; // 网络搜索必须指定默认提供商
  providers: Record<string, WebSearchProviderConfig>;
}

// Full Config
interface FullModelsConfig {
  llm?: LlmConfigSection;
  embedding?: EmbeddingConfigSection;
  rerank?: RerankConfigSection;
  parsers?: ParserConfigSection; // 新增 parsers
  pdf_parser?: PdfParserConfig; // 新增 pdf_parser
  web_search?: WebSearchConfigSection; // 新增 web_search
}

let loadedConfig: FullModelsConfig | null = null; // 缓存整个文件内容

// --- 加载器核心函数 ---
function loadModelsConfig(): FullModelsConfig {
  if (loadedConfig) {
    return loadedConfig; // 返回缓存
  }
  try {
    if (!fs.existsSync(MODELS_CONFIG_PATH)) {
      logger.error(`Models config file not found at: ${MODELS_CONFIG_PATH}`);
      loadedConfig = {}; // 缓存空对象，避免重复尝试读取
      return loadedConfig;
    logger.log(`Loading models config from ${MODELS_CONFIG_PATH}...`); // 添加日志
    }
    const fileContents = fs.readFileSync(MODELS_CONFIG_PATH, 'utf8');
    const config = yaml.load(fileContents) as FullModelsConfig;
    if (!config) {
      logger.error(`YAML file is empty or invalid.`); // 添加日志
      throw new Error('YAML file is empty or invalid.');
    }
    loadedConfig = config; // 缓存配置
    logger.log(`Successfully loaded models config from ${MODELS_CONFIG_PATH}`);
    return loadedConfig;
  } catch (error) {
    logger.error(`Failed to load or parse models config from ${MODELS_CONFIG_PATH}: ${error.message}`, error.stack);
    loadedConfig = {}; // 缓存空对象
    return loadedConfig;
  }
}

// --- LLM 配置访问函数 ---
export function findLlmEndpointConfig(modelName: string): LlmEndpointConfig | undefined {
  const config = loadModelsConfig();
  const endpoints = config?.llm?.endpoints; // 安全访问 llm 部分
  if (!endpoints || !Array.isArray(endpoints)) {
    if (Object.keys(config).length > 0) { // 只有在文件加载成功但缺少 llm 部分时才警告
        logger.warn(`'llm.endpoints' section not found or is not an array in ${MODELS_CONFIG_PATH}`);
    }
    return undefined;
  }

  for (const endpoint of endpoints) {
    if (endpoint.models && Array.isArray(endpoint.models) && endpoint.models.includes(modelName)) {
      return endpoint;
    }
  }
  // 不要在此处警告，因为模型可能在其他地方处理或不存在
  // logger.warn(`No LLM endpoint configuration found for model: ${modelName}`);
  return undefined;
}

// --- Embedding 配置访问函数 ---
export function getEmbeddingProviderConfig(providerName: string): EmbeddingProviderConfig | undefined {
  const config = loadModelsConfig();
  const providerConfig = config?.embedding?.providers?.[providerName];
  if (!providerConfig) {
    if (config?.embedding?.providers && Object.keys(config.embedding.providers).length > 0) { // 只有在 providers 存在但缺少特定 provider 时才警告
        logger.warn(`Embedding configuration for provider '${providerName}' not found in ${MODELS_CONFIG_PATH}`);
    } else if (config?.embedding && !config.embedding.providers) {
        logger.warn(`'embedding.providers' section not found in ${MODELS_CONFIG_PATH}`);
    }
  }
  return providerConfig;
}

// --- Rerank 配置访问函数 ---
export function getRerankDefaultProvider(): string | undefined {
    const config = loadModelsConfig();
    const defaultProvider = config?.rerank?.defaultProvider;
    if (!defaultProvider && config?.rerank) { // 只有在 rerank 部分存在但缺少 defaultProvider 时才警告
        logger.warn(`'rerank.defaultProvider' not defined in ${MODELS_CONFIG_PATH}`);
    }
    return defaultProvider;
}

export function getRerankProviderConfig(providerName: string): RerankProviderConfig | undefined {
  const config = loadModelsConfig();
  const providerConfig = config?.rerank?.providers?.[providerName];
   if (!providerConfig) {
    if (config?.rerank?.providers && Object.keys(config.rerank.providers).length > 0) { // 只有在 providers 存在但缺少特定 provider 时才警告
        logger.warn(`Rerank configuration for provider '${providerName}' not found in ${MODELS_CONFIG_PATH}`);
    } else if (config?.rerank && !config.rerank.providers) {
        logger.warn(`'rerank.providers' section not found in ${MODELS_CONFIG_PATH}`);
    }
  }
  return providerConfig;
}

// --- Parser 配置访问函数 (新增) ---
export function getParserDefaultProvider(): string | undefined {
    const config = loadModelsConfig();
    // 注意：这里不提供默认值 'jina'，让调用方处理默认逻辑
    const defaultProvider = config?.parsers?.defaultProvider;
     if (!defaultProvider && config?.parsers) {
        logger.warn(`'parsers.defaultProvider' not defined in ${MODELS_CONFIG_PATH}`);
    }
    return defaultProvider;
}

export function getParserProviderConfig(providerName: string): ParserProviderConfig | undefined {
  const config = loadModelsConfig();
  const providerConfig = config?.parsers?.providers?.[providerName];
   if (!providerConfig) {
     if (config?.parsers?.providers && Object.keys(config.parsers.providers).length > 0) {
         logger.warn(`Parser configuration for provider '${providerName}' not found in ${MODELS_CONFIG_PATH}`);
     } else if (config?.parsers && !config.parsers.providers) {
         logger.warn(`'parsers.providers' section not found in ${MODELS_CONFIG_PATH}`);
     }
   }
  return providerConfig;
}

// --- PDF Parser 配置访问函数 (新增) ---
export function getPdfParserConfig(): PdfParserConfig | undefined {
  const config = loadModelsConfig();
  const pdfParserConfig = config?.pdf_parser;
  if (!pdfParserConfig) {
    logger.warn(`'pdf_parser' section not found in ${MODELS_CONFIG_PATH}`);
  }
  logger.debug(`Loaded pdf_parser config: ${JSON.stringify(pdfParserConfig, null, 2)}`); // 添加日志
  return pdfParserConfig;
}

// --- Web Search 配置访问函数 (新增) ---
export function getWebSearchDefaultProvider(): string | undefined {
    const config = loadModelsConfig();
    const defaultProvider = config?.web_search?.defaultProvider;
    if (!defaultProvider && config?.web_search) { // 只有在 web_search 部分存在但缺少 defaultProvider 时才警告
        logger.warn(`'web_search.defaultProvider' not defined in ${MODELS_CONFIG_PATH}`);
    }
    return defaultProvider;
}

export function getWebSearchProviderConfig(providerName: string): WebSearchProviderConfig | undefined {
  const config = loadModelsConfig();
  // 注意：这里我们只查找在 providers 中明确定义的配置
  const providerConfig = config?.web_search?.providers?.[providerName];
   if (!providerConfig && providerName !== 'serper') { // 如果不是 serper 且在 providers 中找不到，则警告
     if (config?.web_search?.providers && Object.keys(config.web_search.providers).length > 0) {
         logger.warn(`Web Search configuration for provider '${providerName}' not found in ${MODELS_CONFIG_PATH}`);
     } else if (config?.web_search && !config.web_search.providers) {
         logger.warn(`'web_search.providers' section not found in ${MODELS_CONFIG_PATH}`);
     }
   }
  // 对于 serper，我们预期这里返回 undefined，因为它的配置来自 .env
  return providerConfig;
}


// --- 清除缓存 (主要用于测试) ---
export function clearConfigCache(): void {
    loadedConfig = null;
    logger.log('Cleared YAML config cache.');
}
