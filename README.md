![refly-cover](https://github.com/user-attachments/assets/2930c555-09a7-4ea2-a18a-2b1d8a7ef4ae)

<div align="center">

<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.refly.ai">Refly.AI</a><br>
    </b>
    ⭐️  The Open Source Vibe Workflow Platform ⭐️ <br>
</h1>

Refly is a pioneering vibe workflow platform designed to solve your most complex challenges. Effortlessly design, build, and reuse intelligent workflows to boost productivity with AI agents and infinite expansion of MCP tools.

[🚀 v0.7.1 Released! Now Supporting MCP Store and Background Skill Invocation ⚡️](https://docs.refly.ai/changelog/v0.7.1)

[Refly Cloud](https://refly.ai/) · [Self-hosting](https://docs.refly.ai/guide/self-deploy) · [Forum](https://github.com/refly-ai/refly/discussions) · [Discord](https://discord.gg/bWjffrb89h) · [Twitter](https://x.com/reflyai) · [Documentation](https://docs.refly.ai/)

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

## Quick Start

> Before installing ReflyAI, ensure your machine meets these minimum system requirements:
>
> CPU >= 1 cores
>
> Memory >= 2GB

### Self-deploy with Docker

Deploy your own feature-rich, unlimited version of ReflyAI using Docker. Our team is working hard to keep up with the latest versions.

To start deployment:

```bash
cd deploy/docker
cp ../../apps/api/.env.example .env # copy the example api env file
docker compose up -d
```

### Self-deploy with Kubernetes

Also, we support deploy ReflyAI to Kubernetes cluster.

To start deployment:

```bash
cd deploy/kubernetes

kubectl apply -f refly-deployment.yaml
```

For the following steps, you can visit [Self-deploy Guide](https://docs.refly.ai/guide/self-deploy) for more details.

For core deployment tutorials, environment variable configuration, and FAQs, please refer to 👉 [Deployment Guide](https://docs.refly.ai/guide/self-deploy).

### Local Development

View details in [CONTRIBUTING](./CONTRIBUTING.md).

## ✨ Key Features

### `1` 🧵 Multi-threaded Conversation System
Built on an innovative multi-threaded architecture that enables parallel management of independent conversation contexts. Implements complex Agentic Workflows through efficient state management and context switching mechanisms, transcending traditional dialogue model limitations.

### `2` 🤖 Multi-model Integration Framework
- Integration with 13+ leading language models, including DeepSeek R1, Claude 3.5 Sonnet, Google Gemini 2.0, and OpenAI O3-mini
- Support for model hybrid scheduling and parallel processing
- Flexible model switching mechanism with unified conversation interface
- Multi-model knowledge base collaboration

### `3` 🎨 Multimodal Processing Capabilities
- File Format Support: 7+ formats including PDF, DOCX, RTF, TXT, MD, HTML, EPUB
- Image Processing: Support for mainstream formats including PNG, JPG, JPEG, BMP, GIF, SVG, WEBP
- Intelligent Batch Processing: Canvas multi-element selection and AI analysis

### `4` ⚡️ AI-Powered Skill System
Integrating advanced capabilities from Perplexity AI, Stanford Storm, and more:
- Intelligent web-wide search and information aggregation
- Vector database-based knowledge retrieval
- Smart query rewriting and recommendations
- AI-assisted document generation workflow

### `5` 🔍 Context Management System
- Precise temporary knowledge base construction
- Flexible node selection mechanism
- Multi-dimensional context correlation
- Cursor-like intelligent context understanding

### `6` 📚 Knowledge Base Engine
- Support for multi-source heterogeneous data import
- RAG-based semantic retrieval architecture
- Intelligent knowledge graph construction
- Personalized knowledge space management

### `7` ✂️ Intelligent Content Capture
- One-click content capture from mainstream platforms (Github, Medium, Wikipedia, Arxiv)
- Intelligent content parsing and structuring
- Automatic knowledge classification and tagging
- Deep knowledge base integration

### `8` 📌 Citation System
- Flexible multi-source content referencing
- Intelligent context correlation
- One-click citation generation
- Reference source tracking

### `9` ✍️ AI-Enhanced Editor
- Real-time Markdown rendering
- AI-assisted content optimization
- Intelligent content analysis
- Notion-like editing experience

### `10` 🎨 Code Artifact Generation
- Generate HTML, SVG, Mermaid diagrams, and React applications
- Smart code structure optimization
- Component-based architecture support
- Real-time code preview and debugging

### `11` 🌐 Website Visualization Engine
- Interactive web page rendering and preview
- Complex concept visualization support
- Dynamic SVG and diagram generation
- Responsive design templates
- Real-time website prototyping
- Integration with modern web frameworks

## 🛣️ Roadmap

We're continuously improving Refly with exciting new features. For a detailed roadmap, visit our [complete roadmap documentation](https://docs.refly.ai/roadmap).

- 🎨 Advanced image, audio, and video generation capabilities
- 🎨 Cross-modal content transformation tools
- 💻 High-performance desktop client with improved resource management
- 💻 Enhanced offline capabilities
- 📚 Advanced knowledge organization and visualization tools
- 📚 Collaborative knowledge base features
- 🔌 Open standard for third-party plugin development based on MCP
- 🔌 Plugin marketplace and developer SDK
- 🤖 Autonomous task completion with minimal supervision
- 🤖 Multi-agent collaboration systems
- ⚡️ Visual workflow builder for complex AI-powered processes
- ⚡️ Advanced integration capabilities with external systems and API support
- 🔒 Enhanced security and compliance tools
- 🔒 Advanced team management and analytics

## How to Use?

- **Cloud**
  - We've deployed a Refly Cloud version that allows zero-configuration usage, offering all capabilities of the self-hosted version, including free access to GPT-4o-mini and limited trials of GPT-4o and Claude-3.5-Sonnet. Visit [https://refly.ai/](https://refly.ai/) to get started.
- **Self-hosting Refly Community Edition**
  - Get started quickly with our [Getting Started Guide](./CONTRIBUTING.md) to run Refly in your environment. For more detailed references and in-depth instructions, please refer to our documentation.
- **Refly for enterprise / organizations**
  - Please contact us at [support@refly.ai](mailto:support@refly.ai) for private deployment solutions.

## Stay Updated

Star Refly on GitHub to receive instant notifications about new version releases.

![stay-tuned](https://github.com/user-attachments/assets/877dfeb7-1088-41f1-9176-468d877ded0a)

## Contributing Guidelines

| Bug Reports                                                              | Feature Requests                                                  | Issues/Discussions                                                       | ReflyAI Community                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Create Bug Report](https://github.com/refly-ai/refly/issues/new/choose) | [Submit Feature Request](https://github.com/refly-ai/refly/pulls) | [View GitHub Discussions](https://github.com/refly-ai/refly/discussions) | [Visit ReflyAI Community](https://docs.refly.ai/community/contact-us) |
| Something isn't working as expected                                      | Ideas for new features or improvements                            | Discuss and raise questions                                              | A place to ask questions, learn, and connect with others              |

Calling all developers, testers, tech writers and more! Contributions of all types are more than welcome, please check our [CONTRIBUTING.md](./CONTRIBUTING.md) and feel free to browse our [GitHub issues](https://github.com/refly-ai/refly/issues) to show us what you can do.

For bug reports, feature requests, and other suggestions, you can also [create a new issue](https://github.com/refly-ai/refly/issues/new/choose) and choose the most appropriate template to provide feedback.

If you have any questions, feel free to reach out to us. One of the best places to get more information and learn is the [ReflyAI Community](https://docs.refly.ai/community/contact-us), where you can connect with other like-minded individuals.

## Community and Contact

- [GitHub Discussion](https://github.com/refly-ai/refly/discussions): Best for sharing feedback and asking questions.
- [GitHub Issues](https://github.com/refly-ai/refly/issues): Best for reporting bugs and suggesting features when using ReflyAI. Please refer to our contribution guidelines.
- [Discord](https://discord.gg/bWjffrb89h): Best for sharing your applications and interacting with the community.
- [X(Twitter)](https://x.com/reflyai): Best for sharing your applications and staying connected with the community.

## Upstream Projects

We would also like to thank the following open-source projects that make ReflyAI possible:

1. [LangChain](https://github.com/langchain-ai/langchainjs) - Library for building AI applications.
2. [ReactFlow](https://github.com/xyflow/xyflow) - Library for building visual workflows.
3. [Tiptap](https://github.com/ueberdosis/tiptap) - Library for building collaborative editors.
4. [Ant Design](https://github.com/ant-design/ant-design) - UI library.
5. [yjs](https://github.com/yjs/yjs) - Provides CRDT foundation for our state management and data sync implementation.
6. [React](https://github.com/facebook/react) - Library for web and native user interfaces.
7. [NestJS](https://github.com/nestjs/nest) - Library for building Node.js servers.
8. [Zustand](https://github.com/pmndrs/zustand) - Primitive and flexible state management for React.
9. [Vite](https://github.com/vitejs/vite) - Next generation frontend tooling.
10. [TailwindCSS](https://github.com/tailwindcss/tailwindcss) - CSS library for writing beautiful styles.
11. [Tanstack Query](https://github.com/tanstack/query) - Library for frontend request handling.
12. [Radix-UI](https://github.com/radix-ui) - Library for building accessible React UI.
13. [Elasticsearch](https://github.com/elastic/elasticsearch) - Library for building search functionality.
14. [Qdrant](https://github.com/qdrant/qdrant) - Library for building vector search functionality.
15. [Resend](https://github.com/resend/react-email) - Library for building email sending functionality.
16. Other upstream dependencies.

We are deeply grateful to the community for providing such powerful yet simple libraries that allow us to focus more on implementing product logic. We hope that our project will also provide an easier-to-use Vibe Workflow Platform for everyone in the future.

## Security Issues

To protect your privacy, please avoid posting security-related issues on GitHub. Instead, send your questions to [support@refly.ai](mailto:support@refly.ai), and we will provide you with a more detailed response.

## License

This repository is licensed under the [ReflyAI Open Source License](./LICENSE), which is essentially the Apache 2.0 License with some additional restrictions.