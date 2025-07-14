![refly-cover](https://github.com/user-attachments/assets/2930c555-09a7-4ea2-a18a-2b1d8a7ef4ae)

<div align="center">

<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.refly.ai" target="_blank">Refly.AI</a><br>
    </b>
      开源 'Vibe' AI工作台  <br>
</h1>

Refly 是一个基于前沿 A2A 和 MCP 协议的开源 Vibe AI工作台，集成了全球顶尖的 AI 模型。无论您有一个创意想法、复杂需求，还是仅仅是一个模糊的概念，Refly 都能帮您将其转化为可复用、可分享的 AI 工作流或应用。这样您就可以快速构建演示原型，或者通过 AI 的协助来深入探索和思考您的想法。

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

## 核心特性

<details>
<summary>🧵 多线程对话系统</summary>

想象一下，您可以同时进行多个独立的对话，每个对话都有自己的上下文和记忆。Refly 的多线程对话系统让这成为可能。它基于创新的多线程架构，能够并行管理多个会话上下文，通过高效的状态管理和智能的上下文切换，实现复杂的 Agentic Workflow，彻底突破传统对话模型的限制。

- 支持多线程对话，每个对话拥有独立上下文与记忆
- 创新多线程架构，能并行管理多个会话
- 高效状态管理与智能上下文切换
- 实现复杂 Agentic Workflow，突破传统对话模型限制

</details>

<details>
<summary>🤖 多模型集成框架</summary>

我们深知不同的 AI 模型各有优势，因此 Refly 集成了 13+ 主流大语言模型，包括 DeepSeek R1、Claude 3.5 Sonnet、Google Gemini 2.0、OpenAI O3-mini 等。系统支持模型混合调度和并行处理，您可以灵活切换不同模型，享受统一的对话体验。更重要的是，多个模型可以协同工作，为您提供更全面的知识支持。

- 支持 13+ 主流大语言模型集成（如 DeepSeek R1、Claude 3.5 Sonnet、Google Gemini 2.0、OpenAI O3-mini 等）
- 支持模型混合调度与并行处理
- 可灵活切换不同模型，体验统一对话
- 多模型协同工作，提供更全面知识支持

</details>

<details>
<summary>🎨 多模态处理能力</summary>

Refly 不仅理解文字，还能处理各种类型的文件。我们支持 PDF、DOCX、RTF、TXT、MD、HTML、EPUB 等 7+ 种文档格式，以及 PNG、JPG、JPEG、BMP、GIF、SVG、WEBP 等主流图像格式。通过智能批处理功能，您可以对画布中的多个元素进行批量选择和 AI 分析，大大提升工作效率。

- 支持多模态内容处理，包括文本、文档（PDF、DOCX、RTF、TXT、MD、HTML、EPUB）和主流图片格式（PNG、JPG、JPEG、BMP、GIF、SVG、WEBP）
- 提供智能批处理功能，可对画布中多个元素进行批量选择与 AI 分析
- 显著提升多类型内容的处理效率和工作流自动化能力

</details>

<details>
<summary>⚡️ AI 驱动的技能系统</summary>

我们集成了 Perplexity AI、Stanford Storm 等先进能力，为您提供强大的 AI 技能支持。系统可以进行智能全网搜索与信息聚合，基于向量数据库进行精准的知识检索，智能改写问题并提供推荐，还能辅助您生成专业的文档工作流。

- 集成 Perplexity AI、Stanford Storm 等先进 AI 能力
- 支持智能全网搜索与信息聚合
- 基于向量数据库实现精准知识检索
- 智能改写问题并提供推荐
- 辅助生成专业文档工作流

</details>

<details>
<summary>🔍 上下文管理系统</summary>

理解上下文是 AI 工作的关键。Refly 的上下文管理系统能够精确构建临时知识库，提供灵活的节点选择机制，建立多维度的上下文关联。就像 Cursor 编辑器一样，系统能够智能理解您的意图，为您提供最相关的上下文支持。

- 支持临时知识库的精确构建
- 灵活的节点选择机制
- 多维度上下文关联能力
- 智能理解用户意图，提供相关上下文支持

</details>

<details>
<summary>📚 知识库引擎</summary>

您的知识就是您的财富。Refly 的知识库引擎支持多源异构数据导入，基于 RAG 的语义检索架构让知识查找变得简单高效。系统还能智能构建知识图谱，为您打造个性化的知识空间，让知识管理变得轻松愉快。

- 支持多源异构数据导入
- 基于 RAG 的语义检索架构，查找高效
- 智能构建知识图谱
- 个性化知识空间，轻松管理知识

</details>

<details>
<summary>✂️ 智能内容采集</summary>

在信息爆炸的时代，高效的内容采集至关重要。Refly 支持从 Github、Medium、Wikipedia、Arxiv 等主流平台一键采集内容，智能解析和结构化处理，自动分类和标签，并深度集成到您的知识库中，让信息获取变得前所未有的简单。

- 支持主流平台内容一键采集（如 Github、Medium、Wikipedia、Arxiv 等）
- 智能解析与结构化处理采集内容
- 自动分类与标签，深度集成知识库
- 提升信息获取效率，简化采集流程

</details>

<details>
<summary>📌 引用系统</summary>

好的想法需要好的引用。Refly 的引用系统支持灵活的多源内容引用，智能的上下文关联，一键生成引用，并提供完整的引用溯源支持。让您的每一个观点都有据可依，每一个结论都有源可查。

- 支持灵活多源内容引用
- 智能上下文关联与一键生成引用
- 完整的引用溯源支持
- 让每个观点和结论都有据可依

</details>

<details>
<summary>✍️ AI 增强编辑器</summary>

写作不应该是一个人的战斗。Refly 的 AI 增强编辑器提供实时 Markdown 渲染，AI 辅助内容优化，智能内容分析，带来类似 Notion 的流畅编辑体验。让 AI 成为您的写作伙伴，共同创作出更好的内容。

- 实时 Markdown 渲染，所见即所得
- AI 辅助内容优化与智能分析
- 流畅的编辑体验，支持多种格式
- 类 Notion 的协作与写作体验

</details>

<details>
<summary>🎨 代码生成引擎</summary>

从想法到代码，只需要一瞬间。Refly 的代码生成引擎能够生成 HTML、SVG、Mermaid 图表和 React 应用，智能优化代码结构，支持组件化架构，并提供实时代码预览和调试功能。让编程变得更加直观和高效。

- 支持多种代码类型生成（HTML、SVG、Mermaid、React 应用等）
- 智能优化代码结构，提升可维护性
- 支持组件化开发模式
- 提供实时代码预览与调试功能
- 简化从创意到代码的转化流程

</details>

<details>
<summary>🌐 网站可视化引擎</summary>

看到即所得。Refly 的网站可视化引擎提供交互式网页渲染和预览，支持复杂概念的可视化表达，动态生成 SVG 和图表，提供响应式设计模板，实现实时网站原型设计，并集成现代 Web 框架。让网站开发变得像搭积木一样简单。

- 交互式网页渲染与实时预览
- 支持复杂概念的可视化表达
- 动态生成 SVG 和图表
- 提供响应式设计模板
- 实现实时网站原型设计
- 集成现代 Web 框架

</details>

## 🛣️ Refly 产品路线图

我们持续迭代 Refly，致力于为用户带来更多创新与实用功能。以下是我们正在规划和开发中的主要特性：

| 类别         | 功能描述                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| 🎨 生成能力   | - 先进的图像、音频和视频生成<br>- 跨模态内容转换工具                    |
| 💻 客户端     | - 高性能桌面客户端（更优资源管理）<br>- 增强的离线功能                  |
| 📚 知识管理   | - 高级知识组织与可视化工具<br>- 协作知识库功能                          |
| 🔌 插件生态   | - 基于 MCP 的第三方插件开放标准<br>- 插件市场与开发者 SDK                |
| 🤖 智能体     | - 最少监督的自主任务 Agent<br>- 多代理协作系统                           |
| ⚡️ 工作流     | - 复杂 AI 流程可视化工作流构建器与 API 支持<br>- 与外部系统的高级集成能力 |
| 🔒 安全与团队 | - 增强的安全与合规工具<br>- 高级团队管理与分析                          |

详细路线图请访问：[完整路线图文档](https://docs.refly.ai/zh/roadmap)

## 如何使用

Refly 提供多种使用方式，满足不同用户和团队的需求：

- **云端体验（Cloud）**
  - 无需配置，直接访问 [https://refly.ai/](https://refly.ai/)，即可免费体验 Refly Cloud 版本。该版本具备与私有化部署一致的全部功能，内置 GPT-4o-mini（免费）及 GPT-4o、Claude-3.5-Sonnet（限量体验）。
- **自托管（Self-hosting Community Edition）**
  - 按照[入门指南](./CONTRIBUTING_CN.md)快速在本地或服务器部署 Refly。详细部署步骤、环境变量说明及常见问题请参考[官方文档](https://docs.refly.ai/zh/)。
- **企业/组织版（Enterprise/Organizations）**
  - 如需企业级私有化部署、定制化支持或大规模协作，请发送邮件至 [support@refly.ai](mailto:support@refly.ai) 联系我们获取专属解决方案。

## 快速开始

<div align="center">

在安装 ReflyAI 之前，请确保您的机器满足以下最低系统要求：

| 组件 | 最低要求 |
|------|----------|
| **CPU** | 2 核 |
| **内存** | 4GB |

</div>

---

### 🐳 Docker 部署

**推荐方式** - 使用 Docker 快速部署功能完整的 ReflyAI（我们的团队正在努力更新到最新版本）：

```bash
cd deploy/docker

cp ../../apps/api/.env.example .env  # 确保所有必须的环境变量均已设置

docker compose up -d
```
**访问地址：**
- Docker: [http://localhost:5700](http://localhost:5700/)
### ☸️ Kubernetes 部署

**企业级部署** - 在 K8s 集群中部署 ReflyAI：

```bash
cd deploy/kubernetes

kubectl apply -f refly-deployment.yaml
```

**访问地址：**
- Kubernetes: `http://${HOST_IP}:30001`

### 💻 本地开发

**开发者模式** - 参与项目开发：

查看 [CONTRIBUTING](./CONTRIBUTING_CN.md) 了解更多信息。

---

📖 **详细部署指南：** [部署教程](https://docs.refly.ai/zh/guide/self-deploy)


## 保持关注

在 GitHub 上给 Refly 星标，即可即时接收新版本发布的通知。

![stay-tuned](https://github.com/user-attachments/assets/877dfeb7-1088-41f1-9176-468d877ded0a)

## 贡献指南

<div class="w-full my-6">
  <table class="w-full text-center border border-gray-200 rounded-lg overflow-hidden">
    <thead class="bg-gray-50">
      <tr>
        <th class="py-3 px-2 font-semibold text-gray-700">错误报告</th>
        <th class="py-3 px-2 font-semibold text-gray-700">功能请求</th>
        <th class="py-3 px-2 font-semibold text-gray-700">问题/讨论</th>
        <th class="py-3 px-2 font-semibold text-gray-700">ReflyAI 社区</th>
      </tr>
    </thead>
    <tbody class="bg-white">
      <tr>
        <td class="py-2 px-2 border-t border-gray-200">
          <a href="https://github.com/refly-ai/refly/issues/new/choose" class="text-blue-600 hover:underline" target="_blank">创建错误报告</a>
        </td>
        <td class="py-2 px-2 border-t border-gray-200">
          <a href="https://github.com/refly-ai/refly/pulls" class="text-blue-600 hover:underline" target="_blank">提交功能请求</a>
        </td>
        <td class="py-2 px-2 border-t border-gray-200">
          <a href="https://github.com/refly-ai/refly/discussions" class="text-blue-600 hover:underline" target="_blank">查看 GitHub 讨论</a>
        </td>
        <td class="py-2 px-2 border-t border-gray-200">
          <a href="https://docs.refly.ai/zh/community/contact-us" class="text-blue-600 hover:underline" target="_blank">访问 ReflyAI 社区</a>
        </td>
      </tr>
      <tr class="text-sm text-gray-500">
        <td class="py-1 px-2">有些事情不如预期那样工作</td>
        <td class="py-1 px-2">新功能或改进的想法</td>
        <td class="py-1 px-2">讨论和提出问题</td>
        <td class="py-1 px-2">提问、学习、与他人连接</td>
      </tr>
    </tbody>
  </table>
</div>

欢迎开发者、测试人员、技术写作者等各类贡献者加入 Refly！我们鼓励各种形式的贡献。您可以查阅 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细贡献流程，也可以随时浏览 [GitHub issues](https://github.com/refly-ai/refly/issues) 参与讨论或提交建议。

如需报告错误、请求新功能或提出其他建议，请[创建新的 issue](https://github.com/refly-ai/refly/issues/new/choose)，并选择合适的模板以便我们更好地跟进。

如有疑问，欢迎随时联系我们。获取更多信息、交流学习的最佳场所是 [ReflyAI 社区](https://docs.refly.ai/zh/community/contact-us)，与志同道合的伙伴一起成长。

## 社区和联系

<table>
  <tr>
    <td align="center" class="p-4">
      <a href="https://github.com/refly-ai/refly/discussions" class="flex flex-col items-center">
        <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/github.svg" alt="GitHub Discussion" width="32" height="32" class="mx-auto mb-2" style="filter: invert(16%) sepia(12%) saturate(748%) hue-rotate(180deg) brightness(1.2);" />
        GitHub Discussion
      </a>
      <br/>
      <span class="text-gray-500">想法交流、反馈建议、问题讨论</span>
    </td>
    <td align="center" class="p-4">
      <a href="https://github.com/refly-ai/refly/issues" class="flex flex-col items-center">
        <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/github.svg" alt="GitHub Issues" width="32" height="32" class="mx-auto mb-2" style="filter: invert(16%) sepia(12%) saturate(748%) hue-rotate(180deg) brightness(1.2);" />
        GitHub Issues
      </a>
      <br/>
      <span class="text-gray-500">Bug 报告、功能建议、改进意见</span>
    </td>
    <td align="center" class="p-4">
      <a href="https://discord.gg/bWjffrb89h" class="flex flex-col items-center">
        <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/discord.svg" alt="Discord" width="32" height="32" class="mx-auto mb-2" style="filter: invert(41%) sepia(99%) saturate(749%) hue-rotate(202deg) brightness(1.1);" />
        Discord 社区
      </a>
      <br/>
      <span class="text-gray-500">实时互动、技术交流、项目展示</span>
    </td>
    <td align="center" class="p-4">
      <a href="https://x.com/reflyai" class="flex flex-col items-center">
        <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/x.svg" alt="X (Twitter)" width="32" height="32" class="mx-auto mb-2" style="filter: invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(1.2);" />
        X (Twitter)
      </a>
      <br/>
      <span class="text-gray-500">关注动态、产品更新、官方资讯</span>
    </td>
    <td align="center" class="p-4">
      <a href="https://docs.refly.ai/zh/community/contact-us" class="flex flex-col items-center">
        <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/wechat.svg" alt="微信/飞书交流群" width="32" height="32" class="mx-auto mb-2" style="filter: invert(56%) sepia(97%) saturate(749%) hue-rotate(75deg) brightness(1.1);" />
        微信/飞书交流群
      </a>
      <br/>
      <span class="text-gray-500">中文社区、伙伴交流、获取支持</span>
    </td>
  </tr>
</table>

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

## 感谢每一位推动 Refly 前进的伙伴
<div class="w-full flex justify-center my-8">
  <a
    href="https://github.com/refly-ai/refly/graphs/contributors"
    target="_blank"
    class="group block w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl"
    aria-label="Refly Contributors"
  >
    <div class="flex flex-col items-center py-8 px-6">
      <img
        src="https://contrib.rocks/image?repo=refly-ai/refly"
        alt="Refly Contributors"
        class="w-48 h-16 object-contain rounded-lg shadow mb-4 group-hover:scale-105 transition-transform"
    </div> 
  </a>
</div>
