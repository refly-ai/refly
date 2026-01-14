# Node Reference

## Node Commands

```bash
refly node types
refly node run --type "<nodeType>" --input '<json>'
refly node result <resultId>
refly node result <resultId> --include-tool-calls
```

## Interaction

- `workflow run node <runId> <nodeId>` yields `resultId` used by action/tool commands.
- Use `action result` to fetch node output and optional file IDs.
- Use `tool calls` to inspect tool executions tied to a result.
- File IDs from action results should be handled via `file.md`.

## Action-Backed Commands (Node Results)

```bash
refly action result <resultId>
refly action result <resultId> --version <n>
refly action result <resultId> --raw
refly action result <resultId> --include-files
```

## Tool Commands (Action Results)

```bash
refly tool calls --result-id <resultId>
refly tool get <callId>
```

## Backend API (Node)

- GET /v1/cli/node/types list node types
- POST /v1/cli/node/run run a single node (not implemented yet)

## Backend API (Action)

- GET /v1/cli/action/result?resultId=<id>&version=<n>&sanitizeForDisplay=<bool>&includeFiles=<bool>

## Backend API (Tool)

- GET /v1/cli/toolcall?resultId=<id>&version=<n> tool calls for action result
- GET /v1/cli/toolcall/:callId single tool call detail
