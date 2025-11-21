# 配置说明

## API 服务器 {#api-server}

以下是 API 服务器的详细配置说明。你可以将这些环境变量注入到 `refly_api` 容器中。

### 基本配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| NODE_ENV | Node 运行环境 | `development` |
| PORT | HTTP API 服务端口，用于常规 API 请求 | `5800` |
| WS_PORT | WebSocket 服务器端口，用于画布和文档的实时同步 | `5801` |
| ORIGIN | 客户端来源（即访问 Refly 应用的地址），用于 CORS 检查 | `http://localhost:5700` |
| STATIC_PUBLIC_ENDPOINT | 公开可访问的静态文件端点 (无需身份验证即可访问) | `http://localhost:5800/v1/misc/public` |
| STATIC_PRIVATE_ENDPOINT | 私有静态文件端点 (需要身份验证才能访问) | `http://localhost:5800/v1/misc` |

### 中间件

Refly 依赖以下中间件来正常运行：

- **Postgres**：用于基本数据持久化
- **Redis**：用于缓存、异步任务队列和分布式环境中的协调
- **Qdrant**：用于通过嵌入进行语义搜索
- **MinIO**：用于画布、文档和资源数据的对象存储

可选：

- **SearXNG**：用于在线搜索
- **Elasticsearch**：用于工作区内的全文搜索

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
| REDIS_USERNAME | Redis 用户名 | (未设置) |
| REDIS_PASSWORD | Redis 密码 | (未设置) |

#### 向量存储

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| VECTOR_STORE_BACKEND | 向量存储后端 (`qdrant` 或 `lancedb`) | `qdrant` |

##### Qdrant (向量存储)

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QDRANT_HOST | Qdrant 主机地址 | `localhost` |
| QDRANT_PORT | Qdrant 端口 | `6333` |
| QDRANT_API_KEY | Qdrant API 密钥 | (未设置) |

##### LanceDB (向量存储)

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| LANCEDB_URI | LanceDB 数据库 URI | `./data/lancedb` |

#### 对象存储

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| OBJECT_STORAGE_RECLAIM_POLICY | 对象存储回收策略 (`retain` 或 `delete`) | `retain` |
| OBJECT_STORAGE_BACKEND | 对象存储后端 (`minio` 或 `fs`) | `minio` |

##### 文件系统存储

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| OBJECT_STORAGE_FS_ROOT | 文件系统存储根路径 | `./storage` |

##### MinIO

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

#### 全文搜索

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| FULLTEXT_SEARCH_BACKEND | 全文搜索后端 (`prisma` 或 `elasticsearch`) | `prisma` |
| ELASTICSEARCH_URL | Elasticsearch URL (当 `FULLTEXT_SEARCH_BACKEND` 为 `elasticsearch` 时必填) | `http://localhost:9200` |
| ELASTICSEARCH_USERNAME | Elasticsearch 用户名 (当 `FULLTEXT_SEARCH_BACKEND` 为 `elasticsearch` 时必填) | (未设置) |
| ELASTICSEARCH_PASSWORD | Elasticsearch 密码 (当 `FULLTEXT_SEARCH_BACKEND` 为 `elasticsearch` 时必填) | (未设置) |

### 认证配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| AUTH_SKIP_VERIFICATION | 是否跳过邮箱验证 | `false` |
| LOGIN_REDIRECT_URL | OAuth 登录后的重定向 URL | (未设置) |
| JWT_SECRET | JWT 签名密钥 | `test` |
| JWT_EXPIRATION_TIME | JWT 访问令牌过期时间 | `1h` |
| JWT_REFRESH_EXPIRATION_TIME | JWT 刷新令牌过期时间 | `7d` |
| COLLAB_TOKEN_EXPIRY | 协作令牌过期时间 | `1h` |

#### Cookie 配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| REFLY_COOKIE_DOMAIN | 用于签署认证令牌的 Cookie 域名 | (未设置) |
| REFLY_COOKIE_SECURE | 是否使用安全 Cookie | (未设置) |
| REFLY_COOKIE_SAME_SITE | SameSite Cookie 属性 | (未设置) |

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

### 图像处理

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| IMAGE_MAX_AREA | 传递给 LLM 的图像最大面积 | `360000` |
| IMAGE_PAYLOAD_MODE | 图像负载模式 (`base64` 或 `url`) | `base64` |
| IMAGE_PRESIGN_EXPIRY | 预签名图像 URL 的过期时间（秒） | `900` |

### 加密

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| ENCRYPTION_KEY | 用于加密和解密敏感数据的密钥 | (未设置) |

### 技能执行

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| SKILL_STREAM_IDLE_TIMEOUT | 技能流空闲超时时间（毫秒） | `0` |
| SKILL_STREAM_IDLE_CHECK_INTERVAL | 技能流空闲检查间隔（毫秒） | `3000` |
| SKILL_STUCK_CHECK_INTERVAL | 技能卡住检查间隔（毫秒） | `0` |
| SKILL_STUCK_TIMEOUT_THRESHOLD | 技能卡住超时阈值（毫秒） | `0` |

### 提供商配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| PROVIDER_DEFAULT_MODE | 默认提供商模式 (`global` 或 `custom`) | `custom` |

### 默认模型

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| DEFAULT_MODEL_CHAT | 默认聊天模型 | (未设置) |
| DEFAULT_MODEL_AGENT | 默认代理模型 | (未设置) |
| DEFAULT_MODEL_QUERY_ANALYSIS | 默认查询分析模型 | (未设置) |
| DEFAULT_MODEL_TITLE_GENERATION | 默认标题生成模型 | (未设置) |
| DEFAULT_MODEL_IMAGE | 默认图像模型 | (未设置) |
| DEFAULT_MODEL_VIDEO | 默认视频模型 | (未设置) |
| DEFAULT_MODEL_AUDIO | 默认音频模型 | (未设置) |

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

#### Token 配额

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QUOTA_T1_TOKEN | 一级 Token 配额 | `-1` |
| QUOTA_T2_TOKEN | 二级 Token 配额 | `-1` |

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

#### 文件解析配额

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| QUOTA_FILE_PARSE_PAGE | 文件解析页面配额 | `-1` |

### Langfuse

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| LANGFUSE_PUBLIC_KEY | Langfuse 公钥 | (未设置) |
| LANGFUSE_SECRET_KEY | Langfuse 密钥 | (未设置) |
| LANGFUSE_HOST | Langfuse 主机 URL | (未设置) |

## Web 前端 {#web-frontend}

以下是 Web 前端的详细配置说明。你可以将这些环境变量注入到 `refly_web` 容器中。

### 基本配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| REFLY_API_URL | Refly API 服务器 URL | `http://localhost:5800` |
| COLLAB_URL | 协作端点 URL | `http://localhost:5801` |
| SUBSCRIPTION_ENABLED | 是否启用订阅和计费功能 | (未设置) |
