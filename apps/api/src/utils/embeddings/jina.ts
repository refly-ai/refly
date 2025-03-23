import { Embeddings } from '@langchain/core/embeddings';
import { Logger } from '@nestjs/common';

export interface JinaEmbeddingsConfig {
  modelName: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
  ollamaBaseUrl?: string;
  timeoutMs?: number;
}

const defaultConfig: Partial<JinaEmbeddingsConfig> = {
  modelName: 'jina-embeddings-v3',
  batchSize: 512,
  maxRetries: 3,
  dimensions: 1024,
  ollamaBaseUrl: 'http://192.168.3.3:11434',
  timeoutMs: 10000,
};

export class JinaEmbeddings extends Embeddings {
  private config: JinaEmbeddingsConfig;
  private readonly logger = new Logger(JinaEmbeddings.name);

  constructor(config: JinaEmbeddingsConfig) {
    super(config);
    this.config = { ...defaultConfig, ...config };
    this.logger.log(`初始化 JinaEmbeddings 使用 Ollama 模型: ${this.resolveOllamaModel(this.config.modelName)}`);
    this.logger.log(`预期向量维度: ${this.config.dimensions}`);
  }

  private async fetch(input: string[]) {
    const ollamaModel = this.resolveOllamaModel(this.config.modelName);
    const payload = {
      model: ollamaModel,
      input: input,
    };
    
    this.logger.debug(`调用 Ollama 嵌入 API，模型: ${ollamaModel}, 输入长度: ${input.length}`);
    
    let retries = 0;
    let lastError: Error | null = null;
    
    const baseWaitMs = 1000;
    
    while (retries <= this.config.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        
        try {
          const response = await fetch(`${this.config.ollamaBaseUrl}/api/embed`, {
            method: 'post',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.status !== 200) {
            const errorText = await response.text();
            const errorMessage = `调用 Ollama 嵌入 API 失败: ${response.status} ${response.statusText} ${errorText}`;
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
          }
          
          const data = await response.json() as { embeddings?: number[][] };
          
          if (!data.embeddings || !Array.isArray(data.embeddings)) {
            const errorMessage = '无效的 Ollama 响应格式: embeddings 字段缺失或不是数组';
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
          }
          
          if (data.embeddings.length > 0) {
            const actualDimensions = data.embeddings[0].length;
            if (actualDimensions !== this.config.dimensions) {
              const warningMessage = `维度不匹配! 配置期望: ${this.config.dimensions}, 实际: ${actualDimensions}`;
              this.logger.warn(warningMessage);
              throw new Error(warningMessage);
            }
          }
          
          return {
            data: data.embeddings.map((emb: number[]) => ({ embedding: emb }))
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error as Error;
        
        if ((error as Error).name === 'AbortError') {
          this.logger.warn(`Ollama API 请求超时(${this.config.timeoutMs}ms), 重试 ${retries}/${this.config.maxRetries}`);
        } else {
          this.logger.warn(`Ollama API 请求失败: ${(error as Error).message}, 重试 ${retries}/${this.config.maxRetries}`);
        }
        
        if (retries >= this.config.maxRetries) {
          this.logger.error(`达到最大重试次数(${this.config.maxRetries})，放弃请求`);
          break;
        }
        
        const waitTime = baseWaitMs * Math.pow(2, retries);
        this.logger.debug(`等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        retries++;
      }
    }
    
    throw lastError || new Error('未知错误导致嵌入请求失败');
  }

  private resolveOllamaModel(jinaModelName: string): string {
    const modelMapping: Record<string, string> = {
      'jina-embeddings-v3': 'snowflake-arctic-embed2:latest',
      'jina-embeddings-v2-base-en': 'snowflake-arctic-embed2:latest',
    };
    
    return modelMapping[jinaModelName] || 'snowflake-arctic-embed2:latest';
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    try {
      const body = await this.fetch(documents);
      return body.data.map((point: { embedding: number[] }) => point.embedding);
    } catch (error) {
      this.logger.error(`嵌入文档时出错: ${(error as Error).message}`);
      throw error;
    }
  }

  async embedQuery(query: string): Promise<number[]> {
    try {
      const body = await this.fetch([query]);
      if (body.data.length === 0) {
        throw new Error('没有返回嵌入向量');
      }
      return body.data[0].embedding;
    } catch (error) {
      this.logger.error(`嵌入查询时出错: ${(error as Error).message}`);
      throw error;
    }
  }
}
