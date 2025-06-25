# MCP Store 入驻指南

欢迎加入 Refly Vibe Workflow 生态！MCP Store 的入驻不仅仅是一个技术过程，更是一个开放、规范且充满创新精神的生态建设旅程。 我们致力于通过标准化、透明的流程，让更多优秀的工具和服务提供商能够无缝接入。

---

## 🚀 准入标准

为了确保生态的高质量与安全性，所有希望入驻 MCP Store 的工具都需要满足以下准入标准：

- 技术规范：必须基于 Model Context Protocol (MCP) 协议实现。
- 安全性：需要通过我们的安全审计，确保不存在数据泄露风险。
- 功能性：提供一组清晰、明确且可复用的工具集。
- 文档完整：提供详细的 API 文档和最终用户使用说明。

## 📝 上线流程详解

我们设计了一个开放且规范的提交流程，帮助您的服务从创意走向现实。请遵循以下步骤：

1. Fork 官方仓库
首先，请访问我们的官方 [GitHub 仓库](https://github.com/refly-ai/refly)，并将其 Fork 到您个人或组织的账号下。

2. 修改配置文件
在您 Fork 的仓库中，找到并编辑 refly/config/mcp-catalog.json 文件，添加您的服务信息。

字段说明：

```json
{
  "name": "您的MCP服务名称",
  "icon": "您的服务图标URL (建议使用SVG或PNG)",
  "description": "对您的服务进行简明扼要的介绍",
  "type": ["streamable", "sse"],
  "url": "您的MCP服务接入点URL",
  "auth": {
    "method": "鉴权方式 (例如: 'bearer', 'api_key')",
    "details": "鉴权相关的配置或说明"
  },
  "docs": {
    "link": "您的服务详细接入文档链接"
  }
}
```

3. 提交 Pull Request (PR)
  1. 在您 Fork 的仓库中，基于 main 分支创建一个新的分支（例如 feat/add-my-mcp-service）。
  2. 提交您修改后的 mcp-catalog.json 文件。
  3. 向我们的官方仓库 refly-ai/refly 的 main 分支发起一个 Pull Request。
  4. 在 PR 描述中，请清晰地说明以下内容：
    - 服务功能：您的 MCP 服务解决了什么问题。
    - 技术细节：简述接入的技术要点。
    - 生态价值：您的服务能为 Refly 生态带来什么价值。

4. Refly 团队审核
- Refly 团队在收到您的 PR 后，会进行代码审查（Code Review）。
- 我们将评估您的 MCP 服务技术实现是否符合协议规范，并检查其安全性与兼容性。
- 如果需要修改，我们会在 PR 中与您进行沟通。

5. 合并与发布
- 一旦您的 PR 通过审核，Refly 团队会将其合并到主分支。
- 合并后将自动触发 Catalog 配置文件的发布流程，您的服务将被更新到 MCP Store 目录中。
- 我们通常每周进行一次定期发布。

6. 持续同步
发布后，Refly 的平台会自动拉取最新的配置文件，用户将可以在 MCP Store 中发现并使用您的新服务。
