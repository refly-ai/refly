# Workflow Reference

## Workflow Commands

```bash
refly workflow create --name "<name>" --spec '<json>'
refly workflow generate --query "<natural language description>"
refly workflow edit <workflowId> --ops '<json>'
refly workflow get <workflowId>
refly workflow list
refly workflow delete <workflowId>
refly workflow run <workflowId> --input '<json>'
refly workflow status <runId>
refly workflow status <runId> --watch
refly workflow run detail <runId>
refly workflow run node <runId> <nodeId>
refly workflow run toolcalls <runId>
refly workflow abort <runId>
```

## Interaction

- `workflow run` returns `runId` used by `workflow status` and `workflow run node`.
- `workflow run node` returns `resultId` for action/tool lookups (see `node.md`).
- Action results may include file IDs; use `file.md` to fetch/download.

## Workflow Generate Examples

```bash
refly workflow generate --query "Parse PDF, summarize content, translate to Chinese"
```

```bash
refly workflow generate \
  --query "Research topic, write article, export to markdown" \
  --model-id <modelId> \
  --locale zh \
  --timeout 300000
```

```bash
refly workflow generate \
  --query "Process documents from input folder" \
  --variables '[{"variableId":"v1","name":"inputFolder","variableType":"string"}]'
```

## Workflow Spec Schema (v1)

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

## Backend API (Workflow)

- POST /v1/cli/workflow create
- POST /v1/cli/workflow/generate AI generate
- GET /v1/cli/workflow list
- GET /v1/cli/workflow/:id detail
- PATCH /v1/cli/workflow/:id update
- DELETE /v1/cli/workflow/:id delete
- POST /v1/cli/workflow/:id/run start run
- GET /v1/cli/workflow/run/:runId run status
- POST /v1/cli/workflow/run/:runId/abort abort run
- GET /v1/cli/workflow/run/:runId/detail run detail
- GET /v1/cli/workflow/run/:runId/node/:nodeId node result (workflow scope)
- GET /v1/cli/workflow/run/:runId/toolcalls tool calls (workflow scope)
