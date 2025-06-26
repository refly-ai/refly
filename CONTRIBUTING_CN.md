# 贡献指南

欢迎来到 Refly 贡献指南！作为 AI 原生的创作引擎，我们致力于提供最直观的自由画布界面，整合多线程对话、知识库 RAG 集成、上下文记忆和智能搜索功能。社区的每一份帮助都意义非凡。

考虑到我们目前的发展阶段，我们需要保持敏捷并快速交付，但同时也希望确保像您这样的贡献者能够获得尽可能顺畅的贡献体验。我们制作了这份贡献指南，旨在帮助您熟悉代码库以及我们与贡献者的协作方式，让您能够快速进入有趣的部分。

这份指南，就像 Refly 本身一样，是一个持续改进的过程。如果有时它滞后于实际项目，我们非常感谢您的理解，也欢迎任何反馈来帮助我们改进。

在许可方面，请花一分钟阅读我们简短的[许可和贡献者协议](./LICENSE)。社区还遵守[行为准则](./.github/CODE_OF_CONDUCT.md)。

## 开始之前

[查找](https://github.com/refly-ai/refly/issues?q=is:issue+is:open)现有议题或[新建](https://github.com/refly-ai/refly/issues/new/choose)议题。我们将议题分为两类：

### 功能请求

- 新建功能请求时，请详细说明提案功能的目标实现，及其如何增强 AI 原生创作体验，并尽可能提供更多上下文信息。

- 认领现有议题时，请直接在评论区留言说明。

  相关领域负责人将会介入审核。如果一切顺利，他们会给您开始编码的许可。在此之前请暂缓开发工作，以避免在我们提出更改建议时您的工作白费。

  根据提议功能所属的不同领域，您可能会与不同的团队成员交流。以下是我们团队成员目前负责的领域概览：

  | 成员               | 负责领域                                      |
  | -------------------- | -------------------------------------------- |
  | Canvas & AI Features | 多线程对话、AI 驱动的画布功能                      |
  | Knowledge Base       | RAG 集成、上下文记忆                         |
  | Frontend Experience  | UI/UX、画布交互                             |
  | Developer Experience | API、SDK、开发者工具                        |
  | Core Architecture    | 整体系统设计与扩展性                         |

  功能优先级：

  | 功能类型                          | 优先级       |
  | --------------------------------- | ------------ |
  | 核心 AI 功能与画布基础功能        | 高优先级   |
  | 知识库与协作功能                  | 中等优先级   |
  | UI/UX 改进与小功能优化            | 低优先级     |
  | 实验性功能与未来构想              | 未来功能     |

### 其他类型（如 BUG 报告、性能优化、错别字修正等）

- 可直接开始编码。

  问题优先级：

  | 问题类型                          | 优先级       |
  | --------------------------------- | ------------ |
  | 核心 AI 功能或画布功能的 BUG     | 紧急         |
  | 影响用户体验的性能问题            | 中等优先级   |
  | 界面微调与文档更新                | 低优先级     |

## 安装

以下是设置 Refly 开发环境的步骤：

### 1. Fork 本仓库

### 2. 克隆仓库

从终端克隆您 fork 的仓库：

```shell
git clone git@github.com:<github_用户名>/refly.git
```

### 3. 验证依赖

Refly 需要以下依赖进行构建：

- [Docker](https://www.docker.com/)：20.10.0 或以上
- [Node.js](http://nodejs.org)：20.19.0 (LTS)

我们强烈推荐使用 [nvm](https://github.com/nvm-sh/nvm) 安装 Node.js：

```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
source ~/.bashrc  # 如果您使用的是 zsh，请使用 source ~/.zshrc 代替
nvm install 20.19.0
```

确保所有依赖都已准备就绪：

```shell
docker version
node -v # v20.19.0 或更高版本
pnpm -v # 9.15.9
```

## 开发

### 开发 API 和 Web

1. 启动所有中间件服务：

```bash
docker compose -f deploy/docker/docker-compose.middleware.yml -p refly up -d
docker ps | grep refly_ # 检查所有中间件容器是否健康
```

> 如果存在不健康的容器，请检查容器日志并搜索相应解决方案。如果问题仍然存在，请在仓库中提出 Issue。

2. 安装 npm 依赖：

```bash
corepack enable
pnpm install
```

> 如果 `corepack` 不可用，您也可以通过 `npm install -g pnpm` 安装 pnpm。

3. 从根目录配置环境变量：

```bash
pnpm copy-env:develop
```

4. 首次构建所有包：

```bash
pnpm build
```

5. 从根目录或在单独的包中开始开发基于 web-UI 的应用程序：

```bash
# 选项 1：从根目录
pnpm dev

# 选项 2：在两个终端中分别运行包
cd apps/web && pnpm dev # 终端 1
cd apps/api && pnpm dev # 终端 2
```

您可以访问 [http://localhost:5173](http://localhost:5173/) 开始开发 Refly。

6. 开发桌面应用程序：

```bash
# 选项 1：从根目录
pnpm dev:electron

# 选项 2：在两个终端中分别运行包
cd apps/web && pnpm dev:electron # 终端 1
cd apps/desktop && pnpm dev:electron # 终端 2
```

## 代码结构

为了帮助您快速了解您的贡献适合哪里，以下是 Refly 结构的简要概述：

### 后端结构

```text
[apps/api/]                // 主 API 服务器应用程序
├── src/
│   ├── modules/          // 功能模块（NestJS 模块）
│   │   ├── auth/        // 身份验证和授权
│   │   ├── canvas/      // 画布相关后端服务
│   │   ├── rag/         // RAG 管道实现
│   │   ├── knowledge/   // 知识库管理
│   │   ├── provider/    // AI 提供商集成
│   │   ├── search/      // 搜索功能
│   │   ├── collab/      // 实时协作
│   │   ├── project/     // 项目管理
│   │   ├── user/        // 用户管理
│   │   └── ...          // 其他功能模块
│   ├── utils/           // 共享工具
│   └── scripts/         // 构建和部署脚本
├── prisma/              // 数据库架构和迁移
└── data/                // 静态数据和配置

[packages/]
├── providers/           // AI 提供商抽象和实现
│   └── src/            // LLM 集成（OpenAI、Anthropic 等）
├── common-types/       // 共享 TypeScript 类型和接口
├── ai-workspace-common/ // 共享 AI 工作区组件和逻辑
├── utils/              // 共享工具函数
├── errors/             // 通用错误定义
├── openapi-schema/     // API 架构定义
└── tsconfig/           // 共享 TypeScript 配置
```

后端使用 NestJS 和 TypeScript 构建，专注于：

- 基于功能模块的模块化架构
- AI 提供商集成和 LLM 管理
- 用于知识检索的 RAG 管道实现
- 使用 WebSocket 的实时协作
- 画布状态管理和持久化
- 带有 OpenAPI 文档的 RESTful API
- 使用 Prisma ORM 的高效数据库操作

### 前端结构

```text
[apps/web/]                 // 主 Web 应用程序
├── src/
│   ├── components/         // React 组件
│   ├── pages/             // 页面组件和路由
│   ├── routes/            // 路由定义
│   ├── lib/               // 第三方库配置
│   ├── utils/             // 前端工具
│   ├── styles/            // 全局样式和主题
│   └── main.tsx           // 应用程序入口点
├── public/                // 静态资源
└── typing/                // TypeScript 类型定义

[apps/desktop/]            // 桌面应用程序（Electron）
├── src/                   // 桌面特定代码
└── ...                    // Electron 配置

[apps/extension/]          // 浏览器扩展
├── src/                   // 扩展特定代码
└── ...                    // 扩展清单和资源

[packages/]
├── ai-workspace-common/   // 共享 AI 工作区组件
│   ├── src/
│   │   ├── components/    // 画布、编辑器和 AI 功能组件
│   │   ├── hooks/         // 自定义 React hooks
│   │   ├── stores/        // 状态管理（Zustand/Redux）
│   │   ├── utils/         // 共享工具
│   │   ├── types/         // 组件特定类型
│   │   └── modules/       // 功能模块
│
├── i18n/                  // 国际化
│   ├── src/
│   │   ├── en-US/         // 英文翻译
│   │   └── zh-Hans/       // 中文翻译
│
└── wxt/                   // Web 扩展工具包配置
```

前端使用 React、TypeScript 和现代工具构建：

- 基于组件的架构，具有可重用的 UI 组件
- 基于画布的 AI 驱动内容创作界面
- 实时协作功能
- 多线程对话管理
- 知识库集成和 RAG 驱动的搜索
- 使用 Tailwind CSS 的响应式设计
- 复杂应用程序状态的状态管理
- 多语言国际化支持

## 提交 PR

当您准备提交贡献时：

1. 确保代码符合我们的风格指南
2. 如适用，添加测试
3. 如需要，更新文档
4. 向 `main` 分支创建拉取请求

对于重大功能，我们首先将它们合并到 `develop` 分支进行测试，然后再进入 `main` 分支。

就是这样！一旦您的 PR 被合并，您将作为贡献者出现在我们的 [README](https://github.com/refly-ai/refly/blob/main/README.md) 中。

## 获取帮助

如果您在贡献过程中遇到困难或有疑问，可以：

- 加入我们的 [Discord](https://discord.gg/bWjffrb89h) 社区
- 在我们的 [GitHub 讨论](https://github.com/refly-ai/refly/discussions)中开启讨论
- 查看我们的[文档](https://docs.refly.ai)

 