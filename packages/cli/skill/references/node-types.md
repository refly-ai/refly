# Node Types Reference

This document describes the available node types for Refly workflows.

## Fetching Node Types

Use the CLI to get the current list of supported node types:

```bash
refly node types
```

Response:
```json
{
  "ok": true,
  "type": "node.types",
  "version": "1.0",
  "payload": {
    "types": [
      {
        "name": "document.parse",
        "description": "Parse document content",
        "inputSchema": { ... },
        "outputSchema": { ... }
      }
    ]
  }
}
```

## Node Type Cache

- Location: `~/.refly/cache/node-types.json`
- TTL: 24 hours
- Force refresh: `refly node types --refresh`

## Common Node Categories

### Document Processing
- `document.parse` - Parse various document formats
- `document.export` - Export to different formats
- `document.split` - Split document into chunks

### LLM Operations
- `llm.summarize` - Summarize text content
- `llm.translate` - Translate content
- `llm.generate` - Generate content from prompt
- `llm.chat` - Interactive chat completion

### Data Operations
- `data.input` - Accept external input
- `data.output` - Produce workflow output
- `data.merge` - Merge multiple inputs
- `data.filter` - Filter data by criteria
- `data.transform` - Transform data structure

### Control Flow
- `control.condition` - Conditional branching
- `control.loop` - Iterate over items
- `control.parallel` - Parallel execution

## Testing Nodes

Run a single node for debugging:

```bash
refly node run --type "llm.summarize" --input '{"text": "Long text here..."}'
```

Response:
```json
{
  "ok": true,
  "type": "node.run",
  "version": "1.0",
  "payload": {
    "result": { ... },
    "metrics": {
      "durationMs": 1234,
      "tokensUsed": 500
    }
  }
}
```

## Notes

- Node types depend on your Refly backend configuration
- Some nodes may require specific permissions
- Input/output schemas are validated at runtime
