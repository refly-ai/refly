# Skill Install Workflow Ownership Design

## Summary

Two fixes for skill installation workflow handling:
1. Skip cloning when user owns the source workflow
2. Fix workflow variables not being copied during clone

---

## Problem 1: Unnecessary Workflow Cloning

### Current Behavior
- Skill installation **always** clones the source workflow
- Even when the installing user owns the source workflow
- SKILL.md stores the cloned workflowId instead of the original

### Desired Behavior
- Check if source workflow belongs to the installing user
- If **owner**: use source workflow directly, no cloning
- If **not owner**: clone workflow as before

### Implementation

**File**: `apps/api/src/modules/skill-package/skill-installation.service.ts`

In the `initializeWorkflows` method, before calling `cloneWorkflowCanvas`:

```typescript
// Check if user owns the source workflow
const sourceCanvas = await this.prisma.canvas.findFirst({
  where: { canvasId: workflow.sourceCanvasId, deletedAt: null },
  select: { uid: true },
});

const isOwner = sourceCanvas?.uid === user.uid;

if (isOwner) {
  // Owner: use source workflow directly, no cloning
  workflowMapping[workflow.skillWorkflowId] = {
    workflowId: workflow.sourceCanvasId,
    status: 'ready',
  };
  readyCount++;
} else {
  // Not owner: clone the workflow
  const clonedId = await this.cloneWorkflowCanvas(
    user,
    workflow.sourceCanvasId,
    workflow.name,
  );
  workflowMapping[workflow.skillWorkflowId] = {
    workflowId: clonedId,
    status: 'ready',
  };
  readyCount++;
}
```

### Benefits
- SKILL.md contains original workflowId for owners
- Changes to source workflow take effect immediately
- No unnecessary storage usage from duplicate workflows

---

## Problem 2: Workflow Variables Not Copied

### Current Behavior
- `duplicateCanvas` calls `getWorkflowVariables(user, { canvasId })`
- `getWorkflowVariables` requires `uid: user.uid` in query
- When cloning another user's canvas, query returns empty (canvas not found)
- Result: cloned workflow has no variable values

### Root Cause

**File**: `apps/api/src/modules/canvas/canvas.service.ts`

```typescript
// Line 1494-1496 in getWorkflowVariables
const canvas = await this.prisma.canvas.findUnique({
  select: { workflow: true },
  where: { canvasId, uid: user.uid, deletedAt: null },  // Always checks ownership
});
```

### Solution

`duplicateCanvas` already has the canvas object (with `checkOwnership: false`). Use it directly instead of calling `getWorkflowVariables`:

```typescript
// Current code (line 328)
const workflowVariables = await this.getWorkflowVariables(user, { canvasId });

// Replace with direct parsing from canvas object
const workflow = canvas.workflow ? safeParseJSON(canvas.workflow) : undefined;
const workflowVariables: WorkflowVariable[] = workflow?.variables ?? [];
```

### Benefits
- No need to modify `getWorkflowVariables` method
- Simpler logic - reuse already fetched data
- Variables correctly copied when cloning other users' workflows

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/api/src/modules/skill-package/skill-installation.service.ts` | Add ownership check before cloning |
| `apps/api/src/modules/canvas/canvas.service.ts` | Fix variable extraction in `duplicateCanvas` |

---

## Testing

1. **Owner installs own skill**:
   - workflowMapping should contain sourceCanvasId
   - No new canvas created
   - SKILL.md has original workflowId

2. **User installs another user's skill**:
   - workflowMapping should contain cloned canvasId
   - Variables should be copied with values
   - Resource references updated correctly
