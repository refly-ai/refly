<img width="1280" height="731" alt="image" src="https://github.com/user-attachments/assets/9ee376d9-946d-4c11-96c5-740533b4b124" />

<div align="right">

**English | [中文](README_CN.md)**

</div>

# Refly — The First Open-Source Agent Skills Builder Powered by Vibe Workflow
Ships as APIs for Lovable · Webhooks for Slack · Skills for Claude Code · SOP playbooks in Refly

Skills are not prompts. They are durable infrastructure.

Refly is the first open-source platform for building stable, atomic, and versioned agent skills. Skills are deterministic agent capabilities—reusable across workflows, teams, and runtimes.

TL;DR: Refly compiles your enterprise SOPs into executable agent skills. Built in 3 minutes. Shipped anywhere.

## Quick Start

- **[📘Self-Deployment Guide](https://docs.refly.ai/community-version/self-deploy/)**
  * Recommended for Developers) Step-by-step guide to deploying Refly on your own server using Docker. 
- **[🔌API Reference](https://github.com/refly-ai/refly/tree/main/docs/en/guide/api)**
  * Complete API documentation for integrating Refly into your applications.

## Why Refly?

Most AI Agents fail in production because they rely on "Vibe-coded" scripts and fragile, black-box logic. As the ecosystem moves toward agentic frameworks like Claude Code, AutoGen, and MCP, the bottleneck is no longer the LLM—it’s the lack of standardized, reliable actions.

Refly bridges the gap between raw APIs and intelligent agents. We allow you to codify messy business logic into structured, version-controlled Agent skills that any Any agent can invoke with 100% reliability.

Stop hard-coding tools. Build modular skills once in Refly's visual IDE and deploy them as MCP servers, standard APIs, or portable SDKs to any agent framework.

## Core Infrastructure

Refly is the first open-source agent skills builder for creating production-ready, deterministic skills — not just one-off workflows.

By transforming natural language intent into a governed capability layer, Refly allows teams to ship reliable agentic infrastructure in minutes.

### Construct with Vibe (Copilot-led Builder)

Describe your business logic in natural language, and Refly’s Model-Native DSL compiles your intent into a high-performance skill.

- Intent-Driven Construction: Describe the work once; Refly turns intent into deterministic, reusable, and composable skills.
- Efficiency at Scale: Our streamlined DSL is optimized for LLMs, ensuring fast execution and significantly lower token costs compared to legacy tools.
- 3-Minute Deployment: Transition from a static enterprise SOP to a production-ready, compiled agent skill in under 3 minutes.
### Execute with Control (Intervenable Runtime)

Break the "black box" of AI execution with a stateful runtime designed for deterministic reliability and limitless connectivity.

- Intervenable Runtime: Unlike trigger-only tools, Refly allows you to pause, audit, and re-steer agent logic mid-run to ensure 100% operational compliance.
- Deterministic Guarantees: Enforce strict business rules within a governed execution layer that minimizes hallucinations and handles failure recovery.
### Ship to Production (Unified Agent Stack)

Unify MCP integrations, tools, models, and reusable skills into a single execution layer that ships to any platform.

- Universal Delivery: Export your skills as authenticated, stateful APIs for Lovable, intelligent webhooks for Slack, or native tools for Claude Code and Cursor.
- Stable Scheduling: Run workflows reliably on schedule with managed execution and predictable behavior for long-running automations.
### Govern as Assets (Skill Registry)

Transform fragile scripts and manual playbooks into governed, shared infrastructure across your organization.

- Central Skill Registry: Securely manage, version, and share agent capabilities as reusable corporate assets.
- Team Workspace Collaboration: Build together and share SOP playbooks in a centralized environment with native version control and audit logs.
## Ecosystem

Refly is designed to be the universal bridge between your existing enterprise toolchain and the next generation of agentic runtimes.

### Tooling & Protocols (Inputs)

Bring your own data and logic into Refly with zero friction.

- 3,000+ Native Tools: Seamlessly integrate with industrial APIs like Stripe, Slack, Salesforce, GitHub and etc.
A full list of supported model and tools providers can be found here。

<img width="1280" height="272" alt="image" src="https://github.com/user-attachments/assets/30475454-1bb7-41bd-b6d8-6f799bb30f79" />


- MCP Support: Full native compatibility with any Model Context Protocol server to extend agent capabilities beyond standard APIs.
- Private Skill Connectors：Securely run and manage thousands of internal skills — connected to your databases, scripts, and systems through Refly’s runtime.
### Agent Runtimes & Platforms (Outputs)

Export your deterministic skills to any environment where work happens.

<img width="1280" height="853" alt="image" src="https://github.com/user-attachments/assets/93053319-8903-4908-b2d0-4ae283ecc295" />


- AI Coding Tools: Native export for Claude Code and Cursor, allowing agents to use your versioned skills as standardized tools.
- App Builders: Power the logic of Lovable or custom frontend apps via stateful, authenticated APIs.
- Automation Hubs: Deploy as intelligent webhooks to trigger complex SOPs from Slack or Microsoft Teams.
- Agent Frameworks: Directly compatible with AutoGen, Manus, and custom LangChain/Python stacks.
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

## Contributing

For those who'd like to contribute code, see our [Contribution Guide](CONTRIBUTING.md). At the same time, please consider supporting Refly by sharing it on social media and at events and conferences.

> We are looking for contributors to help translate Refly into languages other than Mandarin or English. If you are interested in helping, please see the <u><mark style="background: yellow">xxx</mark></u> for more information.

## Community

Connect with the Refly community:

- 🌟 **[Star us on GitHub](https://github.com/refly-ai/refly)**: It helps us keep building!
- 💬 **Discord/Slack**: Join our chat... 
- 🐦 **Twitter**: Follow us... 

## License

This repository is licensed under the [ReflyAI Open Source License](LICENSE), which is essentially the Apache 2.0 License with some additional restrictions.

Enterprise License Needed
Apache License 2.0

