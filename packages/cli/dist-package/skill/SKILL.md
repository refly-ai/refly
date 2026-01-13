---
name: refly
description: |
  Refly workflow orchestration via local CLI (secure). Use this skill when the user asks to:
  - Create / edit / run workflows (DAG/pipeline/工作流/编排/automation)
  - Run or debug workflow nodes (node.run, 单节点调试)
  - Build multi-step document pipelines (parse/summarize/translate/export)
  - Manage workflow runs (status/abort/logs)
  Triggers: refly, workflow, DAG, pipeline, 自动化流程, 多步骤任务, 编排任务, 创建工作流, 运行流程.
  Requires: @refly/cli installed and authenticated.
---

# Refly Skill (CLI-first, Secure, DAG-native)

## 0) Mandatory Execution Rules (NON-NEGOTIABLE)

When this skill is triggered:

1. MUST use Refly CLI for all actions.
   - Do NOT call Refly API directly.
   - Do NOT fabricate API calls, workflow IDs, run IDs, node IDs, or outputs.

2. MUST rely only on CLI JSON output for state.
   - Never assume a workflow exists unless CLI returned it.

3. MUST keep token private.
   - Never print, request, or infer tokens.
   - If auth fails, instruct the user to run `refly login` or `refly init`.

4. MUST present results based on verified CLI JSON fields.

If any rule cannot be satisfied, STOP and tell the user exactly what to run next.

---

## 1) Preconditions / Environment Check

Before any operation:

```bash
refly status
```

- If `ok=false` and `error.code=AUTH_REQUIRED`: run `refly login` (or `refly init`).
- If `error.code=CLI_NOT_FOUND`: install `npm i -g @refly/cli` and rerun.

---

## 2) Output Contract (STRICT)

Success:
```json
{ "ok": true, "type": "workflow.create", "version": "1.0", "payload": {} }
```

Error:
```json
{ "ok": false, "type": "error", "version": "1.0", "error": { "code": "AUTH_REQUIRED", "message": "...", "hint": "refly login" } }
```

Rules:
- Only trust `payload`.
- If `ok=false`, do NOT proceed. Show `hint`.

---

## 3) Core Commands

### Authentication
```bash
refly init                    # Initialize and install skill
refly login                   # Authenticate with API key
refly logout                  # Remove credentials
refly status                  # Check CLI and auth status
refly whoami                  # Show current user
```

### Workflow CRUD
```bash
refly workflow create --name "<name>" --spec '<json>'
refly workflow generate --query "<natural language description>"  # AI-powered workflow generation
refly workflow edit <workflowId> --ops '<json>'
refly workflow get <workflowId>
refly workflow list
refly workflow delete <workflowId>
```

### Workflow Run & Monitoring
```bash
refly workflow run <workflowId> --input '<json>'
refly workflow status <runId>                    # Get detailed execution status
refly workflow status <runId> --watch            # Watch until completion (polls every 2s)
refly workflow run detail <runId>                # Full workflow execution detail
refly workflow run node <runId> <nodeId>         # Single node execution result
refly workflow run toolcalls <runId>             # All tool calls in workflow
refly workflow abort <runId>
```

### Node Operations
```bash
refly node types                                 # List available node types
refly node run --type "<nodeType>" --input '<json>'  # Run a node for debugging
refly node result <resultId>                     # Get node execution result
refly node result <resultId> --include-tool-calls    # Include tool call details
```

### Tool Inspection
```bash
refly tool calls --result-id <resultId>          # Get tool execution results for a node
refly tool get <callId>                          # Get single tool call detail
```

### Action Result
```bash
refly action result <resultId>                   # Action result with default sanitization
refly action result <resultId> --version <n>     # Specific version
refly action result <resultId> --raw             # Disable sanitization/truncation
refly action result <resultId> --include-files   # Include related files
```

### File Operations
```bash
refly file list                                  # List files
refly file list --canvas-id <id>                 # Filter by canvas
refly file get <fileId>                          # Get file metadata and content
refly file download <fileId> -o ./output.txt     # Download file to local filesystem
```

---

## 4) AI Workflow Generation

Use `workflow generate` to create workflows from natural language:

```bash
# Basic generation
refly workflow generate --query "Parse PDF, summarize content, translate to Chinese"

# With options
refly workflow generate \
  --query "Research topic, write article, export to markdown" \
  --model-id <modelId> \
  --locale zh \
  --timeout 300000

# With predefined variables
refly workflow generate \
  --query "Process documents from input folder" \
  --variables '[{"variableId":"v1","name":"inputFolder","variableType":"string"}]'
```

The generate command:
- Invokes AI to parse the natural language query
- Creates a workflow plan with tasks
- Builds the DAG with appropriate nodes and edges
- Returns workflowId, planId, and task details

---

## 5) DAG Rules (STRICT)

- Unique node ids.
- No cycles.
- Dependencies reference existing nodes only.
- Insert X between A→B by rewiring dependencies.

---

## 6) Workflow Spec Schema (v1)

```json
{
  "version": 1,
  "name": "string",
  "description": "string?",
  "nodes": [
    {
      "id": "string",
      "type": "string",
      "input": {},
      "dependsOn": ["string"]
    }
  ],
  "metadata": {
    "tags": ["string"],
    "owner": "string?"
  }
}
```

---

## 7) Error Codes

| Code | Description | Hint |
|------|-------------|------|
| AUTH_REQUIRED | Not authenticated | refly login |
| CLI_NOT_FOUND | CLI not installed | npm i -g @refly/cli |
| NETWORK_ERROR | API unreachable | Check connection |
| NOT_FOUND | Resource not found | Verify ID |
| CONFLICT | State conflict | Check status |
| INTERNAL_ERROR | Unexpected error | Report issue |

---

## 8) References

- `references/workflow-schema.md` - Full schema documentation
- `references/node-types.md` - Available node types
- `references/api-errors.md` - Complete error reference

## 9) Execution Results Workflow (Recommended)

Use this flow when tracking a running workflow and extracting results:

1. **Start run**: `refly workflow run <workflowId> --input '<json>'`
2. **Monitor status**: `refly workflow status <runId> --watch`
3. **On node finish**: `refly workflow run node <runId> <nodeId>`
4. **Tool calls** (optional): `refly workflow run toolcalls <runId>` or `refly tool get <callId>`
5. **Raw output** for debugging: add `--raw` to disable sanitization

## 10) CLI Backend API Reference (Workflow/Node/Tool)

Workflow:
- `POST /v1/cli/workflow` create
- `POST /v1/cli/workflow/generate` AI generate
- `GET /v1/cli/workflow` list
- `GET /v1/cli/workflow/:id` detail
- `PATCH /v1/cli/workflow/:id` update
- `DELETE /v1/cli/workflow/:id` delete
- `POST /v1/cli/workflow/:id/run` start run
- `GET /v1/cli/workflow/run/:runId` run status
- `POST /v1/cli/workflow/run/:runId/abort` abort run
- `GET /v1/cli/workflow/run/:runId/detail` run detail
- `GET /v1/cli/workflow/run/:runId/node/:nodeId` node result (workflow scope)
- `GET /v1/cli/workflow/run/:runId/toolcalls` tool calls (workflow scope)

Node:
- `GET /v1/cli/node/types` list node types
- `POST /v1/cli/node/run` run a single node (not implemented yet)

Tool:
- `GET /v1/cli/toolcall?resultId=<id>&version=<n>` tool calls for action result
- `GET /v1/cli/toolcall/:callId` single tool call detail

Action (related):
- `GET /v1/cli/action/result?resultId=<id>&version=<n>&sanitizeForDisplay=<bool>&includeFiles=<bool>`
