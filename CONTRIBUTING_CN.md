# 贡献指南

欢迎来到 Refly 贡献指南！作为 AI 原生的创作引擎，我们致力于提供最直观的自由画布界面，整合多线程对话、知识库 RAG 集成、上下文记忆和智能搜索功能。您的每一份贡献都意义非凡。

## 开始之前
[查找](https://github.com/refly-ai/refly/issues?q=is:issue+is:open)现有议题或[新建](https://github.com/refly-ai/refly/issues/new/choose)议题。我们将议题分为两类：

### 功能请求
- 新建功能请求时，请详细说明提案功能的目标实现，及其如何增强 AI 原生创作体验
- 认领现有议题时，请直接在评论区留言说明
  相关领域负责人将会介入审核，审核通过后方可开始编码。在此之前请暂缓开发工作以避免返工

  各领域负责人分工如下：

  | 成员               | 负责领域                                      |
  | -------------------- | -------------------------------------------- |
  | Canvas & AI Features | 多线程对话、AI 画布功能                      |
  | Knowledge Base       | RAG 集成、上下文记忆                         |
  | Frontend Experience  | 界面交互体验优化                             |
  | Developer Experience | API、SDK 及开发者工具                        |
  | Core Architecture    | 系统架构设计与扩展性                         |

  功能优先级：

  | 功能类型                          | 优先级       |
  | --------------------------------- | ------------ |
  | 核心 AI 功能与画布基础功能        | 最高优先级   |
  | 知识库与协作功能                  | 中等优先级   |
  | UI/UX 改进与小功能优化            | 低优先级     |
  | 实验性功能与未来构想              | 未来计划     |

### 其他类型（BUG 报告、性能优化、文档修正等）
- 可直接开始编码

  问题优先级：

  | 问题类型                          | 优先级       |
  | --------------------------------- | ------------ |
  | 核心功能 BUG                     | 紧急         |
  | 影响用户体验的性能问题            | 中等优先级   |
  | 界面微调与文档更新                | 低优先级     |

## 环境搭建
### 1. Fork 本仓库
### 2. 克隆仓库
```shell
git clone git@github.com:<github_用户名>/refly.git
```

### 3. 环境依赖
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js v20.x (LTS)](http://nodejs.org)
- [Visual Studio](https://visualstudio.microsoft.com/zh-hans/)
  - 确保您安装了最新版本的 Visual Studio，并且在安装过程中选择了“C++ 桌面开发”

### 4. 安装步骤
1. 启动中间件服务：
```bash
cd deploy/docker
docker-compose -f docker-compose.middleware.yml up -d
```

2. 安装依赖：
```bash
corepack enable
pnpm install
```

3. 配置环境变量：
```bash
cd ../..
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

4. 启动开发：
```bash
pnpm build
pnpm dev
```
- 部署时可能会遇到`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  - 可能可以通过设置`$env:NODE_OPTIONS='--max-old-space-size=8192'`解决
- 如无法看见登录注册页面 （CORS policy）
  - 如果需要跨域访问，请在`apps/api/.env`中设置`ORIGIN=http://localhost:5173`
- 如无法注册
  - 请检查`apps/api/prisma/schema.prisma` 
  - 在 `apps/api` 里面运行一下 `pnpm sync-db-schema` 
  - 如果是windows用户，请在`bash`中的`apps/api`目录下运行 `pnpm sync-db-schema-win`

访问 [http://localhost:5173](http://localhost:5173/) 开始开发

## 项目结构
### 后端结构
```text
[apps/server/]             // 主服务端应用
├── src/
│   ├── controllers/      // API 路由处理
│   ├── services/        // 业务逻辑实现
│   ├── models/          // 数据模型
│   ├── ai/              // AI 功能实现
│   │   ├── llm/        // LLM 集成
│   │   ├── rag/        // RAG 管道
│   │   └── memory/     // 上下文记忆管理
│   ├── canvas/         // 画布相关服务
│   └── utils/          // 工具函数
```

### 前端结构
```text
[apps/web/]                 // 主前端应用
├── src/
│   ├── components/         // React 组件
│   ├── styles/            // 全局样式
│   └── main.tsx           // 应用入口
```

## 提交 PR
准备就绪后：
1. 确保代码符合规范
2. 补充必要测试用例
3. 更新相关文档
4. 向 main 分支发起 PR

重大功能会先合并到 develop 分支进行测试，通过后再合并到 main。PR 合并后，您将荣登项目[贡献者名单](https://github.com/refly-ai/refly/blob/main/README.md)。

## 获取帮助
遇到问题时可：
- 加入 [Discord](https://discord.gg/bWjffrb89h) 社区
- 发起 [GitHub 讨论](https://github.com/refly-ai/refly/discussions)
- 查阅[项目文档](https://docs.refly.ai)

 