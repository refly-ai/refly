---
id: 20260302-ptc-video-generation-context-fix
name: Ptc Video Generation Context Fix
status: implemented
created: '2026-03-02'
linear_issue_id: REF-1472
---

## Overview

- In PTC mode, `fal_video.fal-image-to-video` fails when inputting `image_url=df-xxx` (Drive fileId), with the error `Cannot read properties of undefined (reading 'langchainConfig')`.

## Research

### Existing System

- Dynamic-tooling runs `prepareToolRequest` inside `runInContext`, so `getCurrentUser()` resolves from `langchainConfig.configurable.user` during resource preprocessing.
- PTC config-based execution currently runs `prepareToolRequest` before `runInContext`, so resource preprocessing can call `getCurrentUser()` with no active async context.
- `ResourceHandler.resolveInputResources` resolves `df-xxx` via `resolveFileIdToFormat`, which requires `getCurrentUser()` and throws if user context is absent.
- `getCurrentUser()` is not null-safe today (`context.langchainConfig`), so missing context throws `Cannot read properties of undefined (reading 'langchainConfig')` before explicit validation runs.

### Available Approaches

1. **Align PTC ordering with dynamic-tooling**
   - Move PTC `prepareToolRequest` into the `runInContext` callback so input resource resolution executes with full request context.
2. **Harden context accessor only**
   - Make `getCurrentUser()` null-safe and rely on downstream checks to emit a controlled error (`User context is required for file resolution`).
3. **Do both**
   - Apply ordering alignment and null-safety guard to remove the root mismatch and avoid hard crashes in other call sites.

### Constraints

- Keep behavior consistent between PTC and non-PTC tool execution paths.
- Do not change tool request/response contracts for `/v1/tool/execute`.
- Preserve existing resource resolution behavior for valid `df-*` inputs.
- Existing automated coverage around PTC execute path is limited; add targeted tests near changed logic.

### Key References

- `apps/api/src/modules/tool/ptc/tool-execution.service.ts:493`
- `apps/api/src/modules/tool/ptc/tool-execution.service.ts:517`
- `apps/api/src/modules/tool/dynamic-tooling/factory.service.ts:224`
- `apps/api/src/modules/tool/dynamic-tooling/factory.service.ts:233`
- `apps/api/src/modules/tool/resource.service.ts:80`
- `apps/api/src/modules/tool/resource.service.ts:1007`
- `apps/api/src/modules/tool/tool-context.ts:72`

## Design

### Architecture Overview

```
PTC /tool/execute
  -> executeConfigBasedTool
    -> build runnableConfig
    -> runInContext(...)
       -> prepareToolRequest(...)
          -> resolveInputResources(...)
             -> resolveFileIdToFormat(...)
                -> getCurrentUser()
       -> handlerService.execute(...)
```

- Keep resource preprocessing and HTTP execution inside the same async context for PTC, matching dynamic-tooling behavior.
- Make `getCurrentUser()` fail fast with a clear error when async request context is missing.

### Implementation Steps

1. Make `getCurrentUser()` fail fast when context is missing (clear error, no null-deref crash).
2. Refactor PTC config-based execution so `prepareToolRequest` runs inside `runInContext`.
3. Keep billing/toolCall metadata behavior unchanged after refactor.
4. Add/extend tests to cover PTC resource input with `df-*` and missing-context behavior.

### Pseudocode

```text
executeConfigBasedTool(...):
  load config + method + adapter
  build runnableConfig
  return runInContext(context, async () => {
    request = prepareToolRequest(config, method, args, user)
    if toolCallId exists: attach to request.metadata
    response = handlerService.execute(request, adapter, options)
    return convertHandlerResponse(response)
  })

getCurrentUser():
  context = asyncLocalStorage.getStore()
  if context is missing: throw explicit context error
  if context.user exists: return context.user
  return context.langchainConfig?.configurable?.user
```

### Files to Modify

- `apps/api/src/modules/tool/tool-context.ts`
- `apps/api/src/modules/tool/ptc/tool-execution.service.ts`
- `apps/api/src/modules/tool/ptc/` test file(s) for execution context regression coverage

### Edge Cases and Error Handling

- `df-*` input in PTC mode resolves with context and no TypeError.
- Missing user context returns controlled resource-resolution error (not null-deref crash).
- Non-resource inputs follow existing behavior unchanged.
- `toolCallId` metadata remains available for billing tracking.

## Plan

- [x] Phase 1: Harden context accessor
  - [x] Make `getCurrentUser()` fail fast on missing context
  - [x] Preserve direct-context fallback (`context.user`) and existing LangChain lookup
- [x] Phase 2: Align PTC execution ordering
  - [x] Move `prepareToolRequest` into `runInContext` callback
  - [x] Preserve request metadata (`toolCallId`, schemas, billing-related fields)
- [x] Phase 3: Test and verify
  - [x] Add regression tests for context behavior and PTC resource-resolution ordering
  - [x] Run targeted backend tests for modified modules

## Implementation

### Files Modified

- `apps/api/src/modules/tool/tool-context.ts`
  - `getCurrentUser()` now throws a clear error when request context is missing and supports `context.user` fallback before LangChain-config lookup.
- `apps/api/src/modules/tool/ptc/tool-execution.service.ts`
  - Refactored config-based PTC execution to build/resolve request inside `runInContext`, ensuring resource preprocessing has active user context.
  - Kept `toolCallId` metadata attachment and existing handler execution flow.
- `apps/api/src/modules/tool/tool-context.spec.ts`
  - Added tests for fail-fast behavior, direct context user, and LangChain-config user resolution.
- `apps/api/src/modules/tool/ptc/tool-execution.service.spec.ts`
  - Added regression test proving input resource resolution executes with active context in PTC path.

### Testing Results

- Ran: `pnpm test -- src/modules/tool/tool-context.spec.ts src/modules/tool/ptc/tool-execution.service.spec.ts`
- Result: Passed (2 suites, 4 tests).
- Manual local validation (workflow UI, image-to-image as low-cost proxy for video path):
  - Both non-PTC and PTC image-to-image nodes finished successfully in the same run.
  - No node/tool-call errors were observed, and both branches produced image outputs.
  - This confirms the context-ordering fix works in real execution flow for resource-based media tools.

### Deviations from Design

- Changed from "null-safe return" to explicit fail-fast behavior for missing context in `getCurrentUser()`, per implementation approval feedback.

## Notes

<!-- Optional: Alternatives considered, open questions, etc. -->
