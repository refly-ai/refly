# @refly/cli

> Refly CLI - Workflow orchestration for Claude Code

A command-line interface for building, managing, and executing Refly workflows with deterministic state management.

## Features

- **Builder Mode**: Incrementally build workflows with local state persistence
- **DAG Validation**: Automatic cycle detection and dependency validation
- **JSON-First**: All commands output structured JSON for reliable automation
- **Claude Code Integration**: SKILL.md installation for seamless Claude Code usage
- **Secure**: Token storage with file permissions, never exposed in logs

## Installation

```bash
npm install -g @refly/cli
```

## Quick Start

```bash
# Initialize and install skill files
refly init

# Authenticate
refly login

# Start building a workflow
refly builder start --name "my-workflow"

# Add nodes
refly builder add-node --node '{"id":"parse","type":"document.parse","input":{}}'
refly builder add-node --node '{"id":"summarize","type":"llm.summarize","input":{},"dependsOn":["parse"]}'

# Validate and commit
refly builder validate
refly builder commit

# Run the workflow
refly workflow run <workflowId>
```

## Core Commands

### Authentication

```bash
refly init                    # Initialize CLI and install skill files
refly login                   # Authenticate with API key
refly logout                  # Remove credentials
refly status                  # Check configuration and auth status
refly whoami                  # Show current user
```

### Builder Mode

Build workflows incrementally with local state:

```bash
refly builder start --name "workflow-name"
refly builder add-node --node '<json>'
refly builder update-node --id "<nodeId>" --patch '<json>'
refly builder remove-node --id "<nodeId>"
refly builder connect --from "<nodeId>" --to "<nodeId>"
refly builder disconnect --from "<nodeId>" --to "<nodeId>"
refly builder status
refly builder graph [--ascii]
refly builder validate
refly builder commit
refly builder abort
```

### Workflow Management

```bash
refly workflow create --name "<name>" --spec '<json>'
refly workflow list [--limit N]
refly workflow get <workflowId>
refly workflow edit <workflowId> --ops '<json>'
refly workflow delete <workflowId>
```

### Workflow Execution

```bash
refly workflow run <workflowId> [--input '<json>']
refly workflow run-status <runId>
refly workflow abort <runId>
```

### Node Debugging

```bash
refly node types [--category <category>]
refly node run --type "<nodeType>" --input '<json>'
```

## Builder State Machine

The builder uses a deterministic state machine:

```
IDLE → DRAFT → VALIDATED → COMMITTED
  ↑      ↓          ↓
  └──────┴──────────┘
       (abort)
```

**States:**
- `IDLE`: No active session
- `DRAFT`: Editing in progress
- `VALIDATED`: DAG validation passed
- `COMMITTED`: Workflow created (terminal)

**Rules:**
- Any edit operation invalidates validation
- Only VALIDATED sessions can be committed
- COMMITTED sessions are read-only

## JSON Output Format

All commands output JSON with this structure:

**Success:**
```json
{
  "ok": true,
  "type": "workflow.create",
  "version": "1.0",
  "payload": { ... }
}
```

**Error:**
```json
{
  "ok": false,
  "type": "error",
  "version": "1.0",
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Not authenticated",
    "hint": "refly login"
  }
}
```

## Configuration

Configuration is stored in `~/.refly/config.json`:

```json
{
  "version": 1,
  "auth": {
    "apiKey": "...",
    "expiresAt": "..."
  },
  "api": {
    "endpoint": "https://api.refly.ai"
  }
}
```

**Environment Variables:**
- `REFLY_API_KEY`: API key for authentication
- `REFLY_API_ENDPOINT`: Override API endpoint

## Claude Code Integration

After running `refly init`, skill files are installed to:
- `~/.claude/skills/refly/SKILL.md`
- `~/.claude/skills/refly/references/`
- `~/.claude/commands/refly-*.md` (if commands directory exists)

This enables Claude Code to:
- Understand Refly workflow concepts
- Use builder mode correctly
- Handle state transitions
- Output deterministic results

## Error Codes

| Code | Description | Hint |
|------|-------------|------|
| AUTH_REQUIRED | Not authenticated | refly login |
| BUILDER_NOT_STARTED | No active builder session | refly builder start |
| VALIDATION_REQUIRED | Must validate before commit | refly builder validate |
| VALIDATION_ERROR | DAG validation failed | Check error details |
| DUPLICATE_NODE_ID | Node ID already exists | Use unique ID |
| CYCLE_DETECTED | Circular dependency | Remove cycle |
| WORKFLOW_NOT_FOUND | Workflow does not exist | Check workflow ID |

## Examples

### Build a Document Processing Workflow

```bash
# Start builder
refly builder start --name "doc-processor"

# Add nodes
refly builder add-node --node '{
  "id": "input",
  "type": "document.input",
  "input": {"format": "pdf"}
}'

refly builder add-node --node '{
  "id": "parse",
  "type": "document.parse",
  "input": {},
  "dependsOn": ["input"]
}'

refly builder add-node --node '{
  "id": "summarize",
  "type": "llm.summarize",
  "input": {"maxLength": 500},
  "dependsOn": ["parse"]
}'

refly builder add-node --node '{
  "id": "export",
  "type": "document.export",
  "input": {"format": "markdown"},
  "dependsOn": ["summarize"]
}'

# Validate and commit
refly builder validate
refly builder commit
```

### Run a Workflow

```bash
# Run with input
refly workflow run wf-abc123 --input '{"documentUrl": "https://..."}'

# Check status
refly workflow run-status run-xyz789
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Run locally
node dist/bin/refly.js
```

## License

MIT
