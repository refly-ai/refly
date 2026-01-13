# Workflow Schema Reference

This document defines the canonical workflow spec used by `refly workflow create --spec`.

## Spec Shape (v1)

```json
{
  "version": 1,
  "name": "string (required)",
  "description": "string (optional)",
  "nodes": [
    {
      "id": "string (required, unique)",
      "type": "string (required, must be valid node type)",
      "input": "object (required, node-specific configuration)",
      "dependsOn": "string[] (optional, list of node IDs)"
    }
  ],
  "metadata": {
    "tags": "string[] (optional)",
    "owner": "string (optional)"
  }
}
```

## Field Descriptions

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | number | Yes | Schema version, currently `1` |
| name | string | Yes | Workflow name, must be unique per user |
| description | string | No | Human-readable description |
| nodes | array | Yes | List of workflow nodes |
| metadata | object | No | Additional metadata |

### Node Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier within workflow |
| type | string | Yes | Node type from `refly node types` |
| input | object | Yes | Node-specific input configuration |
| dependsOn | string[] | No | IDs of nodes that must complete first |

## DAG Rules

1. **Unique IDs**: Each node `id` must be unique within the workflow
2. **No Cycles**: The dependency graph must be acyclic
3. **Valid References**: All `dependsOn` entries must reference existing node IDs
4. **No Self-Reference**: A node cannot depend on itself
5. **Valid Types**: All `type` values must be in the allowed node types list

## Examples

### Simple Sequential Workflow

```json
{
  "version": 1,
  "name": "document-processor",
  "nodes": [
    { "id": "parse", "type": "document.parse", "input": { "format": "pdf" } },
    { "id": "summarize", "type": "llm.summarize", "input": {}, "dependsOn": ["parse"] },
    { "id": "export", "type": "document.export", "input": { "format": "md" }, "dependsOn": ["summarize"] }
  ]
}
```

### Parallel Processing

```json
{
  "version": 1,
  "name": "parallel-analysis",
  "nodes": [
    { "id": "input", "type": "data.input", "input": {} },
    { "id": "analyze-a", "type": "analyze.sentiment", "input": {}, "dependsOn": ["input"] },
    { "id": "analyze-b", "type": "analyze.keywords", "input": {}, "dependsOn": ["input"] },
    { "id": "merge", "type": "data.merge", "input": {}, "dependsOn": ["analyze-a", "analyze-b"] }
  ]
}
```

## Validation Errors

| Error | Description |
|-------|-------------|
| DUPLICATE_NODE_ID | Two nodes have the same ID |
| INVALID_NODE_TYPE | Node type not in allowed list |
| MISSING_DEPENDENCY | dependsOn references non-existent node |
| CYCLE_DETECTED | Circular dependency found |
| MISSING_REQUIRED_FIELD | Required field is missing |
