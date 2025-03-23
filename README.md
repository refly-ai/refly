![refly-cover](https://github.com/user-attachments/assets/2930c555-09a7-4ea2-a18a-2b1d8a7ef4ae)

<div align="center">

<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.refly.ai">Refly.AI</a><br>
    </b>
    ⭐️  The AI Native Creation Engine ⭐️ <br>
</h1>

Refly是一个开源的AI原生创作引擎，由13+领先AI模型驱动。我们对原项目进行了本地化改进，使嵌入向量生成、排序模型和网页解析都能在本地完成，极大降低了部署成本和复杂度。其直观的自由形式画布界面集成了多线程对话、多模态输入（文本/图片/文件）、RAG检索、浏览器扩展网页剪藏、上下文记忆、AI文档编辑、代码生成（HTML/SVG/Mermaid/React）和网站可视化引擎，赋能您轻松将想法转化为完整作品。

[🚀 v0.4.2 发布! 现已支持画布模板和文档表格⚡️](https://docs.refly.ai/changelog/v0.4.2)

[Refly Cloud](https://refly.ai/) · [自托管部署](https://docs.refly.ai/guide/self-deploy) · [论坛](https://github.com/refly-ai/refly/discussions) · [Discord](https://discord.gg/bWjffrb89h) · [Twitter](https://x.com/reflyai) · [文档](https://docs.refly.ai/)

<p align="center">
    <a href="https://refly.ai" target="_blank">
        <img alt="Static Badge" src="https://img.shields.io/badge/Product-F04438"></a>
    <a href="https://refly.ai/pricing" target="_blank">
        <img alt="Static Badge" src="https://img.shields.io/badge/free-pricing?logo=free&color=%20%23155EEF&label=pricing&labelColor=%20%23528bff"></a>
    <a href="https://discord.gg/bWjffrb89h" target="_blank">
        <img alt="Discord Chat" src="https://img.shields.io/discord/1323513432686989362?label=chat&logo=discord&logoColor=white&style=flat&color=5865F2"></a>
    <a href="https://x.com/reflyai" target="_blank">
        <img alt="Static Badge" src="https://img.shields.io/twitter/follow/reflyai"></a>
    <a href="https://www.typescriptlang.org/" target="_blank">
        <img alt="TypeScript-version-icon" src="https://img.shields.io/badge/TypeScript-^5.3.3-blue"></a>
</p>

<p align="center">
  <a href="./README.md"><img alt="README in English" src="https://img.shields.io/badge/English-d9d9d9"></a>
  <a href="./README_CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-d9d9d9"></a>
</p>

</div>

## 🔥 本地化改进核心亮点

我们对Refly进行了三项关键本地化改进，极大降低了部署成本，提高了数据安全性：

### 1️⃣ 高精度嵌入向量本地生成 (1024维)

- **替换外部API**：不再依赖Jina/OpenAI/Fireworks等第三方嵌入API
- **降低成本**：无需支付API调用费用
- **改进文件**：`apps/api/src/providers/embeddings/jina.ts`
- **改进内容**：实现本地嵌入服务调用，支持1024维高精度向量
- **技术亮点**：维度匹配验证、批处理优化、错误恢复机制

### 2️⃣ 本地化排序模型

- **替换外部重排API**：从依赖外部重排API转为本地服务
- **模型升级**：使用`bge-reranker-v2-m3`模型进行高精度排序
- **改进文件**：`apps/api/src/rag/rag.service.ts`
- **改进内容**：实现本地xinference服务调用，优化排序策略
- **技术亮点**：基于向量相似度的混合排序，降级容错机制

### 3️⃣ 本地化网页解析

- **替换外部解析API**：从依赖外部解析服务转为本地实现
- **双重备份策略**：Python/Trafilatura主解析 + Node.js/Cheerio备选解析
- **改进文件**：`apps/api/src/knowledge/parsers/jina.parser.ts`
- **改进内容**：实现本地网页抓取、解析和内容提取
- **技术亮点**：多策略内容选择器，智能噪声过滤，元数据提取

## 快速开始

> 在安装ReflyAI之前，请确保您的机器满足以下最低系统要求：
>
> CPU >= 2核
>
> 内存 >= 4GB

### 使用Docker自托管部署

借助本地化改进，您可以部署功能丰富且完全本地化的ReflyAI版本，无需依赖昂贵的第三方API。我们的团队正在努力跟进最新版本。

#### 部署步骤

1. 克隆代码库并进入部署目录
```bash
git clone https://github.com/refly-ai/refly.git
cd refly/deploy/docker
```

2. 复制并修改环境配置文件
```bash
cp ../../apps/api/.env.example .env
```

3. 修改配置文件中的向量嵌入设置
```bash
# 打开.env文件并设置以下参数
EMBEDDINGS_PROVIDER=jina
EMBEDDINGS_MODEL_NAME=jina-embeddings-v3
EMBEDDINGS_DIMENSIONS=1024  # 必须在初始化前设置
EMBEDDINGS_BATCH_SIZE=512
REFLY_VEC_DIM=1024          # 必须与EMBEDDINGS_DIMENSIONS一致
```

4. 使用优化的Dockerfile构建镜像
```bash
# 使用优化的Dockerfile.new替代默认Dockerfile
cp ../Dockerfile.new ../Dockerfile
docker compose build
```

5. 启动服务
```bash
docker compose up -d
```

有关后续步骤，请访问[自托管部署指南](https://docs.refly.ai/guide/self-deploy)了解更多详情。

## ✨ 关键特性

### 多线程对话系统
建立在创新的多线程架构上，实现并行管理独立对话上下文。通过高效的状态管理和上下文切换机制实现复杂的Agent工作流，超越传统对话模型的限制。

### 多模型集成框架（本地化增强）
- 集成13+领先语言模型，包括DeepSeek R1、Claude 3.5 Sonnet、Gemini 2.0和O3-mini
- **新增：支持本地化嵌入模型，无需外部API密钥**
- **新增：降低部署成本，提高可靠性和隐私性**
- 支持模型混合调度和并行处理

### 知识库引擎（本地化增强）
- 支持多源异构数据导入
- **新增：本地化RAG语义检索架构，1024维嵌入向量**
- **新增：无需依赖第三方嵌入服务，降低运营成本**
- 智能知识图谱构建

### 智能内容捕获（本地化增强）
- 主流平台（Github、Medium、Wikipedia、Arxiv）一键内容捕获
- **新增：本地化网页解析和内容提取**
- 智能内容解析和结构化
- 深度知识库集成

## 📝 技术实现详解

### 1. 嵌入向量模型集成

我们通过修改`JinaEmbeddings`类实现了本地嵌入向量集成：

```typescript
// apps/api/src/providers/embeddings/jina.ts
export class JinaEmbeddings extends Embeddings {
  private config: JinaEmbeddingsConfig;
  private readonly logger = new Logger(JinaEmbeddings.name);

  constructor(config: JinaEmbeddingsConfig) {
    super(config);
    this.config = { ...defaultConfig, ...config };
    this.logger.log(`初始化本地嵌入模型服务，维度: ${this.config.dimensions}`);
  }

  private async fetch(input: string[]) {
    // 调用本地嵌入服务API
    const response = await fetch(`${this.config.serverBaseUrl}/api/embed`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: input }),
    });
    
    // 验证维度一致性
    if (data.embeddings.length > 0) {
      const actualDimensions = data.embeddings[0].length;
      if (actualDimensions !== this.config.dimensions) {
        throw new Error(`维度不匹配! 配置期望: ${this.config.dimensions}, 实际: ${actualDimensions}`);
      }
    }
    
    return {
      data: data.embeddings.map((emb: number[]) => ({ embedding: emb }))
    };
  }
}
```

**⚠️ 重要配置**：必须在项目初始化前在.env文件中设置正确的维度参数
```
EMBEDDINGS_DIMENSIONS=1024
REFLY_VEC_DIM=1024  # 必须与EMBEDDINGS_DIMENSIONS保持一致
```

### 2. 排序模型本地化

排序模型使用了硬编码的本地服务地址：

```typescript
// apps/api/src/rag/rag.service.ts
async rerank(query: string, results: SearchResult[]) {
  // 准备xinference请求负载
  const payload = JSON.stringify({
    model: 'bge-reranker-v2-m3', // 使用指定的模型
    query: query,
    documents: Array.from(contentMap.keys()),
  });

  // 调用xinference的rerank API - 硬编码地址需要修改
  const res = await fetch('http://192.168.3.12:9997/v1/rerank', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  
  // 错误处理及结果处理...
}
```

**修改提示**：如需更改排序服务地址，直接修改代码中的URL。建议将此URL改为环境变量配置。

### 3. 网页解析本地化

我们实现了双重备份的网页解析策略：

```typescript
// apps/api/src/knowledge/parsers/jina.parser.ts
async parse(input: string | Buffer): Promise<ParseResult> {
  const url = input.toString();

  try {
    // 优先使用Python/Trafilatura解析（高质量结果）
    const isPythonReady = await this.ensureTrafilaturaScript();
    
    if (isPythonReady) {
      // 使用Python脚本处理
      const process = spawn(this.pythonCommand, [this.pythonScriptPath, url]);
      // 处理输出...
    } else {
      // 备选方案：使用Node.js解析
      return this.parseWithNode(url);
    }
  } catch (error) {
    // 兜底：所有方法失败后使用Node.js备选方案
    return this.parseWithNode(url);
  }
}

// Node.js备选解析实现
async parseWithNode(url: string): Promise<ParseResult> {
  // 使用axios获取网页内容
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    },
  });
  
  const html = response.data;
  const $ = cheerio.load(html);
  
  // 智能内容提取算法
  // 尝试多种选择器策略提取高质量内容...
}
```

**功能亮点**：
- 自动降级：从Python到Node.js的无缝切换
- 多策略选择器：确保内容提取成功率
- 智能噪音过滤：自动清理导航栏、广告等

## 🛣️ 路线图与贡献指南

我们不断改进Refly，添加令人兴奋的新功能。有关详细路线图，请访问[完整路线图文档](https://docs.refly.ai/roadmap)。欢迎所有开发者参与贡献，请查看我们的[CONTRIBUTING.md](./CONTRIBUTING.md)。

## 上游项目

我们感谢以下使ReflyAI成为可能的开源项目：

1. [LangChain](https://github.com/langchain-ai/langchainjs) - 用于构建AI应用程序的库
2. [ReactFlow](https://github.com/xyflow/xyflow) - 用于构建可视化工作流的库
3. [QDrant](https://github.com/qdrant/qdrant) - 用于构建向量搜索功能的库
4. 其他上游依赖项

## 许可证

本仓库根据[ReflyAI开源许可证](./LICENSE)授权，本质上是Apache 2.0许可证加上一些额外限制。

## 📱 联系作者

如果您对本项目有任何问题或建议，欢迎通过以下方式联系作者：

<div align="center">
  <img src="data/erwei.jpg" alt="微信二维码" width="300" />
  <p>扫描上方二维码添加作者微信</p>
</div>
