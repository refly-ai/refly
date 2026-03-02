---
id: 20260302-ptc-concurrent-execution
name: Ptc Concurrent Execution
status: implemented
created: '2026-03-02'
---

## Overview

**Problem Statement**: PTC mode executes Python code in a sandbox that calls `refly_tools` sequentially. With multiple tool calls, the 60s sandbox timeout is easily hit, causing user-facing errors.

**Goals**:
- Enable parallel execution of independent tool calls in PTC-generated Python code
- Reduce overall execution time for multi-tool workflows
- Add a safe runtime switch to force sequential execution when needed

**Scope**:
- In scope: Modifying the PTC prompt template to instruct the LLM to use `ThreadPoolExecutor` for parallel calls
- In scope: Wiring a `PTC_SEQUENTIAL` config flag from API config to prompt rendering
- Out of scope: Sandbox timeout changes, coroutine-based concurrency

**Constraints**:
- `refly_tools` SDK calls are synchronous/blocking — must use threads, not async
- Side-effect operations (write/send/create/update/delete) must remain serial
- Parallel calls must have a concurrency limit to avoid overwhelming the backend
- Must not break existing single-call or serial-dependent workflows

**Success Criteria**:
- Independent read/query tool calls execute in parallel
- Dependent calls still execute serially
- Side-effect calls still execute serially
- Overall execution time visibly reduced for multi-tool workflows

## Research

**Existing System**:
- `packages/skill-template/src/prompts/templates/partials/ptc-mode.md` — the sole PTC prompt template. Line 51 explicitly says "Assume all tools are ready for immediate and **sequential** execution." This is the root cause of the sequential behavior.
- `apps/api/src/modules/sandbox/sandbox.constants.ts:17` — `DEFAULT: 60000` (60s timeout). No easy way to extend without backend changes.
- The LLM generates Python code calling `refly_tools` SDK methods (synchronous class methods). These blocking calls must use threads, not async.
- Backend supports concurrent calls fine — each has independent `callId`, storage, billing.

**Available Approaches**:
1. **Prompt + config switch (chosen)**: Add a "Concurrent Execution" section to `ptc-mode.md`, plus a `PTC_SEQUENTIAL` switch that can force serial behavior. Low risk and reversible.
2. Prompt-only with no switch: Fastest but no rollback lever if toolsets behave better serially.
3. Sandbox timeout increase: Backend change, doesn't reduce time, just delays failure.
4. Async SDK refactor: Large scope, not prompt-layer.

**Constraints**:
- SDK methods are synchronous — threads required, not `asyncio`
- Side-effect tools must stay serial to avoid race conditions and duplicate writes
- Concurrency limit needed (recommend `max_workers=5`)

**Key References**:
- `packages/skill-template/src/prompts/templates/partials/ptc-mode.md:51` — "sequential execution" instruction to change

## Design

**Approach**: Add a "Execution Order" section to `ptc-mode.md` with conditional rendering:
- `ptcSequential=false` (default): show parallel/serial decision rules and `ThreadPoolExecutor` template
- `ptcSequential=true`: force strict sequential execution instructions

`ptcSequential` is sourced from `PTC_SEQUENTIAL` in API config and passed through skill invoker and prompt builder.

**Decision Rules** (to be embedded in prompt):

```
Serial (sequential) if ANY of:
  - Call B depends on output of Call A
  - Operation has side effects: write/create/update/delete/send/post

Parallel if ALL of:
  - Calls are independent (no data dependency)
  - All are read/query/list/get operations
```

**ThreadPoolExecutor Template** (pseudocode for prompt):
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def run_parallel(fns, max_workers=5):
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fn): name for name, fn in fns.items()}
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    return results
```

**Files to Modify**:
- `apps/api/src/modules/config/app.config.ts`
  - Add `ptc.sequential` from `PTC_SEQUENTIAL`
- `apps/api/src/modules/tool/ptc/ptc-config.ts`
  - Extend `PtcConfig` with `sequential: boolean`
- `apps/api/src/modules/skill/skill-invoker.service.ts`
  - Pass `ptcSequential` into skill runnable configurable config
- `packages/skill-template/src/base.ts`
  - Extend `SkillRunnableConfig.configurable` with `ptcSequential`
- `packages/skill-template/src/prompts/node-agent.ts`
  - Accept and pass `ptcSequential` into template rendering
- `packages/skill-template/src/skills/agent.ts`
  - Forward `ptcSequential` into node-agent prompt builder
- `packages/skill-template/src/prompts/templates/partials/ptc-mode.md`
  - Add conditional execution order guidance (sequential mode vs guarded parallel mode)

**Section Structure**:
```
### Execution Order

When `ptcSequential=true`:
- Always serial

When `ptcSequential=false`:
- Serial: dependent calls, side-effect operations
- Parallel: independent read/query/list/get calls, max_workers=5

Code template: ThreadPoolExecutor pattern
```

## Plan

- [x] Phase 1: Add config plumbing
  - [x] Add `PTC_SEQUENTIAL` parsing in app/PTC config
  - [x] Pass `ptcSequential` through skill invoker and runnable config
- [x] Phase 2: Update PTC prompt
  - [x] Add conditional execution order instructions and ThreadPoolExecutor template
- [x] Phase 2: Verify
  - [x] Read final prompt file and confirm wording is clear and correct

## Implementation

**Files modified**:
- `apps/api/src/modules/config/app.config.ts`
  - Added `ptc.sequential` sourced from `PTC_SEQUENTIAL`
- `apps/api/src/modules/tool/ptc/ptc-config.ts`
  - Added `sequential` field to `PtcConfig` and `getPtcConfig()`
- `apps/api/src/modules/skill/skill-invoker.service.ts`
  - Added `config.configurable.ptcSequential = ptcConfig.sequential`
- `packages/skill-template/src/base.ts`
  - Added optional `ptcSequential` in runnable configurable config
- `packages/skill-template/src/prompts/node-agent.ts`
  - Added `ptcSequential` option and template render param
- `packages/skill-template/src/skills/agent.ts`
  - Forwarded `ptcSequential` to node-agent system prompt builder
- `packages/skill-template/src/prompts/templates/partials/ptc-mode.md`
  - Added `### Execution Order` conditional block for strict sequential mode vs guarded parallel mode
  - Included `ThreadPoolExecutor` template for independent read-only calls

**Testing**: Added config assertions in `apps/api/src/modules/tool/ptc/ptc-config.spec.ts`; prompt behavior verified by reading final template content.

## Notes

<!-- Optional: Alternatives considered, open questions, etc. -->
