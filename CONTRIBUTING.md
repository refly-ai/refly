# CONTRIBUTING

So you're looking to contribute to Refly - that's awesome, we can't wait to see what you do. Refly is the first open-source platform for building stable, atomic, and versioned agent skills. As an AI-native creation engine, we provide an intuitive free-form canvas interface to codify business logic into structured agent skills that any agent can invoke with 100% reliability. Any help from the community counts, truly.

We need to be nimble and ship fast given where we are, but we also want to make sure that contributors like you get as smooth an experience at contributing as possible. We've assembled this contribution guide for that purpose, aiming at getting you familiarized with the codebase & how we work with contributors, so you could quickly jump to the fun part.

This guide, like Refly itself, is a constant work in progress. We've recently evolved from a creative engine into an agentic infrastructure platform, and we highly appreciate your understanding if at times it lags behind the actual project. We welcome any feedback for us to improve.

In terms of licensing, please take a minute to read our short [License and Contributor Agreement](./LICENSE). The community also adheres to the [code of conduct](./.github/CODE_OF_CONDUCT.md).

## Before you jump in

[Find](https://github.com/refly-ai/refly/issues?q=is:issue+is:open) an existing issue, or [open](https://github.com/refly-ai/refly/issues/new/choose) a new one. We categorize issues into 2 types:

### Feature requests

- If you're opening a new feature request, we'd like you to explain what the proposed feature achieves, and include as much context as possible about how it enhances the AI-native creation experience.

- If you want to pick one up from the existing issues, simply drop a comment below it saying so.

  A team member working in the related direction will be looped in. If all looks good, they will give the go-ahead for you to start coding. We ask that you hold off working on the feature until then, so none of your work goes to waste should we propose changes.

  Depending on whichever area the proposed feature falls under, you might talk to different team members. Here's rundown of the areas each our team members are working on at the moment:

  | Member               | Scope                                                |
  | -------------------- | ---------------------------------------------------- |
  | Canvas & AI Features | Multi-threaded dialogues, AI-powered canvas features |
  | Knowledge Base       | RAG integration, contextual memory                   |
  | Frontend Experience  | UI/UX, canvas interactions                           |
  | Developer Experience | API, SDK, developer tools                            |
  | Core Architecture    | Overall system design and scalability                |

  How we prioritize:

  | Feature Type                              | Priority        |
  | ----------------------------------------- | --------------- |
  | Core AI features and canvas functionality | High Priority   |
  | Knowledge base and collaboration features | Medium Priority |
  | UI/UX improvements and minor enhancements | Low Priority    |
  | Experimental features and future ideas    | Future-Feature  |

### Anything else (e.g. bug report, performance optimization, typo correction)

- Start coding right away.

  How we prioritize:

  | Issue Type                                       | Priority        |
  | ------------------------------------------------ | --------------- |
  | Bugs in core AI features or canvas functionality | Critical        |
  | Performance issues affecting user experience     | Medium Priority |
  | Minor UI fixes and documentation updates         | Low Priority    |

## Installing

Here are the steps to set up Refly for development:

### 1. Fork this repository

### 2. Clone the repo

Clone the forked repository from your terminal:

```shell
git clone git@github.com:<github_username>/refly.git
```

### 3. Verify dependencies

Refly requires the following dependencies to build:

- [Docker](https://www.docker.com/): 20.10.0 or higher
- [Node.js](http://nodejs.org): 20.19.0 (LTS)

We strongly recommend to install Node.js via [nvm](https://github.com/nvm-sh/nvm):

```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
source ~/.bashrc  # if you are using zsh, source ~/.zshrc instead
nvm install 20.19.0
```

Make sure all dependencies are ready:

```shell
docker version
node -v # v20.19.0 or higher
pnpm -v # 9.15.9
```

## Developing

### Developing API and Web

1. Spin up all the middlewares:

```bash
docker compose -f deploy/docker/docker-compose.middleware.yml -p refly up -d
docker ps | grep refly_ # check that all middleware containers are healthy
```

> If there are unhealthy containers, you should check the container logs and search for corresponding solutions. If the problem persists, feel free to raise an issue in our repo.

2. Install npm dependencies:

```bash
corepack enable
pnpm install
```

> If `corepack` is not available, you can also install pnpm via `npm install -g pnpm`.

3. Set up environment variables from the root directory:

```bash
pnpm copy-env:develop
```

4. Build all the packages for the first time:

```bash
pnpm build
```

5. Start developing web-UI based application either from the root directory or in separate packages:

```bash
# Option 1: from the root directory
pnpm dev

# Option 2: from separate packages in two terminals
cd apps/web && pnpm dev # terminal 1
cd apps/api && pnpm dev # terminal 2
```

6. Developing CLI:

```bash
cd packages/cli && pnpm dev
```

You can visit [http://localhost:5173](http://localhost:5173/) to start developing Refly web application.

## Code Structure

To help you quickly navigate where your contribution fits, here's a brief outline of Refly's structure:

### Backend Structure

```text
[apps/api/]                // Main API server application
├── src/
│   ├── modules/          // Feature modules (NestJS modules)
│   │   ├── skill/       // Agent skills management
│   │   ├── workflow/    // Workflow execution and planning
│   │   ├── action/      // Agent action handling
│   │   ├── mcp-server/  // Model Context Protocol integration
│   │   ├── tool/        // Tool inventory and execution (Composio, etc.)
│   │   ├── drive/       // File and storage management
│   │   ├── schedule/    // Task scheduling and multi-model routing
│   │   ├── rag/         // RAG pipeline implementation
│   │   ├── knowledge/   // Knowledge base management
│   │   ├── auth/        // Authentication and authorization
│   │   ├── canvas/      // Canvas-related backend services
│   │   └── ...          // Other feature modules (collab, user, etc.)
│   ├── utils/           // Shared utilities
│   └── scripts/         // Build and deployment scripts
├── prisma/              // Database schema and migrations
└── data/                // Static data and configurations

[packages/]
├── cli/                 // Refly CLI for skill development
├── skill-template/      // Templates and engine for agent skills
├── agent-tools/         // Standardized tools for agents
├── providers/           // AI provider abstractions (OpenAI, Vertex, etc.)
├── canvas-common/       // Shared canvas logic and types
├── ai-workspace-common/ // Shared workspace UI components
├── web-core/            // Core frontend logic and hooks
├── ui-kit/              // Shared UI component library
├── stores/              // Shared state management (Zustand)
├── common-types/        // Shared TypeScript types
├── i18n/                // Internationalization resources
├── openapi-schema/     // API schema definitions (OpenAPI)
├── utils/              // Shared utility functions
├── errors/             // Common error definitions
├── observability/      // Tracing and monitoring (Langfuse)
└── tsconfig/           // Shared TypeScript configurations
```

The backend is built with NestJS and TypeScript, focusing on:

- Building stable, atomic, and versioned agent skills
- Deterministic execution with intervenable runtime
- Universal delivery via MCP, APIs, and SDKs
- Multi-model routing and advanced task scheduling
- RAG pipeline implementation for knowledge retrieval
- Real-time collaboration and canvas state management
- RESTful APIs with OpenAPI documentation
- Efficient database operations with Prisma ORM

### Frontend Structure

```text
[apps/web/]                 // Main web application
├── src/
│   ├── components/         // React components
│   ├── pages/             // Page components and routing
│   ├── routes/            // Route definitions
│   ├── lib/               // Third-party library configurations
│   ├── utils/             // Frontend utilities
│   ├── styles/            // Global styles and themes
│   └── main.tsx           // Application entry point
├── public/                // Static assets
└── typing/                // TypeScript type definitions

[apps/extension/]          // Browser extension for web clipping
├── src/                   // Extension-specific code
└── ...                    // Extension manifest and assets

[packages/]
├── web-core/              // Core frontend logic and hooks
├── ai-workspace-common/   // Shared AI workspace components
├── canvas-common/         // Shared canvas logic
├── ui-kit/                // Shared UI component library
├── stores/                // Shared state management
├── i18n/                  // Internationalization
└── ...                    // Other shared packages
```

The frontend is built with React, TypeScript, and modern tooling:

- Agent skills builder interface for visual logic construction
- Canvas-based interface for AI-powered content creation
- Real-time execution logs and workflow transparency
- Multi-threaded conversation management
- Knowledge base integration and RAG-powered search
- Responsive design with Tailwind CSS
- Internationalization support for multiple languages

## Submitting your PR

When you're ready to submit your contribution:

1. Make sure your code follows our style guidelines
2. Add tests if applicable
3. Update documentation if needed
4. Create a pull request to the `main` branch

For major features, we first merge them into the `develop` branch for testing before they go into the `main` branch.

And that's it! Once your PR is merged, you will be featured as a contributor in our [README](https://github.com/refly-ai/refly/blob/main/README.md).

## Getting Help

If you ever get stuck or have questions while contributing, you can:

- Join our [Discord](https://discord.gg/YVuYFjFvRC) community
- Open a discussion in our [GitHub Discussions](https://github.com/refly-ai/refly/discussions)
- Check our [Documentation](https://docs.refly.ai)
