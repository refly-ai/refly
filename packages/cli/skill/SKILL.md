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
   - Never assume builder state unless `refly builder status` confirms it.

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

### Builder Mode (Local State Machine)

Use Builder for multi-step workflow construction:

```bash
refly builder start --name "<workflowName>"
refly builder add-node --node '<json>'
refly builder update-node --id "<nodeId>" --patch '<json>'
refly builder remove-node --id "<nodeId>"
refly builder connect --from "<nodeId>" --to "<nodeId>"
refly builder disconnect --from "<nodeId>" --to "<nodeId>"
refly builder status
refly builder graph
refly builder validate
refly builder commit
refly builder abort
```

### Workflow CRUD
```bash
refly workflow create --name "<name>" --spec '<json>'
refly workflow edit <workflowId> --ops '<json>'
refly workflow get <workflowId>
refly workflow list
refly workflow delete <workflowId>
```

### Workflow Run
```bash
refly workflow run <workflowId> --input '<json>'
refly workflow run get <runId>
refly workflow abort <runId>
```

### Node Debug
```bash
refly node types
refly node run --type "<nodeType>" --input '<json>'
```

---

## 4) DAG Rules (STRICT)

- Unique node ids.
- No cycles.
- Dependencies reference existing nodes only.
- Insert X between A→B by rewiring dependencies.

---

## 5) Builder State Machine

Builder state is owned by CLI and persisted locally.

### States
- `IDLE` - No active draft
- `DRAFT` - Editing in progress
- `VALIDATED` - DAG validation passed
- `COMMITTED` - Workflow created

### Transitions
- `IDLE` → `DRAFT`: `builder start`
- `DRAFT` → `VALIDATED`: `builder validate` (success)
- `VALIDATED` → `DRAFT`: Any edit operation
- `VALIDATED` → `COMMITTED`: `builder commit`
- Any → `IDLE`: `builder abort`

### Rules
- Cannot commit unless VALIDATED
- Any edit invalidates validation
- COMMITTED sessions are read-only

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
| BUILDER_NOT_STARTED | No active builder session | refly builder start |
| VALIDATION_REQUIRED | Must validate before commit | refly builder validate |
| VALIDATION_ERROR | DAG validation failed | Check error details |
| DUPLICATE_NODE_ID | Node ID already exists | Use unique ID |
| NETWORK_ERROR | API unreachable | Check connection |
| NOT_FOUND | Resource not found | Verify ID |
| CONFLICT | State conflict | Check status |

---

## 8) References

- `references/workflow-schema.md` - Full schema documentation
- `references/node-types.md` - Available node types
- `references/api-errors.md` - Complete error reference
