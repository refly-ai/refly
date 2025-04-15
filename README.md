# Refly-Local 增强版

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

本项目是基于 [reflyai](https://github.com/refly-ai/refly) 的二次开发版本。

进行二次开发的主要目的是为了解决原版在配置灵活性和本地化部署方面的一些限制，特别是针对 LLM、Embedding、Rerank 等核心组件，并优化了浏览器插件的剪存功能，使其能够更好地适应私有化部署场景。

## 核心改进

以下是本项目相对于原版的主要增强功能：

*   **灵活的 LLM 配置:**
    *   **解决了原版仅支持少数 LLM 服务的问题。** 现在可以通过统一的 `models.config.yaml` 文件灵活配置和切换不同的 LLM 端点，包括 OpenAI、OpenRouter、Ollama 以及其他兼容 OpenAI API 的本地或云端服务。
    *   *参考技术方案: `LLM-CHANGE-PLAN.md`*

*   **本地化 Embedding 支持:**
    *   **新增了对本地 Ollama Embedding 的支持。** 这解决了原版强制依赖 Jina API 可能带来的成本和网络问题，使得 Embedding 过程可以完全在本地进行。同时，用户仍然可以选择使用原有的 Embedding 方案 (如 Jina, OpenAI)。
    *   配置通过 `models.config.yaml` (`embedding.providers.ollama`) 和 `.env` 文件 (`EMBEDDINGS_PROVIDER`) 共同控制。
    *   *参考技术方案: `EMB_CHANGE_PLAN_FINAL.md`*

*   **扩展的 Rerank 选项:**
    *   **增加了对 Xinference Reranker 的支持，** 为用户提供了除 Jina Reranker 之外的另一种选择，特别是方便与本地部署的 Xinference 服务集成。
    *   可以通过 `models.config.yaml` (`rerank.defaultProvider`, `rerank.providers.xinference`) 和 `.env` (Jina 相关配置) 进行选择和配置。
    *   *参考技术方案: `RERANK_CHANGE_PLAN.md`*

*   **可配置的网页解析器:**
    *   **新增了基于 Trafilatura (Python/Node.js 回退) 的本地网页内容解析器。** 用户可以通过 `models.config.yaml` (`parsers.defaultProvider`) 在原有的 Jina Cloud API 解析器和新增的本地解析器之间进行选择，提高了网页抓取和处理的灵活性。
    *   *参考技术方案: `PARSERS_CHANGE_PLAN.md`*

*   **多样的 PDF 解析器:**
    *   **提供了三种 PDF 解析方案：MinerU API、Marker API 以及 Marker Local CLI。** 用户可以根据需求（如云服务便利性、本地处理能力、对特定格式的支持）通过 `models.config.yaml` (`pdf_parser.provider`) 选择最合适的 PDF 解析引擎。
    *   *参考技术方案: `PARSERS_CHANGE_PLAN.md`, `PDF_MINERU_PARSER.md`*

*   **可选的 Web 搜索服务:**
    *   **集成了 SearxNG 作为主要的本地化/自托管 Web 搜索选项，** 并保留了 Serper API 作为备选。用户可以通过 `models.config.yaml` (`web_search.defaultProvider`) 在两者之间切换，方便在不同网络环境下进行网页搜索。
    *   *参考技术方案: `WEB_SEARCH_PLAN.md`*

*   **插件剪存私有化:**
    *   **修改了浏览器插件，使其能够将剪存数据发送到用户自己部署的 API 服务器，** 而不是默认的官方服务器。这对于希望完全掌控数据的用户至关重要。配置涉及修改插件源码和正确设置后端/前端环境。
    *   *参考技术方案: `CHAJIANJIANCUN_PLAN.md`*

## 配置指南

本项目的配置主要通过两个文件进行管理：

1.  **核心配置文件 (`models.config.yaml`):**
    *   **位置:** 部署时通常位于 `deploy/docker/models.config.yaml`，并挂载到 API 容器内的 `/app/apps/api/models.config.yaml`。
    *   **作用:** 控制 LLM、Embedding (Ollama)、Rerank (Xinference)、HTML/PDF 解析器、Web 搜索 (SearxNG) 等核心 AI 功能的提供商选择和详细参数。
    *   **示例结构 (简化):**
        ```yaml
        llm:
          endpoints:
            # ... 定义你的 LLM 服务 ...
        embedding:
          providers:
            ollama:
              baseUrl: http://host.docker.internal:11434 # 示例
              defaultModel: nomic-embed-text
        rerank:
          defaultProvider: xinference # 或 jina
          providers:
            xinference:
              baseUrl: http://host.docker.internal:9997 # 示例
              modelName: bge-reranker-base
            # jina 配置主要在 .env
        parsers:
          defaultProvider: trafilatura # 或 jina
          providers:
            trafilatura:
              # ... trafilatura 配置 ...
        pdf_parser:
          provider: marker_local # 或 mineru, marker
          marker_local:
            output_format: markdown
            # ... marker_local 配置 ...
        web_search:
          defaultProvider: searxng # 或 serper
          providers:
            searxng:
              baseUrl: http://host.docker.internal:8080 # 示例
        ```
    *   **参考:** 请查阅 `apps/api/models.config.yaml.example` 获取完整的配置结构和说明。

2.  **环境变量 (`.env`):**
    *   **位置:** 部署时通常位于 `deploy/docker/.env`。
    *   **作用:**
        *   配置基础服务的连接信息 (PostgreSQL, Elasticsearch, Minio, Redis, Qdrant)。
        *   设置部分云服务的 API Key (如 Jina, Serper, Marker API)。
        *   配置身份验证 Cookie 的行为 (`REFLY_COOKIE_DOMAIN`, `REFLY_COOKIE_SECURE`, `REFLY_COOKIE_SAME_SITE`)。**`REFLY_COOKIE_DOMAIN` 必须正确设置，以便浏览器插件能够成功识别登录状态。**
    *   **参考:** 请查阅 `deploy/docker/.env.example` 获取所需的环境变量列表。

## 运行项目

本项目提供两种主要的运行方式：

### 1. Docker 部署 (推荐)

这是最推荐的生产环境和便捷体验方式，可以确保环境一致性。

1.  **前提条件:**
    *   安装 Docker 和 Docker Compose。
    *   **GPU 支持:** API 服务 (`api`) 的运行**需要 NVIDIA GPU** 支持，因为它依赖于需要 CUDA 的库 (例如 `marker-pdf` 或其他模型)。请确保 Docker 主机已正确安装 NVIDIA 驱动和 NVIDIA Container Toolkit。Docker Compose 文件中已包含 GPU 请求配置。
2.  **依赖服务:** Docker Compose 文件会自动拉取并启动所需的依赖服务：
    *   PostgreSQL (数据库)
    *   Elasticsearch (全文搜索)
    *   Minio (对象存储)
    *   Redis (缓存)
    *   Qdrant (向量数据库)
    确保你的 Docker 环境有足够资源运行这些服务。
3.  **配置:**
    *   **环境变量:** 复制 `deploy/docker/.env.example` 为 `deploy/docker/.env`，并根据你的环境修改数据库连接、Minio、Redis、Qdrant 地址、以及所需的 API Keys 等配置。**特别注意 `REFLY_COOKIE_DOMAIN` 的设置，它对插件登录至关重要。**
    *   **模型配置:** 复制 `apps/api/models.config.yaml.example` 为 `deploy/docker/models.config.yaml`，并根据你的需求配置 LLM、Embedding、Rerank、解析器等模型。此文件会被挂载到 API 容器中。
4.  **启动:** 在 `deploy/docker/` 目录下运行：
    ```bash
    docker compose up -d
    ```
    API 服务将运行在 `http://localhost:5800` (默认)，Web 服务运行在 `http://localhost:5700` (默认)。
5.  **参考:** `DOCKE_BUILD_PLAY.md` 提供了更详细的 Docker 构建和部署流程解析。

### 2. 本地源码运行 (开发/调试)

适合开发者进行代码修改和调试。

1.  **前提条件:**
    *   Node.js (推荐 v18 或更高版本)
    *   pnpm (推荐使用 `corepack enable`)
    *   Miniconda 或 Anaconda (用于管理 API 的 Python 环境)
    *   Git
    *   (可选但推荐) NVIDIA GPU 及相应的驱动程序 (如果需要运行依赖 GPU 的功能)
    *   **依赖服务:** 你需要**手动**启动并配置 PostgreSQL, Elasticsearch, Minio, Redis, Qdrant 服务，或者配置连接到已有的服务实例。
2.  **克隆仓库:**
    ```bash
    git clone <your-repo-url>
    cd refly-local-enhanced # 或者你的仓库名
    ```
3.  **安装 Node.js 依赖:**
    ```bash
    pnpm install
    ```
4.  **设置 Python 环境 (API):**
    *   API 服务依赖于特定的 Python 环境 (名为 `py310`) 和库 (如 PyTorch, marker-pdf)。你需要手动创建并配置此环境。
    *   参考 `apps/api/DockerfileV1` 中 Conda 环境创建和依赖安装部分，执行类似的操作：
        *   创建 Conda 环境: `conda create -n py310 python=3.10 -y`
        *   激活环境: `conda activate py310`
        *   安装依赖: 根据 Dockerfile 中的 `pip install` 命令安装必要的 Python 包 (可能需要调整 CUDA 版本以匹配你的 GPU)。
5.  **配置:**
    *   **API 配置:**
        *   将 `deploy/docker/.env.example` (或相关部分) 复制到 `apps/api/.env` 并修改配置，确保数据库、Minio 等连接信息指向你手动启动或已有的服务。
        *   将 `apps/api/models.config.yaml.example` 复制到 `apps/api/models.config.yaml` 并修改配置。
    *   **Web 配置:** (可能需要) 为 `apps/web` 配置环境变量，通常可以在 `apps/web` 目录下创建 `.env` 文件，至少需要配置 `API_URL` 指向本地运行的 API 服务 (例如 `http://localhost:3000`)。
6.  **构建 (可选但推荐):**
    ```bash
    pnpm build
    ```
7.  **启动开发服务器:**
    *   **启动 API 服务 (需要激活 `py310` Conda 环境):**
        ```bash
        conda activate py310
        pnpm --filter api dev
        ```
        API 默认运行在 `http://localhost:3000`。
    *   **启动 Web 服务 (在另一个终端):**
        ```bash
        pnpm --filter web dev
        ```
        Web 服务默认运行在 `http://localhost:5173`。

**注意:** 本地运行需要手动管理 Python 环境和依赖，并确保所有基础服务已启动且配置正确。对于 API 服务，如果使用了需要 GPU 的模型或功能，本地环境同样需要满足 GPU 要求。

## 插件使用 (私有化部署)

如果你希望浏览器插件连接到你自己部署的服务器，你需要：

1.  **修改插件源代码:**
    *   编辑 `packages/utils/src/url.ts`，修改以下常量为你私有部署的地址 (需要包含 `http://` 或 `https://`):
        *   `SERVER_PROD_DOMAIN`: 指向你的后端 API 地址 (例如 `http://yourdomain.com:5800`)
        *   `SERVER_DEV_DOMAIN`: (同上，或你的开发环境 API 地址)
        *   `CLIENT_PROD_APP_DOMAIN`: 指向你的前端 Web 应用地址 (例如 `http://yourdomain.com:5700`)
        *   `CLIENT_DEV_APP_DOMAIN`: (同上，或你的开发环境前端地址)
        *   `CLIENT_PROD_COOKIE_DOMAIN`: 设置为你的主域名 (例如 `.yourdomain.com`)
        *   `CLIENT_DEV_COOKIE_DOMAIN`: (同上)
    *   编辑 `apps/extension/wxt.config.ts`，在 `manifest.externally_connectable.matches` 数组中添加你的前端 Web 应用地址 (需要包含协议和 `/*` 通配符，例如 `http://yourdomain.com:5700/*`)。
2.  **重新编译插件:**
    *   确保 `pnpm` 已安装。
    *   在项目根目录运行：
        ```bash
        pnpm --filter @refly/extension build
        ```
3.  **加载插件:**
    *   打开浏览器的扩展管理页面 (`chrome://extensions` 或 `edge://extensions`)。
    *   启用“开发者模式”。
    *   点击“加载已解压的扩展程序”。
    *   选择编译输出目录 (通常是 `apps/extension/.output/chrome-mv3`)。
*   *参考排错过程: `CHAJIANJIANCUN_PLAN.md`*

## 授权协议

本项目遵循 `MarcusYuan/refly-local` 项目的原有授权协议：[MIT License](LICENSE)。

## 贡献

欢迎对本项目进行贡献！请参考 [CONTRIBUTING_CN.md](CONTRIBUTING_CN.md) (中文) 或 [CONTRIBUTING.md](CONTRIBUTING.md) (英文) 了解详情。