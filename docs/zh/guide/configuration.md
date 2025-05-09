# 配置说明

## API 服务器

以下是 API 服务器的详细配置说明。你可以将这些环境变量注入到 `refly_api` 容器中。

### 基本配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| NODE_ENV | Node 运行环境 | `development` |
| PORT | HTTP API 服务端口，用于常规 API 请求 | `5800` |
| WS_PORT | WebSocket 服务器端口，用于画布和文档的实时同步 | `5801` |
| ORIGIN | 客户端来源（即访问 Refly 应用的地址），用于 CORS 检查 | `http://localhost:5700` |
| STATIC_PUBLIC_ENDPOINT | 公开可访问的静态文件端点 (无需身份验证即可访问) | `http://localhost:5800/v1/misc` |
| STATIC_PRIVATE_ENDPOINT | 私有静态文件端点 (需要身份验证才能访问) | `http://localhost:5800/v1/misc` |

### 凭证配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| OPENAI_API_KEY | [OpenAI](https://openai.com/) 或其他兼容供应方的 API 密钥，用于 LLM 推理和嵌入 | (未设置) |
| OPENAI_BASE_URL | OpenAI 兼容供应方的基础 URL，用于 LLM 推理和嵌入 | (未设置) |
| OPENROUTER_API_KEY | [OpenRouter](https://openrouter.ai/) API 密钥，用于 LLM 推理 | (未设置) |
| JINA_API_KEY | [Jina](https://jina.ai/) API 密钥，用于嵌入和网页解析 | (未设置) |
| FIREWORKS_API_KEY | [Fireworks](https://fireworks.ai/) API 密钥，用于嵌入 | (未设置) |
| SERPER_API_KEY | [Serper](https://serper.dev/) API 密钥，用于在线搜索 | (未设置) |
| MARKER_API_KEY | [Marker](https://www.datalab.to/) API 密钥，用于 PDF 解析 | (未设置) |

### 中间件

Refly 依赖以下中间件来正常运行：

- **Postgres**：用于基本数据持久化
- **Redis**：用于缓存、异步任务队列和分布式环境中的协调
- **Qdrant**：用于通过嵌入进行语义搜索
- **Elasticsearch**：用于工作区内的全文搜索
- **MinIO**：用于画布、文档和资源数据的对象存储

#### Postgres

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| DATABASE_URL | PostgreSQL 连接 URL | `postgresql://refly:test@localhost:5432/refly?schema=refly` |

::: info
参考 [Prisma 文档](https://www.prisma.io/docs/orm/overview/databases/postgresql#connection-details) 了解连接 URL 的详细定义。
:::

#### Redis

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| REDIS_HOST | Redis 主机地址 | `localhost` |
| REDIS_PORT | Redis 端口 | `6379` |
| REDIS_PASSWORD | Redis 密码 | `test` |

#### Qdrant (向量存储)

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QDRANT_HOST | Qdrant 主机地址 | `localhost` |
| QDRANT_PORT | Qdrant 端口 | `6333` |
| QDRANT_API_KEY | Qdrant API 密钥 | (未设置) |
| REFLY_VEC_DIM | 向量维度大小 | `768` |

#### Elasticsearch

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| ELASTICSEARCH_URL | Elasticsearch URL | `http://localhost:9200` |
| ELASTICSEARCH_USERNAME | Elasticsearch 用户名 | (未设置) |
| ELASTICSEARCH_PASSWORD | Elasticsearch 密码 | (未设置) |

#### MinIO

Refly 需要两个 MinIO 实例：

- **内部**：用于存储画布、资源和文档数据，通常设置为*私有*可见性。
- **外部**：用于存储上传的文件，通常设置为*公开*可见性。

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| MINIO_INTERNAL_ENDPOINT | 内部数据使用的 MinIO 主机 | `localhost` |
| MINIO_INTERNAL_PORT | 内部数据使用的 MinIO 端口 | `9000` |
| MINIO_INTERNAL_USE_SSL | 是否使用 HTTPS 传输 | `false` |
| MINIO_INTERNAL_ACCESS_KEY | 内部 MinIO 访问密钥 | `minioadmin` |
| MINIO_INTERNAL_SECRET_KEY | 内部 MinIO 密钥 | `minioadmin` |
| MINIO_INTERNAL_BUCKET | 内部存储桶名称 | `refly-weblink` |
| MINIO_EXTERNAL_ENDPOINT | 外部数据使用的 MinIO 主机 | `localhost` |
| MINIO_EXTERNAL_PORT | 外部数据使用的 MinIO 端口 | `9000` |
| MINIO_EXTERNAL_USE_SSL | 是否使用 HTTPS 传输 | `false` |
| MINIO_EXTERNAL_ACCESS_KEY | 外部 MinIO 访问密钥 | `minioadmin` |
| MINIO_EXTERNAL_SECRET_KEY | 外部 MinIO 密钥 | `minioadmin` |
| MINIO_EXTERNAL_BUCKET | 外部存储桶名称 | `refly-weblink` |

### 认证配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| AUTH_SKIP_VERIFICATION | 是否跳过邮箱验证 | `false` |
| REFLY_COOKIE_DOMAIN | 用于签署认证令牌的 Cookie 域名 | `localhost` |
| LOGIN_REDIRECT_URL | OAuth 登录后的重定向 URL | (未设置) |
| JWT_SECRET | JWT 签名密钥 | `test` |
| JWT_EXPIRATION_TIME | JWT 访问令牌过期时间 | `1h` |
| JWT_REFRESH_EXPIRATION_TIME | JWT 刷新令牌过期时间 | `7d` |
| COLLAB_TOKEN_EXPIRY | 协作令牌过期时间 | `1h` |

::: info
时间格式与 [Vercel MS](https://github.com/vercel/ms) 兼容。
:::

#### 邮箱认证

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| EMAIL_AUTH_ENABLED | 是否启用邮箱认证 | `true` |
| EMAIL_SENDER | 邮件发送者 | `Refly <notifications@refly.ai>` |
| RESEND_API_KEY | [Resend](https://resend.com/) API 密钥，用于发送邮件 | `re_123` |

::: warning
默认的 `RESEND_API_KEY` 是无效的（仅作为占位符）。如果需要，请设置你自己的 API 密钥。
:::

#### GitHub 认证

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| GITHUB_AUTH_ENABLED | 是否启用 GitHub 认证 | `false` |
| GITHUB_CLIENT_ID | GitHub OAuth 客户端 ID | `test` |
| GITHUB_CLIENT_SECRET | GitHub OAuth 客户端密钥 | `test` |
| GITHUB_CALLBACK_URL | GitHub OAuth 回调 URL | `test` |

::: warning
默认的 OAuth 凭证是无效的（仅作为占位符）。如果需要，请设置你自己的 GitHub OAuth 凭证。
:::

::: info
你可以在 [GitHub Developer](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) 了解更多关于 GitHub OAuth 的信息。
:::

#### Google 认证

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| GOOGLE_AUTH_ENABLED | 是否启用 Google 认证 | `false` |
| GOOGLE_CLIENT_ID | Google OAuth 客户端 ID | `test` |
| GOOGLE_CLIENT_SECRET | Google OAuth 客户端密钥 | `test` |
| GOOGLE_CALLBACK_URL | Google OAuth 回调 URL | `test` |

::: warning
默认的 OAuth 凭证是无效的（仅作为占位符）。如果需要，请设置你自己的 Google OAuth 凭证。
:::

::: info
你可以在 [Google Developer](https://developers.google.com/identity/protocols/oauth2) 了解更多关于 Google OAuth 的信息。
:::

### 解析器配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| PARSER_PDF | PDF 文件解析器 (可选 `pdfjs` 或 `marker`) | `pdfjs` |

::: info
如果想使用 `marker` 作为 PDF 文件的解析器，你需要设置 `MARKER_API_KEY` 环境变量。
:::

### 嵌入配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| EMBEDDINGS_PROVIDER | 嵌入提供者（可选 `jina`、`fireworks` 或 `openai`） | `jina` |
| EMBEDDINGS_MODEL_NAME | 嵌入模型名称 | `jina-embeddings-v3` |
| EMBEDDINGS_DIMENSIONS | 嵌入向量维度 | `768` |
| EMBEDDINGS_BATCH_SIZE | 嵌入处理批次大小 | `512` |

::: info
默认的 `EMBEDDINGS_PROVIDER` 是 `jina`。如果你想使用其他嵌入提供者，请设置相应的环境变量。
:::

::: warning
`EMBEDDINGS_DIMENSIONS` 必须与 Qdrant 中的 `REFLY_VEC_DIM` 设置为相同的值。
:::

### 重排序器

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| RERANKER_TOP_N | 需要重排序的顶部结果数量 | `10` |
| RERANKER_MODEL | 重排序模型名称 | `jina-reranker-v2-base-multilingual` |
| RERANKER_RELEVANCE_THRESHOLD | 重排序相关性阈值 | `0.5` |

::: warning
目前仅支持 Jina 重排序器。你需要设置 `JINA_API_KEY` 环境变量。
:::

### 技能执行

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| SKILL_IDLE_TIMEOUT | 技能空闲超时时间（毫秒） | `60000` |
| SKILL_EXECUTION_TIMEOUT | 技能执行超时时间（毫秒） | `180000` |

### Stripe

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| STRIPE_API_KEY | Stripe API 密钥 | (未设置) |
| STRIPE_ACCOUNT_WEBHOOK_SECRET | Stripe 账户 webhook 密钥 | `test` |
| STRIPE_ACCOUNT_TEST_WEBHOOK_SECRET | Stripe 测试账户 webhook 密钥 | `test` |
| STRIPE_SESSION_SUCCESS_URL | Stripe 成功重定向 URL | (未设置) |
| STRIPE_SESSION_CANCEL_URL | Stripe 取消重定向 URL | (未设置) |
| STRIPE_PORTAL_RETURN_URL | Stripe 客户门户返回 URL | (未设置) |

### 配额

#### 请求配额

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QUOTA_T1_REQUEST | 一级请求配额 | `-1` |
| QUOTA_T2_REQUEST | 二级请求配额 | `-1` |

#### 存储配额

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QUOTA_STORAGE_FILE | 文件存储配额 | `-1` |
| QUOTA_STORAGE_OBJECT | 对象存储配额 | `-1` |
| QUOTA_STORAGE_VECTOR | 向量存储配额 | `-1` |

## Web 前端

以下是 Web 前端的详细配置说明。你可以将这些环境变量注入到 `refly_web` 容器中。

### 基本配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| REFLY_API_URL | Refly API 服务器 URL | `http://localhost:5800` |
| COLLAB_URL | 协作端点 URL | `http://localhost:5801` |
| SUBSCRIPTION_ENABLED | 是否启用订阅和计费功能 | (未设置) |

## 模型配置

大语言模型（LLM）配置通过 `refly_db` PostgreSQL 数据库中的 `refly.model_infos` 表进行管理。你可以通过 SQL 客户端按需调整模型。

以下是各列的说明：

- `name`：模型的名称（ID），应为 `${OPENAI_BASE_URL}/v1/models` 返回的 `id` 值
- `label`：模型的标签，将在模型选择器中显示
- `provider`：模型的提供商，用于显示模型图标（目前支持 `openai`、`anthropic`、`deepseek`、`google`、`qwen`、`mistral` 和 `meta-llama`）
- `tier`：模型的等级，目前支持 `t1`（高级）、`t2`（标准）和 `free`
- `enabled`：是否启用模型
- `is_default`：是否为默认模型
- `context_limit`：模型的上下文限制（token 数量）
- `max_output`：模型的最大输出长度（token 数量）
- `capabilities`：模型的能力（JSON 字符串），具有以下键：
  - `vision`：是否支持视觉输入（接受图片作为输入）
