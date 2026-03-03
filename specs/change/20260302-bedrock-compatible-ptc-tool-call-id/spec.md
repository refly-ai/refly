---
id: 20260302-bedrock-compatible-ptc-tool-call-id
name: Bedrock Compatible Ptc Tool Call Id
status: implemented
created: '2026-03-02'
linear_issue_id: REF-1474
---

## Overview

### Problem Statement
- Workflow node execution can fail with Bedrock `ValidationException` because `messages.*.toolUse.toolUseId` and `messages.*.toolResult.toolUseId` must match `[a-zA-Z0-9_-]+`.
- Current PTC tool call IDs use `ptc:${uuid}` (contains `:`), which propagates through persisted message metadata and is reused as Bedrock/LangChain `toolUseId` in downstream history reconstruction.

### Goals
- Ensure workflow execution with Bedrock does not fail due to invalid `toolUseId` format.
- Keep cross-node tool call linking intact when upstream `resultHistory` is rebuilt for downstream invocation.

### Scope
- Address the end-to-end path where PTC-generated tool call IDs are created, stored (`action_messages.tool_call_id`, `tool_call_meta.toolCallId`), and later reused as Bedrock `toolUseId`.

### Constraints
- `toolUseId` must satisfy Bedrock Converse validation regex: `[a-zA-Z0-9_-]+`.
- The issue spans ID generation, message aggregation/polling persistence, and downstream history reconstruction/invocation.

### Success Criteria
- Downstream nodes that consume upstream `resultHistory` can execute without Bedrock `toolUseId` validation errors.

## Research

### Existing System
- PTC child tool calls generate IDs with `generateCallId(callType)` and currently use `\`${callType}:${randomUUID()}\``.
- Generated `callId` is persisted in `tool_call_results.call_id` and forwarded into action messages as both `action_messages.tool_call_id` and `tool_call_meta.toolCallId`.
- History replay for downstream nodes rebuilds LangChain messages from stored action messages and reuses `toolCallMeta.toolCallId` (fallback `msg.toolCallId`) as `AIMessage.tool_calls[].id` and `ToolMessage.tool_call_id`.
- Bedrock Converse validates `toolUseId/toolResult.toolUseId` on provider side and rejects IDs containing `:`.

### Available Approaches
- Change PTC ID generation format to Bedrock-safe characters only (for example `ptc_<uuid>` / `standalone_<uuid>`).
- Keep persisted IDs unchanged and sanitize only when reconstructing LangChain tool IDs for Bedrock-facing history.
- Apply both: update generator for new data and add reconstruction-time normalization as backward-compatible protection for existing stored data (not selected for this change).

### Constraints
- `toolUseId` and paired `toolResult.toolUseId` must match `[a-zA-Z0-9_-]+`.
- Tool-use and tool-result IDs must stay exactly matched within reconstructed message pairs.
- Existing historical rows may already contain invalid IDs and still need to be replay-safe.

### Key References
- `apps/api/src/modules/tool/ptc/tool-execution.service.ts:234`
- `apps/api/src/modules/skill/ptc-poller.manager.ts:151`
- `apps/api/src/utils/message-aggregator.ts:258`
- `apps/api/src/modules/skill/skill.service.ts:1003`
- `apps/api/src/modules/skill/skill-invoker.service.ts:217`
- `apps/api/src/modules/skill/skill-invoker.service.ts:240`
- `apps/api/src/modules/skill/skill-invoker.service.ts:252`

## Design

### Architecture
- Apply source-format correction for new PTC IDs only; legacy replay normalization is out of scope for this change.

```text
PTC execute -> generate callId -> persist callId in tool_call_results/action_messages
                                  |
                                  v
downstream history replay -> reconstruct AI tool_use + ToolMessage tool_result
                                  |
                                  v
                   No replay-time normalization in this implementation
```

### Implementation Steps
1. Update PTC `generateCallId` format from `type:uuid` to `type_uuid` to satisfy Bedrock regex for newly generated IDs.
2. Keep replay behavior unchanged (per approval: no legacy ID normalization).
3. Add focused tests for generator format compatibility.

### Pseudocode
```text
generateCallId(callType):
  return callType + '_' + uuid()
```

### Files to Modify
- `apps/api/src/modules/tool/ptc/tool-execution.service.ts`
- `apps/api/src/modules/tool/ptc/tool-call-id.ts`
- `apps/api/src/modules/tool/ptc/tool-execution.service.spec.ts`

### Edge Cases
- Existing historical IDs containing `:` remain unchanged in this change set.
- Already valid IDs remain unchanged.
- Empty/missing tool call ID behavior remains unchanged (fallback path to plain AI message).

## Plan

<!-- Break down implementation and verification into steps -->

- [x] Phase 1: Update ID generation format
  - [x] Replace PTC execution call ID separator from `:` to `_`
  - [x] Route service call ID generation through a dedicated helper
- [x] Phase 2: Add coverage
  - [x] Add unit tests to verify generated IDs contain only `[a-zA-Z0-9_-]`
  - [x] Add prefix checks for both `ptc_` and `standalone_`
- [x] Phase 3: Verify and review
  - [x] Run focused test suite for the new unit tests
  - [x] Run final code review pass and address any critical issues

## Implementation

- Files modified:
  - `apps/api/src/modules/tool/ptc/tool-execution.service.ts` - switch generated call ID format to Bedrock-safe delimiter and use shared helper.
  - `apps/api/src/modules/tool/ptc/tool-call-id.ts` - add reusable call ID generator.
  - `apps/api/src/modules/tool/ptc/tool-execution.service.spec.ts` - add unit tests for generated ID format.
  - `apps/api/src/modules/action/action.dto.ts` - keep `isPtc` detection compatible with both `ptc:` and `ptc_` prefixes.
  - `apps/api/src/modules/action/action.dto.spec.ts` - add regression tests for both PTC ID formats.
- Testing:
  - `pnpm test -- tool-execution.service.spec.ts action.dto.spec.ts` (pass)
- Design deviations:
  - Legacy historical IDs are **not** normalized at replay time, based on implementation checkpoint decision.

## Notes

<!-- Optional: Alternatives considered, open questions, etc. -->
