# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Refly is an open-source AI-native creation engine providing an agentic workspace for human-AI collaboration. It features multi-threaded conversations, canvas-based interfaces, knowledge base RAG integration, and intelligent search capabilities.

**Tech Stack**: TypeScript monorepo (pnpm + Turbo), NestJS backend, React frontend, Prisma ORM, Docker middleware

## Development Setup

### Prerequisites
- Node.js 20.19.0 (use nvm)
- pnpm 9.15.9
- Docker 20.10.0+

### Initial Setup

```bash
# 1. Start middleware (PostgreSQL, Redis, Elasticsearch, Qdrant, etc.)
docker compose -f deploy/docker/docker-compose.middleware.yml -p refly up -d
docker ps | grep refly_  # Verify all containers are healthy

# 2. Install dependencies
corepack enable
pnpm install

# 3. Setup environment variables
pnpm copy-env:develop

# 4. Build packages (required before first dev run)
pnpm build

# 5. Start development
pnpm dev  # Starts API + Web (excludes desktop)
```

### Development Servers

```bash
# All apps (excludes desktop)
pnpm dev

# Individual apps in separate terminals
cd apps/api && pnpm dev     # Backend on http://localhost:3000
cd apps/web && pnpm dev     # Frontend on http://localhost:5173

# Desktop app
pnpm dev:electron           # From root
# OR
cd apps/web && pnpm dev:electron     # Terminal 1
cd apps/desktop && pnpm dev:electron # Terminal 2
```

## Common Commands

### Building
```bash
pnpm build              # Build all packages
pnpm build:api          # Build API only
pnpm build:api:fast     # Fast API build
pnpm build:web          # Build web only
```

### Code Quality
```bash
pnpm check              # Lint + format check (Biome)
pnpm check:fix          # Auto-fix lint and format issues
pnpm lint               # Lint only
pnpm lint:fix           # Lint with auto-fix
pnpm format             # Format check
pnpm format:fix         # Format with auto-fix
```

### Testing
```bash
pnpm test               # Run all tests
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests only
pnpm cy:open            # Open Cypress for E2E tests
```

### Database (in apps/api/)
```bash
pnpm prisma:generate              # Generate Prisma client (PostgreSQL)
pnpm prisma:generate:sqlite       # Generate SQLite client (for desktop)
pnpm sync-db-schema               # Sync and format both schemas
pnpm format-schema                # Format Prisma schema files
```

### Utilities
```bash
pnpm i18n:check         # Verify i18n consistency across languages
pnpm clean              # Clean build artifacts
pnpm clean:node-modules # Remove all node_modules
pnpm commit             # Commitizen for conventional commits
```

## Architecture

### Monorepo Structure

**apps/** - Deployable applications:
- `api/` - NestJS backend server
- `web/` - React web application (Rsbuild)
- `desktop/` - Electron desktop app
- `extension/` - Browser extension for web clipping

**packages/** - Shared libraries:
- `ai-workspace-common/` - Shared React components, hooks, stores for AI features
- `common-types/` - TypeScript types shared across frontend/backend
- `providers/` - AI model provider abstractions (OpenAI, Anthropic, DeepSeek, etc.)
- `i18n/` - Internationalization (en-US, zh-Hans)
- `openapi-schema/` - API schema definitions
- `skill-template/` - AI skill templates
- `canvas-common/` - Shared canvas logic
- `utils/`, `errors/`, `agent-tools/`, etc.

### Backend Architecture (apps/api/)

**Framework**: NestJS with modular architecture

**Key Modules** (apps/api/src/modules/):
- `auth/` - Authentication & authorization (JWT, OAuth)
- `canvas/` - Canvas operations and state management
- `rag/` - Retrieval-Augmented Generation pipeline
- `knowledge/` - Knowledge base management
- `pilot/` - AI copilot features
- `skill/` - AI skills implementation
- `search/` - Search functionality (Elasticsearch integration)
- `collab/` - Real-time collaboration (WebSockets + y.js)
- `tool/` - Tool integrations including media generation
- `provider/` - AI model provider integrations
- `mcp-server/` - MCP (Model Context Protocol) server
- `user/`, `project/`, `share/`, `workflow/`, etc.

**Database**:
- PostgreSQL (production) via Prisma ORM
- SQLite (desktop) - separate schema at `prisma/sqlite-schema.prisma`
- Vector DB: Qdrant for embeddings
- Search: Elasticsearch for full-text search
- Cache/Session: Redis

**Real-time Collaboration**:
- Hocuspocus server for collaborative editing
- y.js CRDTs for conflict-free state synchronization
- Redis adapter for distributed collaboration

**AI Integration**:
- LangChain for RAG pipelines and agent orchestration
- 13+ model providers: DeepSeek, Claude, Gemini, OpenAI, etc.
- Vector embeddings stored in Qdrant and LanceDB

### Frontend Architecture (apps/web/)

**Framework**: React 18 with TypeScript

**Build Tool**: Rsbuild (Rspack-based, fast Webpack alternative)

**Key Patterns**:
- Canvas-based interface for AI content creation
- Multi-threaded conversation system
- Real-time collaboration with y.js
- Knowledge base integration with RAG search
- State management: Zustand (primary) + Redux DevTools

**Shared Components** (packages/ai-workspace-common/):
- Most reusable UI components live here
- Custom React hooks for AI interactions
- Shared stores for application state
- Feature modules organized by domain (canvas, editor, skill, etc.)

**Styling**: Tailwind CSS (utility-first)
**Routing**: React Router v6
**UI Components**: Ant Design + Radix UI + custom components
**Icons**: Lucide React + refly-icons

### Multi-modal Processing

**File Formats**: PDF, DOCX, RTF, TXT, MD, HTML, EPUB (via pdf-parse, cheerio)
**Images**: PNG, JPG, JPEG, BMP, GIF, SVG, WEBP (via Sharp)
**Media Generation**: Integration with Replicate, FAL.ai, Fish Audio, HeyGen

## Critical Code Style Rules

These rules are enforced and must be followed:

### String Literals
- Always use single quotes for strings in JavaScript/TypeScript

### Null Safety
- Always use optional chaining (`?.`) when accessing object properties
- Always use nullish coalescing (`??`) or default values for potentially undefined values
- Always check array existence before using array methods
- Always validate object properties before destructuring

### React Performance
- Always wrap pure components with `React.memo` to prevent unnecessary re-renders
- Always use `useMemo` for expensive computations or complex object creation
- Always use `useCallback` for function props to maintain referential equality
- Always specify proper dependency arrays in `useEffect` to prevent infinite loops
- Always avoid inline object/array creation in render to prevent unnecessary re-renders
- Always use proper key props when rendering lists
- Always split nested components with closures into separate components to avoid performance issues

### TypeScript
- Avoid `any` type - use `unknown` with type guards instead
- Always define explicit return types for functions
- Prefer extending existing types over creating entirely new ones
- Use TypeScript utility types: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Readonly<T>`, `Record<K, T>`
- Always import types explicitly using `import type` syntax

### Comments and Styling
- Always output code comments in English
- Always use Tailwind CSS to style components

## Development Patterns

### Adding Backend Features (NestJS)

1. Create module in `apps/api/src/modules/<feature>/`
2. Structure: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`
3. Use dependency injection throughout
4. Define DTOs with Zod validation
5. Update OpenAPI schema in `packages/openapi-schema/`
6. Follow NestJS module structure and best practices

### Adding Frontend Features (React)

1. Add shared components to `packages/ai-workspace-common/src/components/`
2. Create custom hooks in `hooks/` directory
3. Add state management (Zustand stores) in `stores/`
4. Ensure proper TypeScript types
5. Add i18n keys to BOTH `packages/i18n/src/en-US/` AND `packages/i18n/src/zh-Hans/`
6. Use Tailwind for all styling

### Internationalization (i18n)

All user-facing text MUST be translatable:

```tsx
import { useTranslation } from '@refly/i18n';

function MyComponent() {
  const { t } = useTranslation();
  return <div>{t('key.path')}</div>;
}
```

- Add keys to both `en-US` and `zh-Hans` directories
- Use hierarchical structure for nested components
- Run `pnpm i18n:check` to verify consistency

### Database Changes

After modifying `apps/api/prisma/schema.prisma`:

```bash
cd apps/api
pnpm prisma:generate    # Generate Prisma client
pnpm sync-db-schema     # Sync PostgreSQL and SQLite schemas
```

Desktop uses SQLite (`sqlite-schema.prisma`) - keep both schemas in sync.

### Testing Guidelines

- **Unit Tests**: Vitest (frontend), Jest (backend)
- **Integration Tests**: Test API endpoints and component interactions
- **E2E Tests**: Cypress for critical user flows
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests independent and atomic

## Key Technical Concepts

### Multi-threaded Conversations
Built on an innovative architecture enabling parallel management of independent conversation contexts with efficient state management and context switching.

### RAG Pipeline
- Vector search via Qdrant
- Full-text search via Elasticsearch
- LangChain for retrieval and generation
- Knowledge base integration with semantic retrieval

### Real-time Collaboration
- y.js CRDTs for conflict-free state sync
- Hocuspocus server for WebSocket connections
- Redis for distributed state management
- Supports multi-user editing on canvas

### AI Skill System
Integrating capabilities from Perplexity AI, Stanford Storm, and more:
- Web-wide search and information aggregation
- Vector database knowledge retrieval
- Smart query rewriting
- AI-assisted document generation

### Context Management
- Precise temporary knowledge base construction
- Flexible node selection mechanism
- Multi-dimensional context correlation
- Cursor-like intelligent context understanding

## Important Notes

- **Middleware Dependency**: Docker middleware MUST be running before starting development
- **First Build**: Run `pnpm build` once before first `pnpm dev` to build all packages
- **Turborepo Caching**: Turbo caches build outputs - use `pnpm clean` if issues arise
- **Desktop vs Web**: Desktop uses SQLite, web uses PostgreSQL
- **Code Comments**: Always write in English, even if supporting multiple UI languages
- **Error Handling**: Use error definitions from `packages/errors/` for consistency across the app
