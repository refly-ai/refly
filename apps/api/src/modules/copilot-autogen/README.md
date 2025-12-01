# Copilot Autogen Module

⚠️ **This is a temporary automation feature for scripted workflow generation.**

## Purpose

This module provides an API endpoint that automates the Copilot workflow generation process, allowing external scripts to:
1. Invoke Copilot with a natural language query
2. Wait for the workflow plan to be generated
3. Automatically create/update a Canvas with the generated nodes and edges

## Usage

### API Endpoint

`POST /v1/copilot-autogen/generate`

### Request Body

```json
{
  "uid": "user_123",
  "query": "Create a blog post generation workflow",
  "canvasId": "optional_canvas_id",
  "projectId": "optional_project_id",
  "locale": "zh-CN",
  "modelItemId": "optional_model_id"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "canvasId": "canvas_xxx",
    "workflowPlan": { ... },
    "sessionId": "session_xxx",
    "resultId": "result_xxx",
    "nodesCount": 5,
    "edgesCount": 4
  }
}
```

## Implementation Details

- **Service Reuse**: Maximizes reuse of existing services (SkillService, ActionService, CanvasService)
- **Polling Mechanism**: Polls ActionService every 2 seconds with 5-minute timeout
- **Logging**: Comprehensive logging with `[Autogen]` prefix for easy filtering
- **Error Handling**: Clear error messages for timeout, execution failures, and invalid outputs

## Testing

Run the test script:

```bash
cd scripts
cp env.autogen.example .env.autogen
# Edit .env.autogen with your test user ID
export $(cat .env.autogen | xargs)
npx tsx test-copilot-autogen.ts
```

## Architecture

### Service Dependencies

- **PrismaService**: User data access
- **SkillService**: Copilot invocation
- **ActionService**: Result polling and retrieval
- **CanvasService**: Canvas creation and metadata updates
- **ToolService**: Available tools listing
- **ProviderService**: Default model configuration
- **CanvasSyncService**: Canvas state management with Yjs

### Key Methods

#### `generateWorkflow(request)`
Main entry point that orchestrates the entire workflow generation process.

#### `waitForActionCompletion(user, resultId)`
Polls the ActionService until the Copilot execution completes or times out.

#### `extractWorkflowPlan(actionResult)`
Extracts the Workflow Plan from the `generate_workflow` tool call output.

#### `updateCanvasState(canvasId, nodes, edges, variables, user)`
Updates the Canvas state using Yjs and CanvasSyncService.

## Notes

- This is a **temporary feature** designed for scripted automation
- No authentication middleware is applied (add as needed for production)
- Polling interval and timeout can be adjusted based on requirements
- Canvas state updates rely on CanvasSyncService being properly configured

