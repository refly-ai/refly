# API Errors Reference

All CLI errors use stable error codes for reliable error handling.

## Error Response Format

```json
{
  "ok": false,
  "type": "error",
  "version": "1.0",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { },
    "hint": "Suggested action"
  }
}
```

## Error Codes

### Authentication Errors

| Code | Description | Hint |
|------|-------------|------|
| AUTH_REQUIRED | Not authenticated or token expired | Run `refly login` |
| AUTH_INVALID | Invalid credentials | Check API key |
| AUTH_EXPIRED | Token has expired | Run `refly login` |

### CLI Errors

| Code | Description | Hint |
|------|-------------|------|
| CLI_NOT_FOUND | CLI not installed or not in PATH | Run `npm i -g @refly/cli` |
| CONFIG_ERROR | Configuration file corrupted | Run `refly init` |
| VERSION_MISMATCH | CLI version incompatible with API | Run `npm update -g @refly/cli` |

### Builder Errors

| Code | Description | Hint |
|------|-------------|------|
| BUILDER_NOT_STARTED | No active builder session | Run `refly builder start` |
| BUILDER_ALREADY_STARTED | Builder session already exists | Run `refly builder abort` first |
| VALIDATION_REQUIRED | Must validate before commit | Run `refly builder validate` |
| VALIDATION_ERROR | DAG validation failed | See error details |
| DUPLICATE_NODE_ID | Node ID already exists | Use unique node ID |
| NODE_NOT_FOUND | Referenced node does not exist | Check node ID |
| CYCLE_DETECTED | Circular dependency in DAG | Remove cycle |
| INVALID_STATE | Invalid state transition | Check `refly builder status` |

### Workflow Errors

| Code | Description | Hint |
|------|-------------|------|
| WORKFLOW_NOT_FOUND | Workflow does not exist | Check workflow ID |
| WORKFLOW_EXISTS | Workflow name already taken | Use different name |
| RUN_NOT_FOUND | Workflow run does not exist | Check run ID |
| RUN_FAILED | Workflow execution failed | Check run details |
| RUN_ABORTED | Workflow was aborted | - |

### Node Errors

| Code | Description | Hint |
|------|-------------|------|
| INVALID_NODE_TYPE | Unknown node type | Run `refly node types` |
| INVALID_NODE_INPUT | Node input validation failed | Check input schema |
| NODE_EXECUTION_ERROR | Node execution failed | See error details |

### Network Errors

| Code | Description | Hint |
|------|-------------|------|
| NETWORK_ERROR | Cannot connect to API | Check internet connection |
| TIMEOUT | Request timed out | Retry later |
| API_ERROR | API returned error | See error message |

### General Errors

| Code | Description | Hint |
|------|-------------|------|
| NOT_FOUND | Resource not found | Verify resource ID |
| CONFLICT | Resource conflict | Refresh and retry |
| PERMISSION_DENIED | Insufficient permissions | Check access rights |
| INVALID_INPUT | Invalid input data | Check input format |
| INTERNAL_ERROR | Unexpected error | Report issue |

## Handling Errors

### In Claude Code

When `ok=false`:
1. Do NOT proceed with the operation
2. Show the user the `error.message`
3. Suggest the action in `error.hint`
4. If `error.details` exists, include relevant information

### Example Error Handling

```bash
# Check status before operations
result=$(refly status)
if [ "$(echo $result | jq -r '.ok')" = "false" ]; then
  code=$(echo $result | jq -r '.error.code')
  hint=$(echo $result | jq -r '.error.hint')
  echo "Error: $code. Try: $hint"
  exit 1
fi
```

## Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication error |
| 3 | Validation error |
| 4 | Network error |
| 5 | Not found |
