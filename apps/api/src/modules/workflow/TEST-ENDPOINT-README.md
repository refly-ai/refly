# Workflow Test Endpoint

## Overview

A test endpoint has been added to the Workflow controller to facilitate local testing without JWT authentication.

## Endpoint

**POST** `/v1/workflow/initialize-test`

## Purpose

This endpoint is designed for **local development and testing only**. It allows scripts and tests to initialize workflows without requiring JWT token authentication.

## Request Body

```json
{
  "uid": "user_id",           // Required: User ID
  "canvasId": "canvas_xxx",   // Required: Canvas ID
  "variables": [...],         // Optional: Workflow variables
  "nodeBehavior": "update",   // Optional: Node behavior (default: "update")
  "sourceCanvasId": "...",    // Optional: Source canvas ID
  "sourceCanvasData": {...},  // Optional: Source canvas data
  "createNewCanvas": false,   // Optional: Whether to create new canvas
  "startNodes": [...]         // Optional: Start node IDs
}
```

## Response

```json
{
  "success": true,
  "data": {
    "workflowExecutionId": "we_xxx"
  }
}
```

## Security Considerations

⚠️ **WARNING**: This endpoint bypasses authentication and should **NEVER** be deployed to production.

### Recommendations:

1. **Remove before production deployment**
2. **Use environment variable to enable/disable**
3. **Add IP whitelist if necessary**
4. **Monitor usage logs**

## Implementation Details

- Located in: `apps/api/src/modules/workflow/workflow.controller.ts`
- Method: `initializeWorkflowTest()`
- No authentication guard (`@UseGuards(JwtAuthGuard)` is NOT applied)
- Sets `checkCanvasOwnership: false` to skip ownership validation

## Usage Example

### Python Script

```python
import requests

response = requests.post(
    "http://localhost:5800/v1/workflow/initialize-test",
    json={
        "uid": "user_123",
        "canvasId": "canvas_xxx",
        "variables": [...],
        "nodeBehavior": "update"
    }
)

data = response.json()
execution_id = data["data"]["workflowExecutionId"]
```

### curl

```bash
curl -X POST http://localhost:5800/v1/workflow/initialize-test \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user_123",
    "canvasId": "canvas_xxx",
    "variables": [],
    "nodeBehavior": "update"
  }'
```

## Related Files

- Controller: `apps/api/src/modules/workflow/workflow.controller.ts`
- Test Script: `scripts/copilot-autogen/test-workflow-execution.py`
- Documentation: `scripts/copilot-autogen/README-workflow-execution.md`

## Removal Instructions

To remove this test endpoint before production:

1. Delete the `initializeWorkflowTest()` method from `workflow.controller.ts`
2. Remove this README file
3. Update test scripts to use the authenticated `/v1/workflow/initialize` endpoint with proper JWT tokens

## Alternative Approaches

If you need to test workflows in production-like environments, consider:

1. **Use JWT tokens**: Implement proper authentication in your test scripts
2. **Service accounts**: Create dedicated test user accounts with tokens
3. **API keys**: Implement API key authentication for scripts

