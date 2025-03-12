# CONTRIBUTING

So you're looking to contribute to Refly - that's awesome, we can't wait to see what you do. As an AI-native creation engine, we aim to provide the most intuitive free-form canvas interface that combines multi-threaded conversations, knowledge base RAG integration, contextual memory, and intelligent search capabilities. Any help from the community counts, truly.

We need to be nimble and ship fast given where we are, but we also want to make sure that contributors like you get as smooth an experience at contributing as possible. We've assembled this contribution guide for that purpose, aiming at getting you familiarized with the codebase & how we work with contributors, so you could quickly jump to the fun part.

This guide, like Refly itself, is a constant work in progress. We highly appreciate your understanding if at times it lags behind the actual project, and welcome any feedback for us to improve.

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

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js v20.x (LTS)](http://nodejs.org)
- [Visual Studio](https://visualstudio.microsoft.com/)
  - Ensure you install the latest version of Visual Studio, and select the "C++ Desktop Development" workload during installation.

### 4. Installation

Refly consists of multiple packages managed in a monorepo structure. The main components are:

1. Web Application (`apps/web/`): The main web interface
2. API Server (`apps/api/`): The backend server
3. AI Workspace Common (`packages/ai-workspace-common/`): Shared AI workspace UI components
4. i18n (`packages/i18n/`): Internationalization support

Follow these steps to install:

1. Spin up all the middlewares:

```bash
cd deploy/docker
docker-compose -f docker-compose.middleware.yml up -d
```

2. Install dependencies:

```bash
corepack enable
pnpm install #make sure you install visual studio before this step
```

3. Set up environment variables for both API and web:

```bash
cd ../..
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

4. Start developing:


```bash
pnpm build
pnpm dev
```
- You may encounter the error `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  - You may need to set `NODE_OPTIONS='--max-old-space-size=8192'` to solve this problem 
- If you cannot see the login and registration page (CORS policy)
  - Please check `apps/api/.env` and set `ORIGIN=http://localhost:5173`
- If you cannot register
  - Please check `apps/api/prisma/schema.prisma` 
  - Run `pnpm sync-db-schema` in `apps/api`
  - If you are a windows user, using `bash` to run `pnpm sync-db-schema-win` in `apps/api`

You can visit [http://localhost:5173](http://localhost:5173/) to start developing Refly.

## Developing

To help you quickly navigate where your contribution fits, here's a brief outline of Refly's structure:

### Backend Structure

```text
[apps/server/]             // Main server application
├── src/
│   ├── controllers/      // API route handlers
│   ├── services/        // Business logic implementation
│   ├── models/          // Data models and types
│   ├── ai/              // AI feature implementations
│   │   ├── llm/        // LLM integration and management
│   │   ├── rag/        // RAG pipeline implementation
│   │   └── memory/     // Context memory management
│   ├── canvas/         // Canvas-related backend services
│   └── utils/          // Shared utilities

[packages/]
├── ai-core/            // Core AI functionality
│   ├── src/
│   │   ├── llm/       // LLM abstraction and implementations
│   │   ├── memory/    // Memory systems
│   │   └── rag/       // RAG implementations
│
└── shared/            // Shared types and utilities
    └── src/
        └── types/     // Common TypeScript types
```

The backend is built with Nest.js and TypeScript, focusing on:

- AI feature implementation including LLM integration, RAG pipelines, and context memory
- Canvas state management and real-time collaboration
- RESTful APIs and WebSocket connections for real-time features
- Efficient data storage and retrieval for knowledge bases

### Frontend Structure

```text
[apps/web/]                 // Main web application
├── src/
│   ├── components/         // React components
│   ├── styles/            // Global styles and themes
│   └── main.tsx           // Application entry point

[packages/]
├── ai-workspace-common/   // Shared AI workspace components
│   ├── src/
│   │   ├── components/    // Canvas, editor, and AI feature components
│   │   └── utils/        // Shared utilities
│
└── i18n/                 // Internationalization
    ├── src/
    │   ├── en-US/        // English translations
    │   └── zh-Hans/      // Chinese translations
```

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

- Join our [Discord](https://discord.gg/bWjffrb89h) community
- Open a discussion in our [GitHub Discussions](https://github.com/refly-ai/refly/discussions)
- Check our [Documentation](https://docs.refly.ai)
