# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Refly.AI is an open-source AI-native workflow platform (vibe workflow) built as a TypeScript monorepo. It empowers non-technical creators to build, share, and monetize AI automation workflows through natural language prompts and a visual canvas interface.

**Core Concepts:**
- **Intervenable Agent**: Visual, pausable workflow execution with real-time intervention capabilities
- **Workflow Copilot**: AI-powered workflow generation from natural language descriptions
- **Canvas-based Interface**: Visual workflow builder with multi-threaded conversations
- **RAG Integration**: Knowledge base retrieval-augmented generation for context-aware AI

## Monorepo Structure

This is a pnpm workspace managed by Turborepo. The key areas are:

### Apps
- **apps/api**: NestJS backend API server with Prisma ORM
- **apps/web**: React frontend web application (main UI)
- **apps/desktop**: Electron-based desktop application
- **apps/extension**: Browser extension for web clipping

### Key Packages
- **packages/ai-workspace-common**: Shared React components, hooks, and canvas logic
- **packages/providers**: AI provider abstractions (OpenAI, Anthropic, etc.)
- **packages/sandbox-agent**: Agent execution sandbox
- **packages/agent-tools**: Agent tool implementations
- **packages/common-types**: Shared TypeScript types
- **packages/i18n**: Internationalization (en-US, zh-Hans)
- **packages/openapi-schema**: API schema definitions

## Common Development Commands

### Setup and Installation
```bash
# Install dependencies (requires pnpm 9+, Node.js 20.19.0+)
pnpm install

# Start Docker middleware (PostgreSQL, Redis, Elasticsearch, MinIO, etc.)
docker compose -f deploy/docker/docker-compose.middleware.yml -p refly up -d

# Set up environment variables for development
pnpm copy-env:develop

# Initial build (required before first dev run)
pnpm build
```

### Development
```bash
# Start all apps in dev mode (web + api)
pnpm dev

# Start specific app (from root)
pnpm --filter=@refly/web dev
pnpm --filter=@refly/api dev

# Start desktop app in dev mode
pnpm dev:electron

# Start specific app (from app directory)
cd apps/web && pnpm dev
cd apps/api && pnpm dev
```

### Building
```bash
# Build all packages and apps
pnpm build

# Build specific app
pnpm --filter=@refly/api build
pnpm --filter=@refly/web build

# Fast API build (skips some optimizations)
pnpm build:api:fast
```

### Code Quality
```bash
# Lint code with Biome
pnpm lint
pnpm lint:fix

# Format code with Biome
pnpm format
pnpm format:fix

# Combined check (lint + format)
pnpm check
pnpm check:fix

# Check i18n consistency
pnpm i18n:check

# Run tests
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
```

### Database
```bash
# From apps/api directory:
cd apps/api

# Generate Prisma client
pnpm prisma:generate

# Format Prisma schema
pnpm format-schema

# Sync database schema (development)
pnpm sync-db-schema
```

### Cleanup
```bash
# Clean build artifacts
pnpm clean

# Clean all node_modules
pnpm clean:node-modules
```

## Architecture

### Backend Architecture (apps/api)

**Framework**: NestJS with TypeScript
**Database**: PostgreSQL with Prisma ORM
**Real-time**: WebSockets for collaboration and canvas sync

**Key Module Categories:**
- **Auth & User Management**: `auth/`, `user/`, `invitation/`
- **Core Workflow**: `canvas/`, `canvas-sync/`, `pilot/` (agent execution)
- **AI & Knowledge**: `provider/`, `rag/`, `knowledge/`, `search/`
- **Execution**: `action/`, `sandbox/`, `lambda/`, `schedule/`
- **Collaboration**: `collab/`, `share/`, `project/`
- **Content Generation**: `code-artifact/`, `media-generator/`, `copilot/`
- **Storage**: `drive/`, `label/`
- **Integrations**: `mcp-server/`, `internal-mcp/`

**Important Patterns:**
- Each module follows NestJS structure: controllers, services, DTOs
- Modules are independently testable with dependency injection
- OpenAPI schema generated from decorators
- Database operations use Prisma Client
- Real-time features use WebSocket gateways

### Frontend Architecture (apps/web + packages/ai-workspace-common)

**Framework**: React with TypeScript
**Build Tool**: Rsbuild (modern Rspack-based bundler)
**Styling**: Tailwind CSS utility-first approach
**State Management**: Zustand/Redux (check packages/stores)
**UI Components**: Shared in packages/ai-workspace-common

**Key Areas in ai-workspace-common:**
- `components/`: Reusable React components (Canvas, Editor, AI features)
- `hooks/`: Custom React hooks for state and logic
- `context/`: React context providers
- `queries/`: React Query hooks for API calls
- `requests/`: API request utilities
- `events/`: Event emitters and handlers
- `modules/`: Feature-specific modules
- `utils/`: Shared utility functions

### Inter-Package Communication

**Type Sharing**: `common-types` provides shared interfaces
**API Contract**: `openapi-schema` defines API structure
**Provider Abstraction**: `providers` abstracts LLM integrations
**Event System**: Custom event system for cross-component communication

## Code Style Requirements

### TypeScript/JavaScript
- **Always** use single quotes for strings
- **Always** use optional chaining (`?.`) for object property access
- **Always** use nullish coalescing (`??`) or default values for potentially undefined values
- **Always** check array existence before using array methods
- Use ES6+ features (arrow functions, destructuring, spread operators)
- Avoid magic numbers/strings - use named constants

### React Performance
- **Always** wrap pure components with `React.memo`
- **Always** use `useMemo` for expensive computations or complex object creation
- **Always** use `useCallback` for function props
- **Always** specify proper dependency arrays in `useEffect`
- **Always** avoid inline object/array creation in render
- **Always** use proper key props when rendering lists (avoid index keys)
- **Always** split nested components with closures into separate components

### Styling
- **Always** use Tailwind CSS for styling
- Group related utility classes together
- Prefer Tailwind utilities over custom CSS

### Error Handling
- **Always** handle potential errors in async operations
- Provide meaningful error messages for debugging
- Implement fallback UI for components that might fail
- Use error boundaries for runtime errors

### Comments and Documentation
- **Always** output code comments in English
- Document complex logic and non-obvious decisions
- Keep comments up-to-date with code changes

## Testing Guidelines

- Write unit tests for utility functions and services
- Write integration tests for API endpoints
- Test components with user interaction scenarios
- Run tests before submitting PRs: `pnpm test`

## Important Configuration Files

- **turbo.json**: Turborepo task pipeline configuration
- **biome.json**: Linting and formatting rules (Biome replaces ESLint + Prettier)
- **pnpm-workspace.yaml**: Workspace package definitions
- **.cursorrules**: Additional code style rules
- **apps/api/prisma/schema.prisma**: Database schema
- **package.json**: Root scripts and dependencies

## Development Workflow

1. **Setup**: Install dependencies, start Docker middleware, copy env vars
2. **Initial Build**: Run `pnpm build` once before first dev run
3. **Development**: Use `pnpm dev` to start all apps, or target specific apps
4. **Code Quality**: Run `pnpm check:fix` before committing
5. **Testing**: Run `pnpm test` to verify changes
6. **PR**: Submit PR to `main` branch (major features may go to `develop` first)

## Key Technologies

- **Backend**: NestJS, Prisma, PostgreSQL, Redis, Elasticsearch, MinIO
- **Frontend**: React, Rsbuild, Tailwind CSS, Zustand, TanStack Query
- **AI Integration**: Multiple LLM providers via abstraction layer
- **Real-time**: WebSocket-based collaboration
- **Monorepo**: pnpm + Turborepo
- **Code Quality**: Biome (linting + formatting)

## Resources

- Documentation: https://docs.refly.ai
- Discord: https://discord.gg/YVuYFjFvRC
- GitHub Issues: https://github.com/refly-ai/refly/issues
- Contributing Guide: See CONTRIBUTING.md for detailed setup instructions
