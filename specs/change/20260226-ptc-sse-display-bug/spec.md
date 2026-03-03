---
id: 20260226-ptc-sse-display-bug
name: Ptc Sse Display Bug
status: implemented
created: '2026-02-26'
---

## Overview

In PTC mode, tool calls made inside `execute_code` (via sandbox Python code calling `/v1/tool/execute`)
are not streamed to the frontend as SSE events when the agent node is run as part of a workflow.

**Repro**: Bug only occurs when the agent node is run from the **whole workflow**. Running the agent node **directly** (standalone) shows PTC tool calls correctly in the UI.

**Expected**: Each inner PTC tool call (e.g. Notion search, Linear query) appears as an indented tool card below the Execute Code card.

**Actual**: Only the Execute Code card is visible. Inner PTC tool calls are absent from the UI.

## Key Finding

When the agent node runs inside a workflow, `res` (the SSE response object passed to the skill invocation context) is **`null`** — because workflow execution is fire-and-forget and does not have a live HTTP SSE connection to a client. Standalone execution does have a live SSE connection, so `res` is valid and everything works.

This is why the bug only manifests in workflow runs: all code paths guarded by `res` are silently skipped.

### Critical symptom

No `action_messages` DB records for PTC child calls. `messageAggregator.addToolMessage()` was never reached because it was placed after an early-return `if (!res)` guard in `sendEvent()`.

## Root Cause

Two bugs worked together, both keyed on `res` being falsy in workflow runs:

### Bug 1 — Poller skipped entirely when `res` is falsy (`skill-invoker.service.ts`)

```typescript
// BEFORE (broken)
if (toolName === 'execute_code' && res) {
  ptcPollerManager.start(toolCallId);   // never runs if res is falsy
}
// ... (error path)
if (toolName === 'execute_code' && res) {
  await ptcPollerManager.stop(toolCallId);  // never runs if res is falsy
}
```

If `res` (the SSE response object) is falsy at invocation time — e.g. background execution,
or the stream was already closed — the poller never starts and no PTC events are captured at all.

### Bug 2 — `addToolMessage()` guarded behind `if (!res)` in `sendEvent()` (`ptc-poller.manager.ts`)

```typescript
// BEFORE (broken)
private sendEvent(ptcCall: ...): void {
  const { res, ... } = this.context;
  if (!res) {
    return;  // exits BEFORE addToolMessage — no DB record written
  }
  messageAggregator.addToolMessage({...});   // never reached when res is falsy
  writeSSEResponse(res, ssePayload);
}
```

Even if the poller ran, `addToolMessage()` (which writes the `action_messages` DB record) was
placed AFTER the early-return guard. No SSE connection → no DB record. This is what the DB
confirmed: no `action_messages` for PTC child calls.

## Fix (commit 7c5bbce)

### `ptc-poller.manager.ts` — persist to DB unconditionally, then gate SSE

```typescript
// AFTER (fixed)
const ptcMessageId = messageAggregator.addToolMessage({  // always runs
  toolCallId: ptcCall.callId,
  toolCallMeta: ptcToolCallMeta,
});

if (!res) {
  return;  // skip SSE, but DB record already written above
}

// SSE send continues below...
```

### `skill-invoker.service.ts` — always start/stop poller for execute_code

```typescript
// AFTER (fixed)
if (toolName === 'execute_code') {        // removed `&& res` guard
  ptcPollerManager.start(toolCallId);
}
// ... (error path)
if (toolName === 'execute_code') {        // removed `&& res` guard
  await ptcPollerManager.stop(toolCallId);
}
```

**Result**: PTC polling and DB persistence now runs regardless of SSE availability.
SSE events are still only sent when `res` is valid.

## Notes

### Code Locations

| File | Line | Relevance |
|------|------|-----------|
| `apps/api/src/modules/skill/ptc-poller.manager.ts` | 59, 91 | `start()` / `stop()` core logic |
| `apps/api/src/modules/skill/ptc-poller.manager.ts` | 139 | `sendEvent()` — `!res` guard before `addToolMessage` |
| `apps/api/src/modules/skill/skill-invoker.service.ts` | 1038 | `toolCallId = event.run_id ?? randomUUID()` |
| `apps/api/src/modules/skill/skill-invoker.service.ts` | 1127–1130 | poller `start()` call site |
| `apps/api/src/modules/skill/skill-invoker.service.ts` | 1305–1308 | poller `stop()` call site |
| `apps/api/src/modules/tool-call/tool-call.service.ts` | 197 | `fetchPtcToolCalls` DB query |
