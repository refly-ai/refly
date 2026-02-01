# Workflow Reference

## Workflow Commands

### Management

```bash
# Generate workflow from natural language
refly workflow generate [options]
  --query <query>            # Natural language description
  --canvas-id <id>           # Update existing workflow
  --model-id <id>            # Model for generation
  --locale <locale>          # Output language (en, zh)
  --timeout <ms>             # Timeout (default: 300000)
  --variables <json>         # Predefined variables
  --skip-default-nodes       # Skip default start+skillResponse
  --no-cleanup               # Disable orphan cleanup on failure

# Edit workflow
refly workflow edit <workflowId> [options]
  --name <name>              # New name
  --ops <json>               # Node/edge operations
  --variables <json>         # Variables array
  --toolsets <keys>          # Toolset keys (comma-separated)
  --auto-layout              # Auto-layout nodes

# Other management
refly workflow get <workflowId>
refly workflow delete <workflowId>
refly workflow list [--limit <n>] [--offset <n>]
refly workflow layout <workflowId> [--direction LR|TB]
refly workflow toolset-keys [--type <type>]
```

### Execution

```bash
# Start workflow run
refly workflow run start <workflowId> [options]
  --input <json>             # Input variables
  --from-node <nodeId>       # Run From Here

# Query run status
refly workflow run get <runId>
refly workflow run detail <runId> [--no-tool-calls] [--preview-length <n>]
refly workflow runs <workflowId> [--limit <n>] [--offset <n>] [--status <s>]
refly workflow status <id> [--watch] [--interval <ms>] [--full]
refly workflow detail <id> [--no-tool-calls] [--preview-length <n>]
refly workflow abort <workflowId>
```

### Node Operations

```bash
# List/get nodes
refly workflow node list <workflowId> [--include-edges] [--include-position] [--include-metadata]
refly workflow node get <id> <nodeId> [--include-connections]
refly workflow node output <id> <nodeId> [--include-tool-calls] [--raw]

# Run from node
refly workflow run node-start [options]
  --from <nodeId>            # Node to run from
  --run-id <runId>           # Existing run context
  --workflow-id <id>         # Start new run

# Node results
refly workflow run node-detail <runId> <nodeId> [--include-messages] [--raw]
refly workflow run node-result <resultId> [--include-steps] [--include-messages] [--include-tool-calls]
refly workflow run node-abort <resultId> [--version <n>]
```

### Tool Calls

```bash
# Workflow-level tool calls (full options)
refly workflow toolcalls <id> [options]
refly workflow run toolcalls <runId> [options]
  --node-id <nodeId>         # Filter by node
  --toolset-id <id>          # Filter by toolset
  --tool-name <name>         # Filter by tool name
  --status <status>          # Filter: executing, completed, failed
  --limit <n>                # Max results (default: 100)
  --offset <n>               # Pagination offset
  --raw                      # Full output without sanitization

# Node-level tool calls (limited options)
refly workflow run node-toolcalls <resultId> [options]
  --status <status>          # Filter: executing, completed, failed
  --tool-name <name>         # Filter by tool name
  --toolset-id <id>          # Filter by toolset

# Single tool call
refly workflow run node-toolcall <callId> [--raw]
```

## Interaction

- `workflow run start` returns `runId` used by `workflow run get` and `workflow run node-detail`.
- `workflow run node-detail` returns `resultId` for action/tool lookups (see `node.md`).
- `workflow node output` retrieves the actual execution output content of a node.
- Action results may include file IDs; use `file.md` to fetch/download.

## Node Output Command

Get the execution output content of a specific node:

```bash
# Using workflowId (gets output from latest run)
refly workflow node output c-xxx <nodeId>

# Using runId (gets output from specific run)
refly workflow node output we-xxx <nodeId>

# Include tool call details
refly workflow node output <id> <nodeId> --include-tool-calls

# Get full content without truncation (default: 10KB limit)
refly workflow node output <id> <nodeId> --raw
```

**ID Type Detection:**
- `c-xxx` prefix: Treated as workflowId, uses latest/active run
- `we-xxx` prefix: Treated as runId, uses specific run

**Security:** Node output access requires ownership verification at both workflow execution level and action result level (defense-in-depth).

## Workflow Generate Examples

```bash
refly workflow generate --query "Parse PDF, summarize content, translate to Chinese"
```

```bash
refly workflow generate \
  --query "Process documents from input folder" \
  --variables '[{"variableId":"v1","name":"inputFolder","variableType":"string"}]'
```
