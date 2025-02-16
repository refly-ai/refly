![refly-cover](https://github.com/user-attachments/assets/2930c555-09a7-4ea2-a18a-2b1d8a7ef4ae)

<div align="center">

<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.refly.ai" target="_blank">Refly.AI</a><br>
    </b>
    ⭐️  AI Native 内容创作引擎 ⭐️ <br>
</h1>

Refly 是一个开源的 AI 原生创作引擎。Refly 直观的自由画布界面集成了多线程对话、RAG 检索流程、上下文记忆、智能搜索和 AI 文档编辑等功能，让您轻松地将创意转化为完整作品。

[🚀 Refly 网页剪存 Chrome 插件发布! ⚡️! ](https://docs.refly.ai/guide/chrome-extension)

[Refly Cloud](https://refly.ai/) · [Self-hosting](https://refly.ai/) · [Forum](https://github.com/refly-ai/refly/discussions) · [Discord](https://discord.gg/bWjffrb89h) · [Twitter](https://x.com/reflyai) · [Documentation](https://docs.refly.ai/)

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
cp .env.example .env # 确保所有必须的环境变量均已设置
docker compose up -d
```

访问 [http://localhost:5700](http://localhost:5700/) 开始使用 ReflyAI。

### 本地开发

查看 [CONTRIBUTING](./CONTRIBUTING_CN.md) 了解更多信息。

## 关键特性

1. **多线程对话** ：Refly 采用创新的多线程对话机制，让您能够自由切换多个独立对话主题，实现更流畅自然的思维发散与深入探讨，有效突破传统对话的局限性，在人机协作过程中构建复杂且有效的 Agentic Workflow。

https://github.com/user-attachments/assets/9dbff21f-cf01-42e7-a76f-eb16b1a11c97

<br />

2. **AI 驱动的技能** ：借助 AI 模型驱动，输入问题后，可灵活选取画布中的任一节点作为上下文，生成新的节点内容，包括 AI 全网搜索、AI 知识库搜索、AI 推荐提问和 AI 文档智能生成等，将 Perplexity AI、Standford Storm 等能力整合在一处工作空间。

https://github.com/user-attachments/assets/be4e18f9-07bb-4b91-90a5-ee2c27bfbf6f

<br />

3. **上下文** ：为每次对话提供精确的临时知识库支持，确保 AI 模型能准确理解和回应您的问题。与 Cursor 类似，您可以灵活选择画布中的任意节点或添加引用作为上下文。

https://github.com/user-attachments/assets/fd95abae-8090-4a6f-a67b-99246568f5d7

<br />

4. **知识库整合** ：支持导入多样化的外部资源，根据需求智能整合到画布中，构建完整的知识体系，打造个性化的思维空间，还能通过 RAG 等智能检索技术进行语义提问，是真正的第二大脑。

https://github.com/user-attachments/assets/263425a8-ed18-4765-9c6a-020fcd867ab2

<br />

5. **引文** ：支持从各类资源、文档、备忘录或技能输出中灵活选取内容，一键添加为上下文引用，提升对话的准确性和深度。

https://github.com/user-attachments/assets/27725ad6-cca2-490a-ba50-59a9577dd174

<br />

6. **AI 文档编辑** ：除提供强大的 Markdown 实时编辑功能外，支持智能选中文档内容，根据您的需求进行 AI 辅助的精准修改和润色，提供给您一个类 Notion 的强大 AI 编辑器。

https://github.com/user-attachments/assets/9f11b8eb-dd9d-4691-aca1-d3f11ff801ab

<br />

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

非常感谢社区提供如此强大而简单的库，使我们能够更专注于产品逻辑的实现。我们希望将来我们的项目也能为大家提供更易用的 AI Native 内容创作引擎。

## 安全问题

为保护您的隐私，请避免在 GitHub 上发布安全相关问题。相反，请将您的问题发送至 [support@refly.ai](mailto:support@refly.ai)，我们将为您提供更详细的答复。

## 协议

本代码库采用 [ReflyAI 开源许可证](./LICENSE)，该许可证本质上是 Apache 2.0 许可证加上一些额外限制。
