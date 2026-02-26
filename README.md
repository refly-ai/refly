
<img width="2880" height="1620" alt="the first open-source agent skills builder" src="https://github.com/user-attachments/assets/2609adbb-c8db-4ca4-8404-12eb32d19cf1" />


# Refly — Agent Skills Builder Powered by Vibe Workflow
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


[APIs for Lovable](#use-case-1-api-integration) · [Webhooks for Lark/Feishu](#use-case-2-webhook-for-lark-feishu) · [Skills for Claude Code](#use-case-3-skills-for-claude-code) · [Build Clawdbot](#use-case-4-build-clawdbot)

Skills are not prompts. They are durable infrastructure.

Refly is the first open-source platform for building stable, atomic, and versioned agent skills. 

<a href="https://refly.ai/workspace"><u>Try it Now</u></a> 

---
## Refly Skills

Refly Skills is the official executable skill registry for Refly.

- ⚡ **Run instantly**: Execute skills in Refly with one click
- 🧩 **Reusable infrastructure**: Versioned skills, not one-off prompts
- 🔌 **Export anywhere**: Ship skills to Claude Code or deploy as APIs
- 🌍 **Community-powered**: Import, fork, and publish your own skills

Explore the registry: <a href="https://github.com/refly-ai/refly-skills"><u>Refly Skills Repo</u></a> 

Skills are deterministic agent capabilities—reusable across workflows, teams, and runtimes.

**TL;DR**: Refly compiles your enterprise SOPs into executable agent skills. Built in 3 minutes. Shipped anywhere.

---
## Quick Start

### Deploy Refly

- 📘 **[Self-Deployment Guide](https://docs.refly.ai/community-version/self-deploy/)**  
  *(Recommended for Developers)* Step-by-step guide to deploying Refly on your own server using Docker.

- 🔌 **[API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)**  
  Complete API documentation for integrating Refly into your applications.

> [!TIP]
> Want to explore instantly? Open the hosted workspace: <a href="https://refly.ai/workspace"><u>Refly Workspace</u></a> 

### What's Next?

After deployment, choose your path based on your use case:

| I want to... | Start here | Time |
|-------------|-----------|------|
| 🔧 **Build my first workflow** | [Create a Workflow](#create-your-first-workflow) | 5 mins |
| 🔌 **Call workflows via API** | [API Integration](#use-case-1-api-integration) | 10 mins |
| 💬 **Connect to Lark/Feishu** | [Webhook Setup](#use-case-2-webhook-for-lark-feishu) | 15 mins |
| 🤖 **Export for Claude Code** | [Export Skills](#use-case-3-skills-for-claude-code) | 15 mins |
| 🦞  **Build a Clawdbot** | [Build Clawdbot](#use-case-4-build-clawdbot) | 20 mins |
---


## Why Refly?

Most AI Agents fail in production because they rely on "Vibe-coded" scripts and fragile, black-box logic. As the ecosystem moves toward agentic frameworks like Claude Code, AutoGen, and MCP, the bottleneck is no longer the LLM—it's the lack of standardized, reliable actions.

Refly bridges the gap between raw APIs and intelligent agents. We allow you to codify messy business logic into structured, version-controlled Agent skills that any agent can invoke with 100% reliability.

**Stop hard-coding tools.** Build modular skills once in Refly's visual IDE and deploy them as MCP servers, standard APIs, or portable SDKs to any agent framework. <a href="https://refly.ai/workspace"><u>Try it Now</u></a> 

---

## Core Capabilities

### 🎯 Construct with Vibe (Copilot-led Builder)

Describe your business logic in natural language, and Refly's Model-Native DSL compiles your intent into a high-performance skill.

- **Intent-Driven Construction**: Describe the work once; Refly turns intent into deterministic, reusable, and composable skills.
- **Efficiency at Scale**: Streamlined DSL optimized for LLMs, ensuring fast execution and significantly lower token costs.
- **3-Minute Deployment**: Transition from a static enterprise SOP to a production-ready agent skill in under 3 minutes.

### ⚡ Execute with Control (Intervenable Runtime)

Break the "black box" of AI execution with a stateful runtime designed for deterministic reliability.

- **Intervenable Runtime**: Pause, audit, and re-steer agent logic mid-run to ensure 100% operational compliance.
- **Deterministic Guarantees**: Enforce strict business rules that minimize hallucinations and handle failure recovery.

### 🚀 Ship to Production (Unified Agent Stack)

Unify MCP integrations, tools, models, and reusable skills into a single execution layer.

- **Universal Delivery**: Export as APIs for Lovable, webhooks for Slack or Lark/Feishu, or native tools for Claude Code and Cursor.
- **Stable Scheduling**: Run workflows reliably on schedule with managed execution.

### 🏛️ Govern as Assets (Skill Registry)

Transform fragile scripts into governed, shared infrastructure across your organization.

- **Central Skill Registry**: Securely manage, version, and share agent capabilities.
- **Team Workspace Collaboration**: Build together with native version control and audit logs.

---

## Ecosystem

Refly is designed to be the universal bridge between your existing enterprise toolchain and the next generation of agentic runtimes.

### Tooling & Protocols (Inputs)

Bring your own data and logic into Refly with zero friction.

- **3,000+ Native Tools**: Seamlessly integrate with Stripe, Slack, Salesforce, GitHub, etc.

A full list of supported model and tools providers can be found in [provider-catalog.json](./config/provider-catalog.json).

<img width="3840" height="1254" alt="part supported tools integrations in refly" src="https://github.com/user-attachments/assets/954f43bd-356d-48c4-a3b9-1c0f2e781a43" />


- **MCP Support**: Full compatibility with Model Context Protocol servers
- **Private Skill Connectors**: Connect to your databases, scripts, and internal systems

### Agent Runtimes & Platforms (Outputs)

Export your deterministic skills to any environment where work happens.

<img width="2688" height="1512" alt="deterministic skills can be exported to cursor, claude code and etc." src="https://github.com/user-attachments/assets/23e7a204-4dce-432f-b8bc-65839061d086" />



- **AI Coding Tools**: Native export for Claude Code and Cursor (coming soon)
- **App Builders**: Power Lovable or custom frontends via stateful APIs
- **Automation Hubs**: Deploy as webhooks for Slack, Lark/Feishu, or Microsoft Teams
- **Agent Frameworks**: Compatible with AutoGen, Manus, LangChain, and custom Python stacks

---
## Why Teams Choose Refly

### For Builders: From Vibe to Production

Most agent tooling today falls into two categories:

- Workflow builders (n8n, Dify): Great for orchestration, but workflows are fragile, trigger-only "black boxes," and hard to reuse.
- Agent frameworks (LangChain): Powerful primitives, but require heavy engineering, manual boilerplate, and high maintenance to keep running.
Refly eliminates the friction of manual configuration, giving you the fastest path from a "vibe" to a usable agent tool. By using our Streamlined DSL, you get the speed of a GUI with the precision of code.

| Dimension | Legacy Automation <br><sub>(n8n, Dify)</sub> | Code-First SDKs <br><sub>(LangChain)</sub> | **Refly Skills** |
| :--- | :--- | :--- | :--- |
| **Interaction Depth** | Trigger-only <br><sub>Black box</sub> | Programmatic <br><sub>Code changes</sub> | **Intervenable runtime**<br><sub>Steer logic mid-run</sub> |
| **Construction** | Manual API wiring & JSON | Manual Python/TS boilerplate | **Copilot-led**<br><sub>Describe intent → skills generated</sub> |
| **Recovery** | Fail = restart from scratch | Debug → redeploy → rerun | **Hot-fix**<br><sub>Repair workflows during execution</sub> |
| **Portability** | Hard to reuse across environments | Framework-specific | **Export everywhere**<br><sub>To Claude Code, Cursor, Manus</sub> |
| **Deployment** | Limited function tools | Custom microservices | **Production Ready**<br><sub>Stateful, validated APIs</sub> |
### For Enterprise: Scalable Skills Governance

Workflow tools like n8n are great for basic connectivity, and frameworks like LangChain offer powerful primitives — but neither provides the governed, production-ready capability layer required for enterprise agent infrastructure.

Refly acts as the Agent skills builder, providing the governance and reliability infrastructure required to deploy AI across the entire organization.

| Enterprise Requirement | Legacy Tools <br><sub>(Workflow-first)</sub> | SDKs <br><sub>(Code-first)</sub> | **Refly (Skill OS)** |
| :--- | :--- | :--- | :--- |
| **Governance & Reuse** | Templates are copied and<br><sub>reconfigured per instance</sub> | No native registry<br><sub>for sharing logic</sub> | **Central skill registry**<br><sub>Versioned, shareable capability assets</sub> |
| **Operational Reliability** | Trigger-based<br><sub>limited recovery</sub> | Custom handling required | **Stateful runtime**<br><sub>With validation + failure recovery</sub> |
| **SOP Enforcement** | Workflows drift<br><sub>across copies</sub> | Depends on manual<br><sub>engineering discipline</sub> | **SOP-grade deterministic skills**<br><sub>With controlled execution</sub> |
| **Deployment** | Instance-bound workflows | Code maintained manually<br><sub>per team</sub> | **Local-first, on-prem ready**<br><sub>Open-source infrastructure</sub> |
| **Total Cost (TCO)** | Overhead grows with<br><sub>workflow complexity</sub> | High engineering<br><sub>maintenance costs</sub> | **Minimal DSL**<br><sub>Reduces token spend</sub> |

---
## Create Your First Workflow

> [!NOTE]
> This section assumes you have completed [self-deployment](https://docs.refly.ai/community-version/self-deploy/) and can access Refly at `http://localhost:5700`

**Step 1: Register and Log In**

1. Open `http://localhost:5700` in your browser
2. Register with your email and password
3. Configure your first model provider:
   - Click the account icon (top right) → Settings
   - Add a provider (e.g., OpenAI, Anthropic)
   - Add your first chat model
   - Set it as default

> 📖 Detailed setup with screenshots: [Self-Deployment Guide](https://docs.refly.ai/community-version/self-deploy/#start-using-refly)

**Step 2: Create a Workflow**

1. Click **"New Workflow"** on the home page
2. Choose a template or start from scratch:
   - **Blank Canvas**: Build with visual nodes
   - **Vibe Mode**: Describe your workflow in natural language

**Example - Product Research Workflow**:
```text
1. Add "Web Search" node - searches for product information
2. Add "LLM" node - analyzes search results
3. Add "Output" node - formats the report
4. Connect the nodes
5. Click "Save"
```

> [!TIP]
> If you want the fastest path, start with Vibe Mode and iterate from a template.

**Step 3: Test Your Workflow**

1. Click "Run" button
2. Enter test input (e.g., a product URL)
3. View execution results in real-time
4. Check logs if something fails

---

## Use Cases

### Use Case 1: API Integration

**Goal**: Call your workflow from your application via REST API

**Get Your API Credentials**

1. Go to Settings → API Keys
2. Click "Generate New Key"
3. Copy your API key (keep it secure!)

**Make Your First API Call**
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

**Response**:
```json
{
  "execution_id": "exec_abc123",
  "status": "running"
}
```

**Check Execution Status**
```bash
curl https://your-refly-instance.com/api/v1/executions/{execution_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

📖 **Full API Documentation**: [API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)




### Use Case 2: Webhook for Lark (Feishu)

**Goal**: Trigger your workflow when someone sends a message in Lark

**Prerequisites**

- A Lark workspace with admin access
- A workflow created in Refly

**Setup Steps**

1. **In Refly**:
   - Open your workflow
   - Click "Settings" → "Triggers"
   - Enable "Webhook Trigger"
   - Copy the Webhook URL

2. **In Lark/Feishu**:
   - Go to [api.feishu.com/apps](https://open.feishu.cn/app)
   - Create a "Custom App"
   - Navigate to "Event Subscriptions"
   - Paste the Refly Webhook URL into "Request URL"
   - Click "Add Event" and select "Receive Message"
   - Go to "Version Management" and publish the app
     

3. **Test**:
   - In Feishu, find your bot in the search bar and send a message (e.g., `analyze report.pdf`)
   - Your workflow executes and returns results via the webhook


> ⚠️ **Note**: Detailed Lark/Feishu integration guide coming soon. For now, see [API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api) for webhook configuration.


### Use Case 3: Skills for Claude Code

**Goal**: Publish your Refly workflows as Claude Code skills

**Quick Start**

1. **Install Refly CLI**
```bash
npm install -g @powerformer/refly-cli
```

2. **Install a Skill**
```bash
# Via Refly CLI
refly skill install <skill-id>

#Via npx
npx skills add refly-ai/<skill-name>
```

3. **Publish a Skill**
```bash
refly skill publish <skill-id>
```

The skill is now available in Claude Code, Cursor, and MCP-powered workflows. Agent can invoke your workflow as a tool!


📖 **Documentation**: <a href="https://github.com/refly-ai/refly-skills"><u>Refly Skills</u></a> 

### Use Case 4: Build Clawdbot

📖 **Tutorial**: <a href="https://powerformer.feishu.cn/wiki/Gz4swMzn0izknZki3g4coSgvnNe"><u>Build Clawdbot Tutorial</u></a> 

***

## Community & Support

- 🌟 **[Star us on GitHub](https://github.com/refly-ai/refly)**: It helps us keep building!
- 💬 **[Discord](https://discord.com/invite/YVuYFjFvRC)**: Join our community
- 🐦 **[Twitter](https://x.com/reflyai)**: Follow us for updates
- 📖 **[Documentation](https://docs.refly.ai)**: Full guides and tutorials
- 🐛 **[Issues](https://github.com/refly-ai/refly/issues)**: Report bugs or request features

---

## Join Us

Join our community to get help, share your experience, and connect with other Refly users: <a href="https://docs.refly.ai/community/contact-us"><u>Refly Community</u></a>

---

## Contributing

For those who'd like to contribute code, see our [Contribution Guide](CONTRIBUTING.md). At the same time, please consider supporting Refly by sharing it on social media and at events and conferences.

> We are looking for contributors to help translate Refly into languages other than Mandarin or English. If you are interested in helping, please see the [Contribution Guide](CONTRIBUTING.md) for more information.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=refly-ai/refly&type=Date)](https://star-history.com/#refly-ai/refly&Date)

## License

This repository is licensed under the [ReflyAI Open Source License](LICENSE), which is essentially the Apache 2.0 License with some additional restrictions.
