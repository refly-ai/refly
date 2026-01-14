# Node Reference

## Node Commands

```bash
refly node types
refly node run --type "<nodeType>" --input '<json>'
refly node result <resultId>
refly node result <resultId> --include-tool-calls
refly node result <resultId> --include-steps
refly node result <resultId> --include-messages
```

## Interaction

- `workflow run node <runId> <nodeId>` yields `resultId` used by node/tool commands.
- Use `node result` to fetch node output and optional file IDs.
- Use `tool calls` to inspect tool executions tied to a result.
- File IDs from node results should be handled via `file.md`.

## Node Result Commands

```bash
refly node result <resultId>
refly node result <resultId> --include-steps
refly node result <resultId> --include-messages
refly node result <resultId> --include-tool-calls
```

## Tool Commands

```bash
refly tool calls --result-id <resultId>
refly tool get <callId>
```

## Backend API (Node)

- GET /v1/cli/node/types list node types
- POST /v1/cli/node/run run a single node (not implemented yet)
- GET /v1/cli/node/result?resultId=<id> get node execution result

## Backend API (Tool)

- GET /v1/cli/toolcall?resultId=<id>&version=<n> tool calls for action result
- GET /v1/cli/toolcall/:callId single tool call detail
