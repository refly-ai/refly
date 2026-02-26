<img width="1920" height="1080" alt="img_v3_02uh_3e01e906-f84a-4cd8-8b7a-b7274ae8e89g" src="https://github.com/user-attachments/assets/a7857ab5-e8db-4352-acfa-5e42b663aef7" />


# Refly — 首个基于 Vibe Workflow 的开源 Agent Skills 构建器

<p align="right">
  <a href="README.md"><u>English</u></a> · <a href="README_CN.md"><u>中文</u></a>
</p>
<p align="center">
  <a href="https://github.com/refly-ai/refly">
    <img src="https://img.shields.io/github/stars/refly-ai/refly?style=flat&colorA=080f12&colorB=1fa669&logo=github" alt="GitHub stars">
  </a>
  <a href="https://refly.ai/workspace">
    <img src="https://img.shields.io/badge/refly.ai-007bff?style=flat&colorA=080f12&colorB=007bff&logo=google-chrome&logoColor=white" alt="Website">
  </a>
  <a href="https://www.youtube.com/@refly-ai">
    <img src="https://img.shields.io/badge/YouTube-Refly%20AI-FF0000?style=flat&colorA=080f12&colorB=FF0000&logo=youtube&logoColor=white" alt="YouTube">
  </a>
  <a href="https://discord.com/invite/YVuYFjFvRC">
    <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FYVuYFjFvRC%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2" alt="Discord">
  </a>
  <a href="https://github.com/refly-ai/refly-skills">
    <img src="https://img.shields.io/badge/refly--skills-Repo-2ea043?style=flat&colorA=080f12&logo=github" alt="Refly Skills">
  </a><br>
  <a href="https://docs.refly.ai/">
    <img src="https://img.shields.io/badge/docs.refly.ai-Docs-2ea043?style=flat&colorA=080f12&logo=readthedocs" alt="Docs">
  </a>
  <a href="https://deepwiki.com/refly-ai/refly">
    <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-ReflyAI%20License-2ea043?style=flat&colorA=080f12" alt="License">
  </a>
  <a href="https://x.com/reflyai">
    <img src="https://img.shields.io/badge/%40reflyai-black?style=flat&logo=x&labelColor=%23101419&color=%232d2e30" alt="X (formerly Twitter) Follow">
  </a>
</p>

可作为 Lovable 的 API · Lark/飞书 的 Webhook · Claude Code 的 Skills

Skills 不是提示词，而是持久化的基础设施

Refly 是首个用于构建稳定、原子化、版本化 Agent Skills 的开源平台。Skills 是确定性的 Agent 能力——可在工作流、团队和运行时之间复用

---
## Refly Skills

Refly Skills 是 Refly 官方可执行技能仓库

- ⚡ **即开即用**：一键在 Refly 中运行技能
- 🧩 **可复用基础设施**：版本化 Skills，而不是一次性提示词
- 🔌 **随处交付**：导出到 Claude Code 或部署为 API
- 🌍 **社区共建**：导入、Fork 并发布你自己的技能

查看仓库：<a href="https://github.com/refly-ai/refly-skills"><u>Refly技能仓库</u></a> 

**TL;DR**：Refly 将您的企业 SOP 编译为可执行的 Agent Skills；3 分钟构建完成，立即部署。


## 快速开始

**部署 Refly**

- 📘 **[自部署指南](https://docs.refly.ai/community-version/self-deploy/)**  
  *(推荐给开发者)* 使用 Docker 在你自己的服务器上部署 Refly 的分步指南。

- 🔌 **[API 参考](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)**  
  将 Refly 集成到你应用中的完整 API 文档。

> [!TIP]
> 想快速体验不部署？直接打开在线版：<a href="https://refly.ai/workspace"><u>立即尝试</u></a> 
**接下来做什么？**

部署完成后，根据你的使用场景选择路径：

| 我想要… | 从这里开始 | 时间 |
|-------------|-----------|------|
| 🔧 **构建第一个工作流** | [创建工作流](#create-your-first-workflow) | 5 分钟 |
| 🔌 **通过 API 调用工作流** | [API 集成](#use-case-1-api-integration) | 10 分钟 |
| 💬 **连接到 Lark** | [Webhook 设置](#use-case-2-webhook-for-feishu) | 15 分钟 |
| 🤖 **导出到 Claude Code** | [导出技能](#use-case-3-skills-for-claude-code) | 15 分钟 |
| 🦞 **构建 ClawdBot** | [构建 ClawdBot](#build-a-clawdbot) | 20 分钟 |
---

<a id="create-your-first-workflow"></a>
## 创建你的第一个工作流

> [!NOTE]
> 本节假设你已完成 [自部署](https://docs.refly.ai/community-version/self-deploy/)，并且可以通过 `http://localhost:5700` 访问 Refly

**第一步：注册并登录**

1. 在浏览器中打开 `http://localhost:5700`
2. 使用你的邮箱和密码注册
3. 配置你的第一个模型提供方：
   - 点击右上角账号图标 → Settings
   - 添加一个 Provider（如 OpenAI、Anthropic）
   - 添加你的第一个对话模型
   - 将其设置为默认

> 📖 含截图的详细配置说明：[自部署指南](https://docs.refly.ai/community-version/self-deploy/#start-using-refly)

**第二步：创建工作流**

1. 在首页点击 “New Workflow”
2. 选择一个模板或从零开始：
   - **Blank Canvas**：使用可视化节点构建
   - **Vibe Mode**：用自然语言描述你的工作流

**示例 —— 产品调研工作流**：
```text
1. 添加 “Web Search” 节点 —— 搜索产品信息
2. 添加 “LLM” 节点 —— 分析搜索结果
3. 添加 “Output” 节点 —— 格式化报告
4. 连接各节点
5. 点击 “Save”
```

> [!TIP]
> 想最快跑通流程，可以先用Vibe Mode，再从模板迭代完善。

**第三步：测试你的工作流**

1. 点击“Run”按钮
2. 输入测试内容（例如：产品 URL）
3. 实时查看执行结果
4. 如果出现失败，查看日志排查问题

---

<a id="use-case-1-api-integration"></a>
## 使用场景

### 使用场景 1：API 集成

**目标**：通过 REST API 从你的应用中调用工作流

**获取你的 API 凭证**

1. 前往Settings → API Keys
2. 点击“Generate New Key”
3. 复制你的 API Key（请妥善保管！）

**发起你的第一次 API 调用**
```bash
curl -X POST https://your-refly-instance.com/api/v1/workflows/{WORKFLOW_ID}/execute \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "product_url": "https://example.com/product"
    }
  }'
```

**响应**:
```json
{
  "execution_id": "exec_abc123",
  "status": "running"
}
```

**查询执行状态**
```bash
curl https://your-refly-instance.com/api/v1/executions/{execution_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

📖 **完整API文档**: [API文档](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)

---

<a id="use-case-2-webhook-for-feishu"></a>
### 使用场景 2：Lark Webhook

**目标**：当有人在 Lark 中发送消息时触发你的工作流

**前置条件**

- 拥有管理员权限的 Lark 工作区
- 已在 Refly 中创建工作流

**配置步骤**

1. **在 Refly 中**：
   - 打开你的工作流
   - 点击“Settings” → “Triggers”
   - 启用“Webhook Trigger”
   - 复制 Webhook URL

2. **在 飞书 / Lark 中**：
   - 前往 [api.feishu.com/apps](https://open.feishu.cn/app)
   - 创建一个“自定义应用”
   - 进入“事件订阅（Event Subscriptions）”
   - 将 Refly 的 Webhook URL 粘贴到“请求地址（Request URL）”
   - 点击“添加事件（Add Event）”并选择“接收消息（Receive Message）”
   - 前往“版本管理（Version Management）”并发布应用
     

3. **测试**：
   - 在飞书中，通过搜索找到你的机器人并发送消息（例如：`analyze report.pdf`）
   - 工作流将被触发，并通过 Webhook 返回执行结果


> ⚠️ **注意**：详细的 Slack / 飞书集成指南即将推出。目前可参考 [API 参考](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api) 进行 Webhook 相关配置。

---
<a id="use-case-3-skills-for-claude-code"></a>
### 使用场景 3：Claude Code 技能

**目标**：将你的 Refly 工作流导出为 Claude Code Skills

**快速开始**

1. **安装 CLI**
```bash
npm install -g @powerformer/refly-cli
```

2. **安装 Skill**
```bash
# Via Refly CLI
refly skill install <skill-id>

# Via npx
npx skills add refly-ai/<skill-name>
```

3. **发布Skill**
```bash
refly skill publish <skill-id>
```

该技能已全面支持 Claude Code、Cursor 与 MCP 生态工作流，可作为标准化工具被 Agent 直接调用，实现生产级自动执行!

📖 **Skills文档**: [Refly Skills](https://github.com/refly-ai/refly-skills)

---

<a id="build-a-clawdbot"></a>
### 使用场景 4：构建 ClawdBot
📖 **使用教程**：<a href="https://powerformer.feishu.cn/wiki/Gz4swMzn0izknZki3g4coSgvnNe"><u>ClawdBot教程</u></a> 

---

## 为什么选择 Refly？

大多数 AI Agent 在生产环境中失败，是因为它们依赖"Vibe Coding" 的脚本和脆弱的黑盒逻辑。随着生态系统向 Claude Code、AutoGen 和 MCP 等智能体框架发展，瓶颈不再是 LLM 的能力——而是缺乏标准化、可靠的操作能力。

Refly 连接原始 API 和智能 Agent 之间的鸿沟。我们允许您将混乱的业务逻辑编码为结构化、版本控制的 Agent Skills，任何 Agent 都可以 100% 可靠地调用。

停止硬编码工具。在 Refly 的可视化 IDE 中一次性构建模块化Skills，并将其部署为 MCP 服务器、标准 API 或可移植的 SDK，供任何 Agent 框架使用。

## 核心基础设施

Refly 是首个用于创建生产就绪、确定性Skills的开源 Agent Skills 构建器——不仅仅是一次性工作流。

通过将自然语言意图转化为受治理的能力层，Refly 使团队能够在几分钟内交付可靠的 智能体基础设施。

### 使用 Vibe 构建（Copilot 引导的构建器）

用自然语言描述您的业务逻辑，Refly 的模型原生 DSL 将您的意图编译为高性能 Skills。

- **意图驱动构建**：描述一次工作，Refly 将意图转化为确定性、可复用、可组合的 Skills。
- **大规模高效**：我们精简的 DSL 针对 LLM 优化，确保快速执行，与传统工具相比大幅降低 token 成本。
- **3 分钟部署**：3分钟内将静态企业 SOP 快速转化为可上线运行的 Agent Skill。

### 可控执行（可干预运行时）

通过专为确定性可靠性和无限连接而设计的有状态运行时，打破 AI 执行的"黑盒"。

- **可干预运行时执行**：支持在任务执行过程中实时暂停、审计与重定向 Agent 决策逻辑，确保全流程符合企业级操作规范与合规要求。
- **确定性执行保障**：通过强约束业务规则显著降低幻觉风险，并提供完善的失败恢复与容错机制，保障关键流程稳定可靠运行。


### 交付生产（统一 Agent 堆栈）

将 MCP 集成、工具、模型和可复用 Skills 统一到单个执行层，可交付到任何平台。

- **通用交付**：支持导出为 Lovable 的 API 接口、Slack/Lark（飞书）Webhooks，或直接集成为 Claude Code 和 Cursor 的原生工具。
- **定时运行**：在全托管执行环境中，工作流可完成持续、可靠地按时运行。

### 作为资产治理（Skills 注册表）

将脆弱的脚本和手动剧本转化为组织范围内受治理的共享基础设施。

- **中央 Skills 注册表**：安全管理、版本控制和共享 Agent 能力作为可复用的企业资产。
- **团队工作空间协作**：在具有原生版本控制和审计日志的集中环境中共同构建和共享 SOP 剧本。

## 生态系统

Refly 旨在成为您现有企业工具链与下一代智能体运行时之间的通用桥梁。

### 工具与协议（输入）

零摩擦地将您自己的数据和逻辑引入 Refly。

- **3,000+ 原生工具**：与 Stripe、Slack、Salesforce、GitHub 等工业级 API 无缝集成
完整的支持模型和工具提供商列表可在此处找到：[provider-catalog.json](./config/provider-catalog.json)

<img width="1920" height="627" alt="img_v3_02uh_37c05264-a390-4ceb-9a96-efce1a61d1eg" src="https://github.com/user-attachments/assets/dc3eea7b-4dd8-4623-b42c-cf04d49f889c" />


- **MCP 支持**：与任何模型上下文协议服务器完全原生兼容，以扩展超越标准 API 的 Agent 能力
- **私有 Skills 连接器**：通过 Refly 安全接入企业数据库、脚本与内部系统

### Agent 运行时与平台（输出）

将您确定的 Skills 导出到任何工作所需要的环境和平台

<img width="1920" height="1080" alt="img_v3_02uh_2599ba2c-18f0-445d-b95c-aa7da6e41aag" src="https://github.com/user-attachments/assets/3863f4be-af61-474c-a82a-99b7ccd428eb" />


- **AI 编码工具**：原生导出到 Claude Code 和 Cursor，允许 Agent 使用您的版本化 Skills 作为标准化工具
- **应用构建器**：通过有状态、经过认证的 API 为 Lovable 或自定义前端应用提供逻辑支持
- **自动化中心**：部署为智能 webhook，从 Slack 或 Microsoft Teams 触发复杂的 SOP
- **Agent 框架**：直接兼容 AutoGen、Manus 和自定义 LangChain/Python 技术栈

## 为什么团队选择 Refly

### 对于构建者：从 Vibe 到生产

当今大多数 Agent 工具分为两类：

- **工作流构建器**（n8n、Dify）：非常适合编排，但工作流脆弱，仅触发"黑盒"，难以复用。
- **Agent 框架**（LangChain）：强大的原语，但需要大量工程、手动样板代码和高维护成本才能保持运行。

Refly 消除了手动配置的摩擦，为您提供从"vibe"到可用 Agent 工具的最快路径。通过使用我们的精简 DSL，您可以获得 GUI 的速度和代码的精确性。

| 维度 | 传统自动化 <br><sub>(n8n, Dify)</sub> | 代码优先 SDK <br><sub>(LangChain)</sub> | **Refly Skills** |
| :--- | :--- | :--- | :--- |
| **交互深度** | 仅触发 <br><sub>黑盒</sub> | 程序化 <br><sub>代码更改</sub> | **可干预运行时**<br><sub>运行中引导逻辑</sub> |
| **构建方式** | 手动 API 接线和 JSON | 手动 Python/TS 样板 | **Copilot 引导**<br><sub>描述意图 → 生成Skills</sub> |
| **恢复机制** | 失败 = 从头重启 | 调试 → 重新部署 → 重新运行 | **热修复**<br><sub>执行期间修复工作流</sub> |
| **可移植性** | 难以跨环境复用 | 框架特定 | **随处导出**<br><sub>到 Claude Code、Cursor、Manus</sub> |
| **部署方式** | 有限的函数工具 | 自定义微服务 | **生产就绪**<br><sub>有状态、经过验证的 API</sub> |

### 对于企业：可扩展的Skills治理

n8n 等工作流工具非常适合基本连接，LangChain 等框架提供强大的原语——但都无法提供企业 Agent 基础设施所需的受治理、生产就绪的能力层。

Refly 充当 Agent Skills 构建器，提供在整个组织中部署 AI 所需的治理和可靠性基础设施。

| 企业需求 | 传统工具 <br><sub>(工作流优先)</sub> | SDK <br><sub>(代码优先)</sub> | **Refly (Skills OS)** |
| :--- | :--- | :--- | :--- |
| **治理与复用** | 模板被复制并<br><sub>针对每个实例重新配置</sub> | 无原生注册表<br><sub>用于共享逻辑</sub> | **中央Skills 注册表**<br><sub>版本化、可共享的能力资产</sub> |
| **运营可靠性** | 基于触发<br><sub>有限恢复</sub> | 需要自定义处理 | **有状态运行时**<br><sub>具有验证 + 故障恢复</sub> |
| **SOP 执行** | 工作流在<br><sub>副本间漂移</sub> | 依赖手动<br><sub>工程纪律</sub> | **SOP 级确定性Skills**<br><sub>可控执行</sub> |
| **部署方式** | 实例绑定工作流 | 代码由每个<br><sub>团队手动维护</sub> | **本地优先、可私有部署**<br><sub>开源基础设施</sub> |
| **总拥有成本 (TCO)** | 开销随<br><sub>工作流复杂性增长</sub> | 高工程<br><sub>维护成本</sub> | **精简 DSL**<br><sub>降低 token 开销</sub> |

## 贡献

对于希望贡献代码的人，请参阅我们的[贡献指南](CONTRIBUTING_CN.md)。同时，请考虑通过在社交媒体、活动和会议上分享 Refly 来支持我们。

> 我们正在寻找贡献者帮助将 Refly 翻译成普通话或英语以外的语言。如果您有兴趣提供帮助，请参阅 [贡献指南](CONTRIBUTING_CN.md) 了解更多信息。

## 社区

与 Refly 社区建立联系：

- 🌟 **[在 GitHub 上给我们加星](https://github.com/refly-ai/refly)**：这有助于我们持续构建！
- 💬 **[Discord](https://discord.com/invite/YVuYFjFvRC)**: 加入我们的社区
- 🐦 **[Twitter](https://x.com/reflyai)**: 关注我们的Twitter
- 📖 **[文档](https://docs.refly.ai)**: 完整指南和教程
- 🐛 **[问题](https://github.com/refly-ai/refly/issues)**: 报告 Bug 或提出功能需求

## 加入我们

加入社区获取支持、分享经验并与其他 Refly 用户交流：
https://docs.refly.ai/community/contact-us

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=refly-ai/refly&type=Date)](https://star-history.com/#refly-ai/refly&Date)

## 许可证

本仓库采用 [ReflyAI 开源许可证](LICENSE)，本质上是带有一些额外限制的 Apache 2.0 许可证。
