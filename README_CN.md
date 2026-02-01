<img width="1280" height="731" alt="image" src="https://github.com/user-attachments/assets/9ee376d9-946d-4c11-96c5-740533b4b124" />

<div align="center">

[**English**](./README.md) | **中文**

</div>
Refly — 首个基于 Vibe Workflow 的开源 Agent 技能构建器

可作为 Lovable 的 API · Slack 的 Webhook · Claude Code 的 Skills · Refly 中的 SOP 手册

技能不是提示词，而是持久化的基础设施。

Refly 是首个用于构建稳定、原子化、版本化 agent 技能的开源平台。技能是确定性的 agent 能力——可在工作流、团队和运行时之间复用。

**简而言之**：Refly 将您的企业 SOP 编译为可执行的 agent 技能。3 分钟构建完成，随处部署。

## 为什么选择 Refly？

大多数 AI Agent 在生产环境中失败，是因为它们依赖"Vibe 编码"的脚本和脆弱的黑盒逻辑。随着生态系统向 Claude Code、AutoGen 和 MCP 等 agentic 框架发展，瓶颈不再是 LLM——而是缺乏标准化、可靠的操作能力。

Refly 连接原始 API 和智能 agent 之间的鸿沟。我们允许您将混乱的业务逻辑编码为结构化、版本控制的 Agent 技能，任何 agent 都可以 100% 可靠地调用。

停止硬编码工具。在 Refly 的可视化 IDE 中一次性构建模块化技能，并将其部署为 MCP 服务器、标准 API 或可移植的 SDK，供任何 agent 框架使用。

## 核心基础设施

Refly 是首个用于创建生产就绪、确定性技能的开源 agent 技能构建器——不仅仅是一次性工作流。

通过将自然语言意图转化为受治理的能力层，Refly 使团队能够在几分钟内交付可靠的 agentic 基础设施。

### 使用 Vibe 构建（Copilot 引导的构建器）

用自然语言描述您的业务逻辑，Refly 的模型原生 DSL 将您的意图编译为高性能技能。

- **意图驱动构建**：描述一次工作，Refly 将意图转化为确定性、可复用、可组合的技能。
- **大规模高效**：我们精简的 DSL 针对 LLM 优化，确保快速执行，与传统工具相比大幅降低 token 成本。
- **3 分钟部署**：在 3 分钟内从静态企业 SOP 过渡到生产就绪的编译 agent 技能。

### 可控执行（可干预运行时）

通过专为确定性可靠性和无限连接而设计的有状态运行时，打破 AI 执行的"黑盒"。

- **可干预运行时**：与仅触发工具不同，Refly 允许您在运行中暂停、审计和重新引导 agent 逻辑，以确保 100% 的运营合规性。
- **确定性保证**：在受治理的执行层内实施严格的业务规则，最大限度减少幻觉并处理故障恢复。

### 交付生产（统一 Agent 堆栈）

将 MCP 集成、工具、模型和可复用技能统一到单个执行层，可交付到任何平台。

- **通用交付**：将您的技能导出为 Lovable 的认证有状态 API、Slack 的智能 webhook，或 Claude Code 和 Cursor 的原生工具。
- **稳定调度**：通过托管执行和可预测行为，可靠地按计划运行工作流，用于长期运行的自动化。

### 作为资产治理（技能注册表）

将脆弱的脚本和手动手册转化为组织范围内受治理的共享基础设施。

- **中央技能注册表**：安全管理、版本控制和共享 agent 能力作为可复用的企业资产。
- **团队工作空间协作**：在具有原生版本控制和审计日志的集中环境中共同构建和共享 SOP 手册。

## 生态系统

Refly 旨在成为您现有企业工具链与下一代 agentic 运行时之间的通用桥梁。

### 工具与协议（输入）

零摩擦地将您自己的数据和逻辑引入 Refly。

- **3,000+ 原生工具**：与 Stripe、Slack、Salesforce、GitHub 等工业级 API 无缝集成。
完整的支持模型和工具提供商列表可在此处找到。

<img width="1280" height="272" alt="image" src="https://github.com/user-attachments/assets/30475454-1bb7-41bd-b6d8-6f799bb30f79" />

- **MCP 支持**：与任何模型上下文协议服务器完全原生兼容，以扩展超越标准 API 的 agent 能力。
- **私有技能连接器**：通过 Refly 运行时安全运行和管理数千个内部技能——连接到您的数据库、脚本和系统。

### Agent 运行时与平台（输出）

将您的确定性技能导出到工作发生的任何环境。

<img width="1280" height="853" alt="image" src="https://github.com/user-attachments/assets/93053319-8903-4908-b2d0-4ae283ecc295" />

- **AI 编码工具**：原生导出到 Claude Code 和 Cursor，允许 agent 使用您的版本化技能作为标准化工具。
- **应用构建器**：通过有状态、经过认证的 API 为 Lovable 或自定义前端应用提供逻辑支持。
- **自动化中心**：部署为智能 webhook，从 Slack 或 Microsoft Teams 触发复杂的 SOP。
- **Agent 框架**：直接兼容 AutoGen、Manus 和自定义 LangChain/Python 技术栈。

## 为什么团队选择 Refly

### 对于构建者：从 Vibe 到生产

当今大多数 agent 工具分为两类：

- **工作流构建器**（n8n、Dify）：非常适合编排，但工作流脆弱，仅触发"黑盒"，难以复用。
- **Agent 框架**（LangChain）：强大的原语，但需要大量工程、手动样板代码和高维护成本才能保持运行。

Refly 消除了手动配置的摩擦，为您提供从"vibe"到可用 agent 工具的最快路径。通过使用我们的精简 DSL，您可以获得 GUI 的速度和代码的精确性。

| 维度 | 传统自动化 <br><sub>(n8n, Dify)</sub> | 代码优先 SDK <br><sub>(LangChain)</sub> | **Refly 技能** |
| :--- | :--- | :--- | :--- |
| **交互深度** | 仅触发 <br><sub>黑盒</sub> | 程序化 <br><sub>代码更改</sub> | **可干预运行时**<br><sub>运行中引导逻辑</sub> |
| **构建方式** | 手动 API 接线和 JSON | 手动 Python/TS 样板 | **Copilot 引导**<br><sub>描述意图 → 生成技能</sub> |
| **恢复机制** | 失败 = 从头重启 | 调试 → 重新部署 → 重新运行 | **热修复**<br><sub>执行期间修复工作流</sub> |
| **可移植性** | 难以跨环境复用 | 框架特定 | **随处导出**<br><sub>到 Claude Code、Cursor、Manus</sub> |
| **部署方式** | 有限的函数工具 | 自定义微服务 | **生产就绪**<br><sub>有状态、经过验证的 API</sub> |

### 对于企业：可扩展的技能治理

n8n 等工作流工具非常适合基本连接，LangChain 等框架提供强大的原语——但都无法提供企业 agent 基础设施所需的受治理、生产就绪的能力层。

Refly 充当 Agent 技能构建器，提供在整个组织中部署 AI 所需的治理和可靠性基础设施。

| 企业需求 | 传统工具 <br><sub>(工作流优先)</sub> | SDK <br><sub>(代码优先)</sub> | **Refly (技能操作系统)** |
| :--- | :--- | :--- | :--- |
| **治理与复用** | 模板被复制并<br><sub>针对每个实例重新配置</sub> | 无原生注册表<br><sub>用于共享逻辑</sub> | **中央技能注册表**<br><sub>版本化、可共享的能力资产</sub> |
| **运营可靠性** | 基于触发<br><sub>有限恢复</sub> | 需要自定义处理 | **有状态运行时**<br><sub>具有验证 + 故障恢复</sub> |
| **SOP 执行** | 工作流在<br><sub>副本间漂移</sub> | 依赖手动<br><sub>工程纪律</sub> | **SOP 级确定性技能**<br><sub>可控执行</sub> |
| **部署方式** | 实例绑定工作流 | 代码由每个<br><sub>团队手动维护</sub> | **本地优先、可私有部署**<br><sub>开源基础设施</sub> |
| **总拥有成本 (TCO)** | 开销随<br><sub>工作流复杂性增长</sub> | 高工程<br><sub>维护成本</sub> | **精简 DSL**<br><sub>降低 token 开销</sub> |

## 快速开始

https://github.com/refly-ai/refly/tree/main/docs/en/guide/api

## 文档

- **[📖 自部署指南](/docs/self-deploy.md)**  
  *(推荐开发者使用)* 使用 Docker 在您自己的服务器上部署 Refly 的分步指南。

## 我们迄今为止构建的一切

如果没有整合我们的历程，这一段也可以不要

## 贡献

对于希望贡献代码的人，请参阅我们的[贡献指南](https://github.com/langgenius/dify/blob/main/CONTRIBUTING.md)。同时，请考虑通过在社交媒体、活动和会议上分享 Refly 来支持我们。

> 我们正在寻找贡献者帮助将 Refly 翻译成普通话或英语以外的语言。如果您有兴趣提供帮助，请参阅 <u><mark style="background: yellow">xxx</mark></u> 了解更多信息。

## 社区

与 Refly 社区建立联系：

- 🌟 **[在 GitHub 上给我们加星](https://github.com/refly-ai/refly)**：这有助于我们持续构建！
- 💬 **Discord/Slack**：加入我们的聊天... 
- 🐦 **Twitter**：关注我们... 

## 许可证

本仓库采用 [ReflyAI 开源许可证](https://github.com/refly-ai/refly/blob/main/LICENSE)，本质上是带有一些额外限制的 Apache 2.0 许可证。

需要企业许可证
Apache License 2.0

