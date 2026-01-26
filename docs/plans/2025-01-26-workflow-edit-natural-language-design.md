# Plan: Workflow Edit with Natural Language

## Summary

Add a new API endpoint and CLI command that allows users to edit workflows using natural language. The backend will invoke Copilot Agent to parse the user's intent and apply the appropriate workflow modifications.

**Scope**: Supports both `generate_workflow` and `patch_workflow` tool outputs from Copilot.

---

## Background

### Current Architecture

```
User (structured ops) → CLI edit command → patchWorkflowPlan API → Direct DB update
```

### Problem

1. CLI `edit` command requires complex JSON operations
2. Existing `generateWorkflow` API only handles `generate_workflow` tool output
3. If Copilot calls `patch_workflow`, the current code fails

### Solution

Add a new edit API that:
1. Accepts natural language input
2. Invokes Copilot Agent
3. Handles both `generate_workflow` and `patch_workflow` tool outputs

---

## Implementation

### 1. Backend API

**File**: `apps/api/src/modules/workflow/workflow-cli.controller.ts`

**Endpoint**: `POST /v1/cli/workflow/edit`

**Request DTO** (`workflow-cli.dto.ts`):
```typescript
interface EditWorkflowCliRequest {
  canvasId: string;           // Required: Canvas ID to edit
  query: string;              // Required: Natural language instruction
  locale?: string;            // Optional: Output language
  modelItemId?: string;       // Optional: Model to use
  timeout?: number;           // Optional: Timeout in ms (default: 60000)
}
```

**Response DTO**:
```typescript
interface EditWorkflowCliResponse {
  canvasId: string;
  planId: string;
  version: number;
  toolUsed: 'generate_workflow' | 'patch_workflow';
  plan: WorkflowPlan;
}
```

**Controller Logic**:
```typescript
@Post('edit')
async editWorkflow(
  @LoginedUser() user: User,
  @Body() body: EditWorkflowCliRequest,
): Promise<{ success: boolean; data: EditWorkflowCliResponse }> {
  // 1. Validate canvas exists and belongs to user
  const canvas = await this.prisma.canvas.findFirst({
    where: { canvasId: body.canvasId, uid: user.uid, deletedAt: null }
  });
  if (!canvas) {
    throwCliError('NOT_FOUND', `Canvas ${body.canvasId} not found or access denied`);
  }

  // 2. Get existing copilot session for context continuity
  const session = await this.prisma.copilotSession.findFirst({
    where: { canvasId: body.canvasId, uid: user.uid },
    orderBy: { createdAt: 'desc' }
  });

  // 3. Invoke Copilot Agent
  const invokeRequest: InvokeSkillRequest = {
    input: { query: body.query },
    mode: 'copilot_agent',
    target: { entityId: body.canvasId, entityType: 'canvas' },
    locale: body.locale,
    modelItemId: body.modelItemId,
    copilotSessionId: session?.sessionId,
  };

  const { resultId } = await this.skillService.sendInvokeSkillTask(user, invokeRequest);

  // 4. Wait for Copilot completion
  const timeout = body.timeout ?? 60000;
  const actionResult = await this.waitForActionCompletion(user, resultId, timeout);

  // 5. Extract result (supports both tools)
  const { planRef, toolUsed, reason } = this.extractWorkflowResult(actionResult);
  if (!planRef) {
    throwCliError('EXECUTION_FAILED', reason || 'Failed to edit workflow');
  }

  // 6. Fetch full plan from database
  const plan = await this.workflowPlanService.getWorkflowPlanDetail(user, {
    planId: planRef.planId,
    version: planRef.version,
  });

  return buildCliSuccessResponse({
    canvasId: body.canvasId,
    planId: planRef.planId,
    version: planRef.version,
    toolUsed,
    plan,
  });
}
```

**Key Helper Method** - Extract result from either tool:
```typescript
private extractWorkflowResult(actionResult: ActionDetail): {
  planRef: { planId: string; version: number } | null;
  toolUsed: 'generate_workflow' | 'patch_workflow' | null;
  reason?: string;
} {
  const toolCalls = actionResult.steps?.flatMap(s => s.toolCalls ?? []) ?? [];

  // Check for patch_workflow first (more likely in edit scenario)
  let toolCall = toolCalls.find(c => c.toolName === 'patch_workflow');
  let toolUsed: 'patch_workflow' | 'generate_workflow' | null = 'patch_workflow';

  // Fallback to generate_workflow
  if (!toolCall) {
    toolCall = toolCalls.find(c => c.toolName === 'generate_workflow');
    toolUsed = toolCall ? 'generate_workflow' : null;
  }

  if (!toolCall) {
    const availableTools = toolCalls.map(c => c.toolName).join(', ');
    return {
      planRef: null,
      toolUsed: null,
      reason: `Copilot did not call workflow tools. Called: ${availableTools || 'none'}`
    };
  }

  if (!toolCall.output) {
    return { planRef: null, toolUsed: null, reason: 'Tool call has no output' };
  }

  const output = typeof toolCall.output === 'string'
    ? JSON.parse(toolCall.output)
    : toolCall.output;

  const data = output?.data;
  if (!data?.planId) {
    return { planRef: null, toolUsed: null, reason: 'Missing planId in tool output' };
  }

  return {
    planRef: { planId: data.planId, version: data.version ?? 0 },
    toolUsed,
  };
}
```

### 2. CLI Command

**File**: `packages/cli/src/commands/workflow/edit.ts`

```typescript
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface EditWorkflowResponse {
  canvasId: string;
  planId: string;
  version: number;
  toolUsed: 'generate_workflow' | 'patch_workflow';
  plan: {
    title: string;
    tasks: Array<{ id: string; title: string }>;
    variables: Array<{ variableId: string; name: string }>;
  };
}

export const workflowEditCommand = new Command('edit')
  .description('Edit a workflow using natural language')
  .argument('<id>', 'Canvas ID (c-xxx)')
  .option('--query <text>', 'Edit instruction in natural language')
  .option('--timeout <ms>', 'Timeout for AI processing in milliseconds', '60000')
  .action(async (id: string, options) => {
    try {
      // Validate inputs
      if (!options.query) {
        fail(ErrorCodes.INVALID_INPUT, '--query is required', {
          hint: 'Example: refly workflow edit c-xxx --query "添加一个生成图片的任务"',
        });
      }

      if (!id.startsWith('c-')) {
        fail(ErrorCodes.INVALID_INPUT, 'Only Canvas ID (c-xxx) is supported', {
          hint: 'Use canvas ID from workflow URL',
        });
      }

      // Call API
      const response = await apiRequest<EditWorkflowResponse>('/v1/cli/workflow/edit', {
        method: 'POST',
        body: {
          canvasId: id,
          query: options.query,
          timeout: parseInt(options.timeout, 10),
        },
        timeout: parseInt(options.timeout, 10) + 5000, // Add buffer for network
      });

      ok('workflow.edit', {
        canvasId: response.canvasId,
        planId: response.planId,
        version: response.version,
        toolUsed: response.toolUsed,
        plan: {
          title: response.plan.title,
          taskCount: response.plan.tasks?.length ?? 0,
          variableCount: response.plan.variables?.length ?? 0,
          tasks: response.plan.tasks?.map(t => ({ id: t.id, title: t.title })),
          variables: response.plan.variables?.map(v => ({ id: v.variableId, name: v.name })),
        },
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to edit workflow',
      );
    }
  });
```

---

## Files to Modify

| File | Action |
|------|--------|
| `apps/api/src/modules/workflow/workflow-cli.controller.ts` | Add `POST /v1/cli/workflow/edit` endpoint |
| `apps/api/src/modules/workflow/workflow-cli.dto.ts` | Add `EditWorkflowCliRequest` and `EditWorkflowCliResponse` |
| `packages/cli/src/commands/workflow/edit.ts` | Rewrite to support `--query` only |

---

## Error Handling

| Condition | Error Code | Message |
|-----------|------------|---------|
| Missing --query | INVALID_INPUT | --query is required |
| Invalid ID format | INVALID_INPUT | Only Canvas ID (c-xxx) is supported |
| Canvas not found | NOT_FOUND | Canvas {id} not found or access denied |
| Copilot timeout | TIMEOUT | Workflow edit timed out |
| No workflow tool called | EXECUTION_FAILED | Copilot did not call workflow tools |
| Missing planId in output | EXECUTION_FAILED | Missing planId in tool output |

---

## Usage Examples

```bash
# Add a new task
refly workflow edit c-xxx --query "添加一个用 nano banana 生成图片的任务"

# Add a variable
refly workflow edit c-xxx --query "新增一个名为'输出格式'的字符串变量"

# Modify existing task
refly workflow edit c-xxx --query "把第一个任务的提示词改成更详细的版本"

# Delete a task
refly workflow edit c-xxx --query "删除生成图片的任务"

# With custom timeout
refly workflow edit c-xxx --query "重新设计整个工作流" --timeout 120000
```

---

## Verification

1. **Build backend**: `cd apps/api && pnpm run build`
2. **Build CLI**: `cd packages/cli && pnpm run build`
3. **Test edit with natural language**:
   ```bash
   refly workflow edit c-xxx --query "添加一个生成图片的任务"
   ```
4. **Verify the workflow was modified** in web UI or:
   ```bash
   refly workflow get c-xxx
   ```

---

## Future Enhancements

- [ ] Re-add `--ops` and `--ops-file` for structured operations
- [ ] Add `--dry-run` to preview changes without applying
- [ ] Add `--interactive` mode for multi-turn editing
