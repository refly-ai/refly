<img width="1280" height="731" alt="image" src="https://github.com/user-attachments/assets/9ee376d9-946d-4c11-96c5-740533b4b124" />

<div align="right">

**English | [中文](README_CN.md)**

</div>

# Refly — The First Open-Source Agent Skills Builder Powered by Vibe Workflow

[APIs for Lovable](#api-integration) · [Webhooks for Slack/Lark](#webhook-setup) · [Skills for Claude Code](#export-skills) · SOP playbooks in Refly

Skills are not prompts. They are durable infrastructure.

Refly is the first open-source platform for building stable, atomic, and versioned agent skills. Skills are deterministic agent capabilities—reusable across workflows, teams, and runtimes.

**TL;DR**: Refly compiles your enterprise SOPs into executable agent skills. Built in 3 minutes. Shipped anywhere.

---

## Quick Start

### Deploy Refly

- 📘 **[Self-Deployment Guide](https://docs.refly.ai/community-version/self-deploy/)**  
  *(Recommended for Developers)* Step-by-step guide to deploying Refly on your own server using Docker.

- 🔌 **[API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)**  
  Complete API documentation for integrating Refly into your applications.

### What's Next?

After deployment, choose your path based on your use case:

| I want to... | Start here | Time |
|-------------|-----------|------|
| 🔧 **Build my first workflow** | [Create a Workflow](#create-your-first-workflow) | 5 mins |
| 🔌 **Call workflows via API** | [API Integration](#use-case-1-api-integration) | 10 mins |
| 💬 **Connect to Lark** | [Webhook Setup](#use-case-2-webhook-for-feishu) | 15 mins |
| 🤖 **Export for Claude Code** | [Export Skills](#use-case-3-skills-for-claude-code) | 15mins |
| 🦞  **Build a ClawdBot** | [Build ClawdBot](#build-a-clawdbot) | 20 mins |
---

## Create Your First Workflow

> **Note**: This section assumes you have completed [self-deployment](https://docs.refly.ai/community-version/self-deploy/) and can access Refly at `http://localhost:5700`

### Step 1: Register and Log In

1. Open `http://localhost:5700` in your browser
2. Register with your email and password
3. Configure your first model provider:
   - Click the account icon (top right) → Settings
   - Add a provider (e.g., OpenAI, Anthropic)
   - Add your first chat model
   - Set it as default

> 📖 Detailed setup with screenshots: [Self-Deployment Guide](https://docs.refly.ai/community-version/self-deploy/#start-using-refly)

### Step 2: Create a Workflow

1. Click **"New Workflow"** on the home page
2. Choose a template or start from scratch:
   - **Blank Canvas**: Build with visual nodes
   - **Vibe Mode**: Describe your workflow in natural language

**Example - Product Research Workflow**:
```
1. Add "Web Search" node - searches for product information
2. Add "LLM" node - analyzes search results
3. Add "Output" node - formats the report
4. Connect the nodes
5. Click "Save"
```

### Step 3: Test Your Workflow

1. Click **"Run"** button
2. Enter test input (e.g., a product URL)
3. View execution results in real-time
4. Check logs if something fails

---

## Use Cases

### Use Case 1: API Integration

**Goal**: Call your workflow from your application via REST API

#### Get Your API Credentials

1. Go to **Settings** → **API Keys**
2. Click **"Generate New Key"**
3. Copy your API key (keep it secure!)

#### Make Your First API Call
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

#### Check Execution Status
```bash
curl https://your-refly-instance.com/api/v1/executions/{execution_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

📖 **Full API Documentation**: [API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)

---

### Use Case 2: Webhook for Slack

**Goal**: Trigger your workflow when someone sends a message in Slack

#### Prerequisites

- A Slack workspace with admin access
- A workflow created in Refly

#### Setup Steps

1. **In Refly**:
   - Open your workflow
   - Click **"Settings"** → **"Triggers"**
   - Enable **"Webhook Trigger"**
   - Copy the Webhook URL

2. **In Slack**:
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Create a new app
   - Enable **"Slash Commands"** or **"Event Subscriptions"**
   - Paste the Refly Webhook URL
   - Install the app to your workspace

3. **Test**:
   - In Slack, type `/your-command product-url`
   - Your workflow executes and returns results

> ⚠️ **Note**: Detailed Slack integration guide coming soon. For now, see [API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api) for webhook configuration.

---

### Use Case 3: Skills for Claude Code

**Goal**: Export your workflow as a skill that Claude Code can use

> 🚧 **Coming Soon**: Native export to Claude Code format (`.skill` files)

**Current Workaround**:
1. Call your workflow via API (see [Use Case 1](#use-case-1-api-integration))
2. Wrap the API call in a Claude Code MCP server

We're working on direct export - stay tuned! Follow progress in [Issue #XXX](https://github.com/refly-ai/refly/issues/XXX)

---

### Use Case 4: Vibe Coding (AI-Powered Workflow Generation)

**Goal**: Describe your workflow in plain English, let AI build it

#### How to Use Vibe Mode

1. Click **"New Workflow"**
2. Select **"Vibe Mode"** (or press `V`)
3. Describe what you want:
```
"Create a workflow that:
1. Searches for a product on Amazon
2. Extracts price, reviews, and ratings
3. Compares with competitors
4. Returns a recommendation report"
```

4. Refly generates the workflow automatically
5. Review the generated nodes
6. Click **"Save"** and test

> 💡 **Tip**: Be specific about inputs, outputs, and logic. The more detail you provide, the better the result.

---

## Why Refly?

Most AI Agents fail in production because they rely on "Vibe-coded" scripts and fragile, black-box logic. As the ecosystem moves toward agentic frameworks like Claude Code, AutoGen, and MCP, the bottleneck is no longer the LLM—it's the lack of standardized, reliable actions.

Refly bridges the gap between raw APIs and intelligent agents. We allow you to codify messy business logic into structured, version-controlled Agent skills that any agent can invoke with 100% reliability.

**Stop hard-coding tools.** Build modular skills once in Refly's visual IDE and deploy them as MCP servers, standard APIs, or portable SDKs to any agent framework.

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

- **Universal Delivery**: Export as APIs for Lovable, webhooks for Slack, or native tools for Claude Code and Cursor.
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

<img width="1280" height="272" alt="image" src="https://github.com/user-attachments/assets/30475454-1bb7-41bd-b6d8-6f799bb30f79" />

- **3,000+ Native Tools**: Seamlessly integrate with Stripe, Slack, Salesforce, GitHub, etc.
- **MCP Support**: Full compatibility with Model Context Protocol servers
- **Private Skill Connectors**: Connect to your databases, scripts, and internal systems

### Agent Runtimes & Platforms (Outputs)

Export your deterministic skills to any environment where work happens.

<img width="1280" height="853" alt="image" src="https://github.com/user-attachments/assets/93053319-8903-4908-b2d0-4ae283ecc295" />

- **AI Coding Tools**: Native export for Claude Code and Cursor (coming soon)
- **App Builders**: Power Lovable or custom frontends via stateful APIs
- **Automation Hubs**: Deploy as webhooks for Slack or Microsoft Teams
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

## Community & Support

- 🌟 **[Star us on GitHub](https://github.com/refly-ai/refly)**: It helps us keep building!
- 💬 **[Discord](https://discord.gg/refly)**: Join our community
- 🐦 **[Twitter](https://x.com/reflyai)**: Follow us for updates
- 📖 **[Documentation](https://docs.refly.ai)**: Full guides and tutorials
- 🐛 **[Issues](https://github.com/refly-ai/refly/issues)**: Report bugs or request features

---

## Contributing

For those who'd like to contribute code, see our [Contribution Guide](CONTRIBUTING.md). At the same time, please consider supporting Refly by sharing it on social media and at events and conferences.

> We are looking for contributors to help translate Refly into languages other than Mandarin or English. If you are interested in helping, please see the [Contribution Guide](CONTRIBUTING.md) for more information.

---

## License

This repository is licensed under the [ReflyAI Open Source License](LICENSE), which is essentially the Apache 2.0 License with some additional restrictions.
