![refly-cover](https://github.com/user-attachments/assets/2930c555-09a7-4ea2-a18a-2b1d8a7ef4ae)

<div align="center">

<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.refly.ai" target="_blank">Refly.AI</a><br>
    </b>
    ⭐️  开源 Vibe Workflow 平台 ⭐️ <br>
</h1>

Refly 是一个开创性的开源 Vibe Workflow 平台，旨在解决您最复杂的挑战。只需要动动嘴，您就可以轻松地设计、构建和复用智能工作流，借助 AI 智能体和可无限扩展的 MCP 工具，完成高质量的工作结果交付，从而大幅提升生产力。

[🚀 v0.7.1 正式发布！MCP 商店和后台技能调用 🚀⚡️](https://docs.refly.ai/zh/changelog/v0.7.1)

[Refly Cloud](https://refly.ai/) · [Self-hosting](https://docs.refly.ai/zh/guide/self-deploy) · [Forum](https://github.com/refly-ai/refly/discussions) · [Discord](https://discord.gg/bWjffrb89h) · [Twitter](https://x.com/reflyai) · [Documentation](https://docs.refly.ai/)

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

[![Deploy on Sealos](https://sealos.io/Deploy-on-Sealos.svg)](https://template.sealos.io/deploy?templateName=refly)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/refly-ai/refly)

<p align="center">
  <a href="./README.md"><img alt="README in English" src="https://img.shields.io/badge/English-d9d9d9"></a>
  <a href="./README_CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-d9d9d9"></a>
</p>

</div>

## 快速开始

> 在安装 ReflyAI 之前，请确保您的机器满足以下最低系统要求：
>
> CPU >= 2 核
>
> 内存 >= 4GB

### 使用 Docker 自行部署

使用 Docker 部署您自己的功能丰富、无限制版本的 ReflyAI。我们的团队正在努力更新到最新版本。

开始部署：

```bash
cd deploy/docker
cp ../../apps/api/.env.example .env # 确保所有必须的环境变量均已设置
docker compose up -d
```

### 使用 Kubernetes 自行部署

与此同时，我们也支持在 K8s 集群部署 ReflyAI。

开始部署

```bash
cd deploy/kubernetes

kubectl apply -f refly-deployment.yaml
```

访问 [http://localhost:5700](http://localhost:5700/) （ Kubernetes 部署访问 `http://${HOST_IP}:30001` ）开始使用 ReflyAI。

核心部署教程、环境变量配置和常见问题参见 👉 [部署教程](https://docs.refly.ai/zh/guide/self-deploy)。

### 本地开发

查看 [CONTRIBUTING](./CONTRIBUTING_CN.md) 了解更多信息。

## 核心特性

### `1` 🧵 多线程对话系统

基于创新的多线程对话架构，支持并行管理多个独立会话上下文。通过高效的状态管理和上下文切换机制，实现复杂的 Agentic Workflow，突破传统对话模型的限制。

### `2` 🤖 多模型集成框架

- 集成 13+ 主流大语言模型，包括 DeepSeek R1、Claude 3.5 Sonnet、Google Gemini 2.0、OpenAI O3-mini 等
- 支持模型混合调度和并行处理
- 灵活的模型切换机制和统一的对话接口
- 多模型知识库协同

### `3` 🎨 多模态处理能力

- 文件格式支持：PDF、DOCX、RTF、TXT、MD、HTML、EPUB 等 7+ 种格式
- 图像处理：支持 PNG、JPG、JPEG、BMP、GIF、SVG、WEBP 等主流格式
- 智能批处理：支持画布多元素批量选择和 AI 分析

### `4` ⚡️ AI 驱动的技能系统

集成 Perplexity AI、Stanford Storm 等先进能力，提供：

- 智能全网搜索与信息聚合
- 基于向量数据库的知识检索
- 智能问题改写与推荐
- AI 辅助文档生成工作流

### `5` 🔍 上下文管理系统

- 精确的临时知识库构建
- 灵活的节点选择机制
- 多维度上下文关联
- 类 Cursor 的智能上下文理解

### `6` 📚 知识库引擎

- 支持多源异构数据导入
- 基于 RAG 的语义检索架构
- 智能知识图谱构建
- 个性化知识空间管理

### `7` ✂️ 智能内容采集

- 支持主流平台内容一键采集（Github、Medium、Wikipedia、Arxiv 等）
- 智能内容解析与结构化
- 自动知识分类与标签
- 深度知识库集成

### `8` 📌 引用系统

- 灵活的多源内容引用
- 智能上下文关联
- 一键引用生成
- 引用溯源支持

### `9` ✍️ AI 增强编辑器

- 实时 Markdown 渲染
- AI 辅助内容优化
- 智能内容分析
- 类 Notion 的编辑体验

### `10` 🎨 代码生成引擎

- 生成 HTML、SVG、Mermaid 图表和 React 应用
- 智能代码结构优化
- 组件化架构支持
- 实时代码预览和调试

### `11` 🌐 网站可视化引擎

- 交互式网页渲染和预览
- 复杂概念可视化支持
- 动态 SVG 和图表生成
- 响应式设计模板
- 实时网站原型设计
- 现代 Web 框架集成

## 🛣️ 产品路线图

我们正在不断改进 Refly，添加令人兴奋的新功能。查看详细路线图，请访问我们的[完整路线图文档](https://docs.refly.ai/zh/roadmap)。

- 🎨 先进的图像、音频和视频生成能力
- 🎨 跨模态内容转换工具
- 💻 高性能桌面客户端，具有更好的资源管理
- 💻 增强的离线功能
- 📚 高级知识组织和可视化工具
- 📚 协作知识库功能
- 🔌 基于 MCP 的第三方插件开发的开放标准
- 🔌 插件市场和开发者 SDK
- 🤖 最少监督下的自主任务 Agent
- 🤖 多代理协作系统
- ⚡️ 复杂 AI 流程的可视化工作流构建器与 API 支持
- ⚡️ 与外部系统的高级集成能力
- 🔒 增强的安全和合规工具
- 🔒 高级团队管理和分析

## 如何使用 ？

- **Cloud**
  - 我们部署了一个 Refly Cloud 版本，允许你 0 配置使用，它提供了和私有化部署版本的全部能力，包括免费使用的 GPT-4o-mini 和限量体验的 GPT-4o 和 Claude-3.5-Sonnet，访问使用 [https://refly.ai/](https://refly.ai/)
- **Self-hosting Refly Community Edition**
  - 通过这份[入门指南](./CONTRIBUTING_CN.md)，快速在您的环境中运行 Refly。更详细的参考和深入说明，请查阅我们的文档。
- **Refly for enterprise / organizations**
  - 请联系我们邮箱 [support@refly.ai](mailto:support@refly.ai)，我们提供私有化部署的解决方案。

## 保持关注

在 GitHub 上给 Refly 星标，即可即时接收新版本发布的通知。

![stay-tuned](https://github.com/user-attachments/assets/877dfeb7-1088-41f1-9176-468d877ded0a)

## 贡献指南

| 错误报告                                                            | 功能请求                                                | 问题/讨论                                                         | ReflyAI 社区                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| [创建错误报告](https://github.com/refly-ai/refly/issues/new/choose) | [提交功能请求](https://github.com/refly-ai/refly/pulls) | [查看 GitHub 讨论](https://github.com/refly-ai/refly/discussions) | [访问 ReflyAI 社区](https://docs.refly.ai/zh/community/contact-us) |
| 有些事情不如预期那样工作                                            | 新功能或改进的想法                                      | 讨论和提出问题                                                    | 一个提问、学习和与他人连接的地方                                   |

欢迎所有开发者、测试人员、技术写作者等加入！我们欢迎各种类型的贡献，您可以查看我们的 [CONTRIBUTING.md](./CONTRIBUTING.md)，并随时查看我们的 [GitHub issues](https://github.com/refly-ai/refly/issues)，大展身手，向我们展示您的才能。

对于错误报告、功能请求和其他建议，您也可以[创建新的 issue](https://github.com/refly-ai/refly/issues/new/choose) 并选择最合适的模板来提供反馈。

如果您有任何问题，欢迎与我们联系。获取更多信息和学习的最佳场所之一是 [ReflyAI 社区](https://docs.refly.ai/zh/community/contact-us)，您可以在那里与其他志同道合的人交流。

## 社区和联系

- [GitHub Discussion](https://github.com/refly-ai/refly/discussions)：最适合分享反馈和提出问题。
- [GitHub Issues](https://github.com/refly-ai/refly/issues)：最适合报告使用 ReflyAI 时遇到的 bug 和提出功能建议。请参阅我们的贡献指南。
- [Discord](https://discord.gg/bWjffrb89h)：最适合分享您的应用程序并与社区互动。
- [X(Twitter)](https://x.com/reflyai)：最适合分享您的应用程序并与社区保持联系。
- [微信或飞书群聊](https://docs.refly.ai/zh/community/contact-us)：最适合与社区成员交流。

## 上游项目

我们还要感谢以下使 ReflyAI 成为可能的开源项目：

1. [LangChain](https://github.com/langchain-ai/langchainjs) - 用于构建 AI 应用的库。
2. [ReactFlow](https://github.com/xyflow/xyflow) - 用于构建可视化工作流的库。
3. [Tiptap](https://github.com/ueberdosis/tiptap) - 用于构建协作编辑器的库。
4. [Ant Design](https://github.com/ant-design/ant-design) - 用于构建 UI 库。
5. [yjs](https://github.com/yjs/yjs) - 为我们的状态管理和数据同步实现提供 CRDTs 的基础支持。
6. [React](https://github.com/facebook/react) - 用于 Web 和原生用户界面的库。
7. [NestJS](https://github.com/nestjs/nest) - 用于构建 Node.js 服务器的库。
8. [Zustand](https://github.com/pmndrs/zustand) - React 的原始且灵活的状态管理。
9. [Vite](https://github.com/vitejs/vite) - 下一代前端工具。
10. [TailwindCSS](https://github.com/tailwindcss/tailwindcss) - 用于撰写精美样式的 CSS 库。
11. [Tanstack Query](https://github.com/tanstack/query) - 用于前端请求处理的库。
12. [Radix-UI](https://github.com/radix-ui) - 用于构建可访问的 React UI 库。
13. [Elasticsearch](https://github.com/elastic/elasticsearch) - 用于构建搜索功能的库。
14. [QDrant](https://github.com/qdrant/qdrant) - 用于构建向量搜索功能的库。
15. [Resend](https://github.com/resend/react-email) - 用于构建邮件发送功能的库。
16. 其他上游依赖。

非常感谢社区提供如此强大而简单的库，使我们能够更专注于产品逻辑的实现。我们希望将来我们的项目也能为大家提供更易用的 Vibe Workflow 平台。

## 安全问题

为保护您的隐私，请避免在 GitHub 上发布安全相关问题。相反，请将您的问题发送至 [support@refly.ai](mailto:support@refly.ai)，我们将为您提供更详细的答复。

## 协议

本代码库采用 [ReflyAI 开源许可证](./LICENSE)，该许可证本质上是 Apache 2.0 许可证加上一些额外限制。
