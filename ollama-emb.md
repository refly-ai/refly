# Ollama 嵌入模型集成文档

## 概述

本文档详细记录了在 Refly 项目中将 Ollama 作为嵌入向量模型提供方的集成过程。通过这次修改，我们可以使用本地部署的 Ollama 服务生成嵌入向量，不再依赖第三方 API 服务，提高了系统的灵活性和可用性。

## 背景

在原始设计中，Refly 使用以下嵌入模型提供商：
- Jina AI API
- OpenAI API
- Fireworks API

这些服务都需要通过网络调用外部 API，并需要相应的 API 密钥。通过集成 Ollama，我们可以在本地或内部网络中部署嵌入模型服务，降低依赖性和成本。

## 主要修改内容

### 1. 核心文件: jina.ts

这是本次修改的核心文件，我们对 `JinaEmbeddings` 类进行了修改，使其支持调用 Ollama API。

```typescript
import { Embeddings } from '@langchain/core/embeddings';
import { Logger } from '@nestjs/common';

export interface JinaEmbeddingsConfig {
  modelName: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
  ollamaBaseUrl?: string;
}

const defaultConfig: Partial<JinaEmbeddingsConfig> = {
  modelName: 'jina-embeddings-v3',
  batchSize: 512,
  maxRetries: 3,
  dimensions: 1024,
  ollamaBaseUrl: 'http://192.168.3.12:11434',
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
    
    const response = await fetch(`${this.config.ollamaBaseUrl}/api/embed`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
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
    
    // 验证维度
    if (data.embeddings.length > 0) {
      const actualDimensions = data.embeddings[0].length;
      if (actualDimensions !== this.config.dimensions) {
        const warningMessage = `维度不匹配! 配置期望: ${this.config.dimensions}, 实际: ${actualDimensions}`;
        this.logger.warn(warningMessage);
        // 抛出错误以防止不匹配的向量继续处理
        throw new Error(warningMessage);
      }
    }
    
    return {
      data: data.embeddings.map((emb: number[]) => ({ embedding: emb }))
    };
  }

  private resolveOllamaModel(jinaModelName: string): string {
    const modelMapping: Record<string, string> = {
      'jina-embeddings-v3': 'snowflake-arctic-embed:latest',
      'jina-embeddings-v2-base-en': 'snowflake-arctic-embed:latest',
    };
    
    return modelMapping[jinaModelName] || 'snowflake-arctic-embed:latest';
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    try {
      const body = await this.fetch(documents);
      return body.data.map((point: { embedding: number[] }) => point.embedding);
    } catch (error) {
      this.logger.error(`嵌入文档时出错: ${error.message}`);
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
      this.logger.error(`嵌入查询时出错: ${error.message}`);
      throw error;
    }
  }
}
```

**代码讲解**：

1. **配置接口扩展**：
   - 在 `JinaEmbeddingsConfig` 接口中添加了 `ollamaBaseUrl` 可选参数，用于指定 Ollama 服务的地址
   - 默认配置 `defaultConfig` 中设置了 Ollama 服务的默认地址为 `http://192.168.3.12:11434`

2. **模型映射功能**：
   - 添加了 `resolveOllamaModel` 方法，负责将 Jina 模型名称映射到对应的 Ollama 模型
   - 目前支持将 `jina-embeddings-v3` 和 `jina-embeddings-v2-base-en` 映射到 `snowflake-arctic-embed:latest`
   - 对于未知的模型名称，默认使用 `snowflake-arctic-embed:latest`

3. **API 调用实现**：
   - `fetch` 方法通过 `fetch API` 向 Ollama 服务发送请求，路径为 `/api/embed`
   - 请求体包含 `model` 和 `input` 两个参数，分别指定模型名称和要嵌入的文本
   - 添加了完善的错误处理，包括 HTTP 错误和响应格式错误

4. **维度验证**：
   - 添加了向量维度验证机制，确保返回的嵌入向量维度与配置中指定的维度一致
   - 如果维度不匹配，会抛出错误，防止使用不正确的向量进行后续处理

5. **公共接口**：
   - `embedDocuments` 和 `embedQuery` 方法保持不变，符合 `Embeddings` 基类的接口要求
   - 这样可以保证与现有代码的兼容性，无需修改调用这些方法的代码

### 2. RAG 服务集成: rag.service.ts

在 `RAGService` 类中，我们无需修改现有代码即可支持 Ollama 嵌入服务，因为我们修改了 `JinaEmbeddings` 的内部实现，保持了接口不变：

```typescript
@Injectable()
export class RAGService {
  private embeddings: Embeddings;
  private splitter: RecursiveCharacterTextSplitter;
  private cache: LRUCache<string, ReaderResult>; // url -> reader result
  private logger = new Logger(RAGService.name);

  constructor(
    private config: ConfigService,
    private qdrant: QdrantService,
  ) {
    const provider = this.config.get('embeddings.provider');
    if (provider === 'fireworks') {
      this.embeddings = new FireworksEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        maxRetries: 3,
      });
    } else if (provider === 'jina') {
      this.embeddings = new JinaEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        dimensions: this.config.getOrThrow('embeddings.dimensions'),
        apiKey: this.config.getOrThrow('credentials.jina'),
        maxRetries: 3,
      });
    } else if (provider === 'openai') {
      this.embeddings = new OpenAIEmbeddings({
        modelName: this.config.getOrThrow('embeddings.modelName'),
        batchSize: this.config.getOrThrow('embeddings.batchSize'),
        dimensions: this.config.getOrThrow('embeddings.dimensions'),
        timeout: 5000,
        maxRetries: 3,
      });
    } else {
      throw new Error(`Unsupported embeddings provider: ${provider}`);
    }

    this.splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
      chunkSize: 1000,
      chunkOverlap: 0,
    });
    this.cache = new LRUCache({ max: 1000 });
  }

  // ... 其他方法
}
```

**无缝集成**：

1. **提供商选择**：
   - 构造函数中基于配置的 `embeddings.provider` 选择嵌入服务实现
   - 当提供商为 `jina` 时，实例化修改后的 `JinaEmbeddings` 类，内部使用 Ollama API
   
2. **配置传递**：
   - 从应用配置中获取必要参数，如 `modelName`、`batchSize` 和 `dimensions`
   - 这些参数会传递给 `JinaEmbeddings` 构造函数

3. **功能使用**：
   - 在 `inMemorySearchWithIndexing`、`indexDocument` 等方法中，通过 `this.embeddings` 接口使用嵌入功能
   - 例如，`retrieve` 方法使用 `this.embeddings.embedQuery(param.query)` 生成查询向量

4. **实际应用**：
   - 在文档索引时，`JinaEmbeddings` 将自动使用 Ollama 生成文档块的嵌入向量
   - 在检索时，查询同样通过 Ollama 嵌入为向量，然后在 QDrant 中执行相似性搜索

### 3. 新的 Dockerfile: Dockerfile.new

为了支持新的嵌入功能，我们创建了新的 Dockerfile：

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache curl gcompat openssl python3 make g++ git py3-setuptools

# 安装 pandoc 基于架构
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "amd64" ]; then \
        wget https://github.com/jgm/pandoc/releases/download/3.6.3/pandoc-3.6.3-linux-amd64.tar.gz \
        && tar xvzf pandoc-3.6.3-linux-amd64.tar.gz --strip-components 1 -C /usr/local/ \
        && rm pandoc-3.6.3-linux-amd64.tar.gz; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        wget https://github.com/jgm/pandoc/releases/download/3.6.3/pandoc-3.6.3-linux-arm64.tar.gz \
        && tar xvzf pandoc-3.6.3-linux-arm64.tar.gz --strip-components 1 -C /usr/local/ \
        && rm pandoc-3.6.3-linux-arm64.tar.gz; \
    fi

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@8.15.8

# 直接复制整个项目（除了 node_modules，已在 .dockerignore 中排除）
COPY . .
# 安装依赖
ENV PYTHON=/usr/bin/python3
RUN pnpm install

# 生成 Prisma 客户端
RUN cd apps/api && pnpm prisma generate

# 强制清理构建缓存
RUN rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo apps/*/dist apps/*/tsconfig.tsbuildinfo

# 按顺序构建所有依赖包
RUN pnpm build --filter=@refly/errors
RUN pnpm build --filter=@refly/i18n
RUN pnpm build --filter=@refly/common-types
RUN pnpm build --filter=@refly/openapi-schema
RUN pnpm build --filter=@refly/utils
RUN pnpm build --filter=@refly/skill-template

# 最后构建 API
RUN pnpm build --filter=@refly/api

# 运行阶段
FROM node:20-alpine

# 安装运行时依赖
RUN apk add --no-cache curl gcompat openssl

# 设置工作目录 - 与原始 Dockerfile 完全一致
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@8.15.8

# 直接从构建阶段复制整个工程目录，包括 node_modules
COPY --from=builder /app/ .

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口 - 与原始 Dockerfile 保持一致
EXPOSE 3000

# 启动命令 - 与原始 Dockerfile 完全一致
CMD ["node", "apps/api/dist/main.js"] 
```

**Dockerfile 讲解**：

1. **多阶段构建**：
   - 使用多阶段构建减小最终镜像大小
   - 第一阶段（builder）安装所有构建依赖并编译代码
   - 第二阶段只包含运行时必要的文件

2. **架构适配**：
   - 基于目标架构（AMD64 或 ARM64）安装不同版本的 pandoc
   - 这使得镜像可以在不同的硬件平台上构建和运行

3. **依赖管理**：
   - 使用 pnpm 管理依赖，提高安装速度和减少磁盘占用
   - 按照依赖顺序逐个构建包，确保正确的构建顺序

4. **优化策略**：
   - 清理构建缓存，减少镜像大小
   - 使用 Alpine Linux 作为基础镜像，进一步减小体积

### 4. Docker Compose 配置

在 `docker-compose.yml` 中，已经添加了 `extra_hosts` 配置，允许容器访问宿主机上运行的 Ollama 服务：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**配置讲解**：
- 这个配置将 `host.docker.internal` 映射到宿主机的 IP 地址
- 容器内的应用可以通过访问 `http://host.docker.internal:11434` 来连接宿主机上运行的 Ollama 服务
- 这是在容器化环境中使用宿主机服务的标准做法，避免了硬编码 IP 地址

### 5. 环境变量配置

环境变量保持不变，与原有配置兼容：

```
# Embeddings provider (options: jina, openai, fireworks)
EMBEDDINGS_PROVIDER=jina

# Name of the embeddings model to use
EMBEDDINGS_MODEL_NAME=jina-embeddings-v3

# Embeddings Configuration
EMBEDDINGS_DIMENSIONS=1024
EMBEDDINGS_BATCH_SIZE=512
```

**配置讲解**：
- 保持与原有配置相同的环境变量名称，确保兼容性
- `EMBEDDINGS_PROVIDER` 仍然使用 `jina`，但内部实现更改为 Ollama
- `EMBEDDINGS_DIMENSIONS` 设置为 1024，与 snowflake-arctic-embed 模型的输出维度匹配
- `EMBEDDINGS_BATCH_SIZE` 控制批处理大小，可根据性能需求调整

## 使用方法

### 前提条件

1. 安装 Ollama
   ```bash
   # Linux/macOS
   curl -fsSL https://ollama.com/install.sh | sh
   
   # 或下载 Windows 安装包：https://ollama.com/download/windows
   ```

2. 拉取嵌入模型
   ```bash
   ollama pull snowflake-arctic-embed:latest
   ```

### Docker 环境配置

#### 方法 1: 使用宿主机的 Ollama 服务（推荐）

1. 在宿主机上运行 Ollama 服务
2. 确保 `docker-compose.yml` 中包含以下配置：
   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```
3. 修改 `JinaEmbeddings` 类中的默认配置：
   ```typescript
   ollamaBaseUrl: 'http://host.docker.internal:11434'
   ```

#### 方法 2: 将 Ollama 添加为 Docker 服务

可以在 `docker-compose.middleware.yml` 中添加：

```yaml
ollama:
  container_name: refly_ollama
  image: ollama/ollama:latest
  ports:
    - 11434:11434
  volumes:
    - ollama_data:/root/.ollama
  restart: always
  healthcheck:
    test: ["CMD-SHELL", "curl -s http://localhost:11434/api/health || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 15s

volumes:
  ollama_data:
```

然后修改 `JinaEmbeddings` 类中的默认配置：
```typescript
ollamaBaseUrl: 'http://ollama:11434'
```

### 自定义模型与配置

如需使用不同的 Ollama 模型，可以修改 `resolveOllamaModel` 方法中的映射：

```typescript
private resolveOllamaModel(jinaModelName: string): string {
  const modelMapping: Record<string, string> = {
    'jina-embeddings-v3': 'snowflake-arctic-embed:latest',
    'jina-embeddings-v2-base-en': 'snowflake-arctic-embed:latest',
    // 添加更多映射
    'jina-embeddings-v2-small-en': 'nomic-embed-text:latest',
  };
  
  return modelMapping[jinaModelName] || 'snowflake-arctic-embed:latest';
}
```

## 注意事项与故障排除

### 常见问题

1. **连接错误**
   
   症状: `调用 Ollama 嵌入 API 失败: 500 Internal Server Error`
   
   解决方案:
   - 确认 Ollama 服务正在运行
   - 验证 `ollamaBaseUrl` 配置是否正确
   - 检查网络连接和防火墙设置

2. **模型未找到**
   
   症状: `调用 Ollama 嵌入 API 失败: 404 Not Found model [model-name] not found`
   
   解决方案:
   - 确保已拉取相应的模型: `ollama pull snowflake-arctic-embed:latest`
   - 检查 `resolveOllamaModel` 方法中的模型映射是否正确

3. **维度不匹配**
   
   症状: `维度不匹配! 配置期望: 1024, 实际: 768`
   
   解决方案:
   - 调整 `EMBEDDINGS_DIMENSIONS` 环境变量以匹配模型的实际输出维度
   - 或者选择一个生成匹配维度向量的不同模型

### 性能注意事项

- Ollama 的性能取决于主机硬件配置，尤其是 CPU/GPU 性能
- 对于生产环境，建议使用 GPU 加速（如果可用）
- 可以通过调整 `batchSize` 参数平衡内存使用和处理速度

## 维度匹配问题排查与解决

### 问题描述

在集成Ollama嵌入模型过程中，可能会遇到维度不匹配导致的"Bad Request"错误：

```
Error: Bad Request
    at Object.fun [as upsertPoints] (/app/node_modules/.pnpm/@qdrant+openapi-typescript-fetch@1.2.6/node_modules/@qdrant/openapi-typescript-fetch/dist/cjs/fetcher.js:172:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async QdrantClient.upsert (/app/node_modules/.pnpm/@qdrant+js-client-rest@1.11.0_typescript@5.3.3/node_modules/@qdrant/js-client-rest/dist/cjs/qdrant-client.js:539:26)
    at async RAGService.indexDocument (/app/apps/api/dist/rag/rag.service.js:268:13)
    at async KnowledgeService.createDocument (/app/apps/api/dist/knowledge/knowledge.service.js:675:30)
    at async KnowledgeController.createDocument (/app/apps/api/dist/knowledge/knowledge.controller.js:104:26)
```

这个错误通常发生在嵌入向量维度（如1024）与Qdrant集合期望的维度（如768）不匹配时。

### 维度配置分析

经过排查，维度配置有两处关键设置：

1. **嵌入维度配置**：
   ```typescript
   // apps/api/src/config/app.config.ts
   embeddings: {
     provider: process.env.EMBEDDINGS_PROVIDER || 'jina',
     modelName: process.env.EMBEDDINGS_MODEL_NAME || 'jina-embeddings-v3',
     dimensions: Number.parseInt(process.env.EMBEDDINGS_DIMENSIONS) || 768, // 默认值需修改为1024
     batchSize: Number.parseInt(process.env.EMBEDDINGS_BATCH_SIZE) || 512,
   },
   ```

2. **向量存储维度配置**：
   ```typescript
   // apps/api/src/config/app.config.ts
   vectorStore: {
     host: process.env.QDRANT_HOST || 'localhost',
     port: Number.parseInt(process.env.QDRANT_PORT) || 6333,
     apiKey: process.env.QDRANT_API_KEY,
     vectorDim: Number.parseInt(process.env.REFLY_VEC_DIM) || 768, // 默认值需修改为1024
   },
   ```

3. **环境变量配置**：
   ```
   # deploy/docker/.env 和 apps/api/.env.example
   EMBEDDINGS_DIMENSIONS=1024
   REFLY_VEC_DIM=1024
   ```

### Qdrant集合创建逻辑

Qdrant集合在系统初始化时创建，关键代码在`QdrantService`的`initializeCollection`方法中：

```typescript
// apps/api/src/common/qdrant.service.ts
async initializeCollection() {
  const { exists } = await this.client.collectionExists(this.collectionName);

  if (!exists) {
    const res = await this.client.createCollection(this.collectionName, {
      vectors: {
        size: this.configService.getOrThrow<number>('embeddings.dimensions'), // 使用的是embeddings.dimensions
        distance: 'Cosine',
        on_disk: true,
      },
      hnsw_config: { payload_m: 16, m: 0, on_disk: true },
      on_disk_payload: true,
    });
    this.logger.log(`collection create success: ${res}`);
  } else {
    this.logger.log(`collection already exists: ${this.collectionName}`);
  }
  // ...
}
```

**重要发现**：Qdrant集合创建时使用的是`embeddings.dimensions`配置，而非`vectorStore.vectorDim`。

### 解决方案

要解决维度不匹配问题，需要执行以下步骤：

1. **更新配置文件**：
   - 将`app.config.ts`中`embeddings.dimensions`的默认值从768改为1024
   - 将`app.config.ts`中`vectorStore.vectorDim`的默认值从768改为1024（保持一致性）
   - 确保`.env`和`.env.example`文件中的对应值也设为1024

2. **删除并重新创建Qdrant集合**：
   由于Qdrant集合在创建后维度无法修改，需要删除并重新创建：
   
   ```bash
   # 使用Qdrant REST API删除集合
   curl -X DELETE "http://<QDRANT_HOST>:<QDRANT_PORT>/collections/refly_vectors"
   ```

   或使用以下Node.js脚本：

   ```javascript
   // reset-qdrant-collection.js
   const axios = require('axios');
   require('dotenv').config();

   const COLLECTION_NAME = 'refly_vectors';
   const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
   const QDRANT_PORT = process.env.QDRANT_PORT || '6333';
   const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
   const QDRANT_BASE_URL = `http://${QDRANT_HOST}:${QDRANT_PORT}`;

   async function deleteCollection() {
     try {
       console.log(`正在删除Qdrant集合: ${COLLECTION_NAME}...`);
       const response = await axios.delete(`${QDRANT_BASE_URL}/collections/${COLLECTION_NAME}`, {
         headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}
       });
       
       if (response.status === 200) {
         console.log(`✓ 集合 ${COLLECTION_NAME} 已成功删除`);
         return true;
       }
       return false;
     } catch (error) {
       console.error(`删除集合失败: ${error.message}`);
       return false;
     }
   }

   deleteCollection().catch(error => {
     console.error(`发生错误: ${error.message}`);
   });
   ```

3. **重启应用程序**：
   重启后，应用程序会使用新的维度设置(1024)创建集合。

4. **重新索引数据**：
   由于删除了整个集合，需要重新索引所有文档。

### 为什么需要删除整个集合？

维度是Qdrant集合的基本结构参数，在集合创建时就固定下来了：

- 只删除数据不会改变集合结构
- Qdrant不支持直接修改现有集合的向量维度
- 要更改维度，必须删除并重新创建整个集合

### 验证步骤

1. 确认所有配置文件中的维度都已更改为1024
2. 删除Qdrant集合"refly_vectors"
3. 重启应用程序，查看日志确认集合创建成功
4. 尝试索引文档，验证不再出现维度不匹配错误

通过以上步骤，可以确保jina.ts生成的1024维嵌入向量与Qdrant集合配置的维度相匹配，解决"Bad Request"问题。

## 总结

通过这次修改，我们实现了 Ollama 本地嵌入服务的集成，不仅保持了与原有代码的兼容性，还增加了系统的灵活性和可用性。这种方式允许在不依赖外部 API 的情况下生成高质量的嵌入向量，为后续扩展和优化奠定了基础。

未来可以考虑的改进方向：
- 支持更多 Ollama 模型
- 添加自定义提示模板
- 提供更灵活的配置选项
- 实现更高级的错误处理和重试机制 