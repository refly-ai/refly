# Node Reference

## Node Types

Examples below use two common node types:
- `start` - Workflow entry point that captures user input
- `skillResponse` - AI-powered response node that can use tools

## Node Execution Commands

Node execution commands are now under `refly workflow run`:

```bash
# Run From Here (from this node + downstream nodes)
refly workflow run node-start [options]
  --from <nodeId>            # Node to run from (includes downstream)
  --run-id <runId>           # Existing run context
  --workflow-id <id>         # Start new run from workflow

# Abort running node
refly workflow run node-abort <resultId> [options]
  --version <number>         # Specific version to abort

# Get node execution result
refly workflow run node-result <resultId> [options]
  --include-steps            # Include step details
  --include-messages         # Include chat messages
  --include-tool-calls       # Include tool call details

# Get node detail within a workflow run
refly workflow run node-detail <runId> <nodeId> [options]
  --include-messages         # Include AI messages
  --raw                      # Disable output sanitization

# List tool calls from node execution
refly workflow run node-toolcalls <resultId> [options]
  --status <status>          # Filter: executing, completed, failed
  --tool-name <name>         # Filter by tool name
  --toolset-id <id>          # Filter by toolset ID

# Single tool call detail
refly workflow run node-toolcall <callId> [options]
  --raw                      # Full output without sanitization
```

Note: Use `--run-id` when you already have a specific run context; use `--workflow-id` to start a new run from a node.

## List Nodes in Workflow

```bash
refly workflow node list <workflowId> [options]
  --include-edges            # Include edge/connection info
  --include-position         # Include node coordinates
  --include-metadata         # Include full node metadata
```

## Get Single Node Information

```bash
refly workflow node get <id> <nodeId> [options]
  --include-connections      # Include incoming/outgoing connections
```

Note: `<id>` can be workflow ID (`c-xxx`) or run ID (`we-xxx`).

## Interaction

- `workflow run node-detail <runId> <nodeId>` yields `resultId` used by node/tool commands.
- Use `workflow run node-result` to fetch node output and optional file IDs.
- Use `workflow run node-toolcalls` to inspect tool execution details.
- File IDs from node results should be handled via `file.md`.

## Migration Note

The following commands have been migrated:

| Old Command | New Command |
|-------------|-------------|
| `refly node run --type <t>` | **REMOVED** - Use `refly workflow run node-start --type <t>` |
| `refly node result <id>` | `refly workflow run node-result <id>` |
| `refly node abort <id>` | `refly workflow run node-abort <resultId>` |
| `refly workflow run node <runId> <nodeId>` | `refly workflow run node-detail <runId> <nodeId>` |

**Breaking Change:** The standalone `refly node` command group has been removed.
Node execution is now under `refly workflow run node-*`. For single-node debugging, use:
1. `refly workflow run node-start --type <t>`
2. Use `node-start --from <nodeId> --run-id <runId>` to run from node + downstream
