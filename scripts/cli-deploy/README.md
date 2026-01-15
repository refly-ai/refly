# Refly CLI One-Click Deployment

This directory contains scripts for quickly deploying and setting up Refly CLI for local development.

## Quick Start

If you already have the refly repository cloned:

```bash
./quick-start.sh
```

This will:
1. Build the CLI package
2. Start Docker services (PostgreSQL, Redis, etc.)
3. Run database migrations
4. Seed global tools data
5. Start the API server
6. Guide you through OAuth login
7. Generate an API key

## Full Deployment

For a complete fresh deployment (including cloning the repo):

```bash
./deploy-cli.sh
```

### Options

```bash
# Skip specific steps
./quick-start.sh --skip-build      # Skip building CLI
./quick-start.sh --skip-services   # Skip Docker services
./quick-start.sh --skip-seed       # Skip seeding data
./quick-start.sh --skip-api        # Skip starting API
./quick-start.sh --skip-auth       # Skip authentication

# Full deploy options
./deploy-cli.sh --skip-clone       # Skip git clone/update
./deploy-cli.sh --refly-dir ~/my-refly  # Custom install directory
./deploy-cli.sh --branch main      # Use different branch
```

## Directory Structure

```
scripts/cli-deploy/
├── README.md                  # This file
├── deploy-cli.sh              # Full deployment script
├── quick-start.sh             # Quick start for existing repos
├── seed-tools.mjs             # Seeds toolset_inventory & toolsets
├── generate-apikey.mjs        # Generates API key after login
├── export-tool-methods.mjs    # Export tool_methods from DB
└── seed-data/
    └── tool_methods.json      # Tool method definitions
```

## Scripts

### deploy-cli.sh

Full deployment script that:
- Clones/updates the refly repository
- Installs dependencies
- Builds the CLI
- Starts all services
- Seeds the database
- Sets up authentication

### quick-start.sh

Simplified script for users who already have the codebase. Focuses on:
- Building the CLI
- Starting services
- Seeding data
- Authentication

### seed-tools.mjs

Seeds the database with:
- `toolset_inventory` - Tool catalog with descriptions and API keys
- `toolsets` - Global tool instances
- `tool_methods` - Tool API definitions (from `seed-data/tool_methods.json`)

Run manually:
```bash
cd apps/api
node ../../scripts/cli-deploy/seed-tools.mjs
```

### generate-apikey.mjs

Generates an API key after OAuth login and saves it to the CLI config.

Run manually:
```bash
cd apps/api
node ../../scripts/cli-deploy/generate-apikey.mjs
```

### export-tool-methods.mjs

Exports tool_methods from an existing database to JSON file.

Run manually:
```bash
cd apps/api
node ../../scripts/cli-deploy/export-tool-methods.mjs
```

## Environment Variables

The scripts use these environment variables (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `REFLY_DIR` | `~/refly` | Installation directory |
| `REFLY_REPO` | `https://github.com/refly-ai/refly.git` | Git repository URL |
| `REFLY_BRANCH` | `feat/cli/init` | Git branch to use |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `35432` | Database port |
| `DB_USER` | `refly` | Database user |
| `DB_PASSWORD` | `test` | Database password |
| `DB_NAME` | `refly` | Database name |
| `API_PORT` | `5800` | API server port |

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Git

## Troubleshooting

### API server not starting

Check logs:
```bash
cat /tmp/refly-api.log
```

### Database connection failed

Ensure Docker containers are running:
```bash
docker ps
docker-compose -f deploy/docker/docker-compose.dev.yml logs db
```

### OAuth login issues

1. Check API is running: `curl http://localhost:5800/health`
2. Check browser console for errors
3. Try device flow login: `refly login --device`

### Seeding failed

1. Ensure database migrations ran: `cd apps/api && pnpm prisma db push`
2. Check Prisma client: `cd apps/api && pnpm prisma generate`
3. Run seed manually: `node scripts/cli-deploy/seed-tools.mjs`

## After Setup

The CLI is ready at `packages/cli/dist/bin/refly.js`

```bash
# Check status
node packages/cli/dist/bin/refly.js status

# List workflows
node packages/cli/dist/bin/refly.js workflow list

# Start workflow builder
node packages/cli/dist/bin/refly.js builder start

# Link globally (optional)
cd packages/cli && pnpm link --global
refly status
```

## Stopping Services

```bash
# Stop API server
kill $(cat /tmp/refly-api.pid)

# Stop Docker containers
docker-compose -f deploy/docker/docker-compose.dev.yml down
```
