---
id: 20260224-ptc-enabled-action-results
name: PTC Enabled Status for Action Results
status: implemented
created: '2026-02-24'
---

## Overview

### Problem Statement
- The `action_results` table records each node agent run, and PTC (Programmatic Tool Calling) mode can be either enabled or disabled per run
- There is currently no field in the database to indicate whether PTC was enabled for a given run, making it impossible to audit, debug, or analyze PTC usage at the record level

### Goals
- Add a `ptc_enabled` boolean field to the `action_results` table to persist PTC mode status for each run
- Ensure the field is populated when action results are created or updated

### Scope
**In scope:**
- Database migration to add `ptc_enabled` column to `action_results`
- Backend logic to write `ptc_enabled` value when saving action results

**Out of scope:**
- UI changes to display PTC status
- Analytics or reporting on PTC usage

## Research

### Existing System

**ActionResult schema** (`apps/api/prisma/schema.prisma:128–203`)
- The `ActionResult` model maps to `action_results` table. No `ptc_enabled` field exists today.
- Related fields: `toolsets` (JSON), `runtimeConfig` (JSON), `workflowNodeExecutionId` — none encode PTC status.

**Where `ptcEnabled` is determined per run** (`apps/api/src/modules/skill/skill-invoker.service.ts:423–438`)
- Inside `buildInvokeConfig()`, `isPtcEnabledForToolsets(user, toolsetKeys, ptcConfig)` computes the boolean.
- Result stored in `config.configurable.ptcEnabled` and passed through `SkillRunnableConfig`.
- A debug override: if `ptcConfig.debug` is set, PTC is enabled only if node title contains `"ptc"`.

**Where ActionResult is created** (`apps/api/src/modules/skill/skill.service.ts:697–758`, `skillInvokePreCheck()`)
- Called just before `buildInvokeConfig()` — at this point `ptcEnabled` is NOT yet computed.
- Requires `ptcEnabled` to be passed down from the invoke entry point into `skillInvokePreCheck`.

**Where ActionResult is updated on completion** (`apps/api/src/modules/skill/skill-invoker.service.ts:1702–1711`)
- `actionResult.updateMany({ where: { resultId, version }, data: { status, errorType, errors } })`
- This update already has access to `config.configurable.ptcEnabled` in scope.

**Full invoke call chain:**
```
skill.service.ts invokeSkill()
  └─> skillInvokePreCheck()   ← CREATE (ptcEnabled not yet known here)
  └─> skill-invoker.service.ts invokeSkill()
        └─> buildInvokeConfig()   ← ptcEnabled determined HERE
        └─> streamEvents() / agent run
        └─> finally: actionResult.updateMany()   ← UPDATE (ptcEnabled available)
```

### Key References
- `apps/api/prisma/schema.prisma:128` — ActionResult model
- `apps/api/src/modules/skill/skill-invoker.service.ts:423` — `buildInvokeConfig()`, PTC decision
- `apps/api/src/modules/skill/skill-invoker.service.ts:1702` — final status UPDATE
- `apps/api/src/modules/skill/skill.service.ts:697` — `skillInvokePreCheck()`, initial CREATE
- `apps/api/src/modules/tool/ptc/ptc-config.ts` — `isPtcEnabledForToolsets()`
- `packages/skill-template/src/base.ts:338` — `SkillRunnableConfig` type (`ptcEnabled?: boolean`)

## Design

### Key Insight

`ptcEnabled` is computed in `buildInvokeConfig()` (invoker service), but `ActionResult` is created in `skillInvokePreCheck()` (skill service) which runs *before* `buildInvokeConfig()`. Therefore, `ptcEnabled` cannot be written at CREATE time without refactoring the call order.

The minimal solution: write `ptcEnabled` in the **final UPDATE** that already runs at the end of every skill invocation. `config.configurable.ptcEnabled` is already in scope there. The DB column defaults to `false`, so early-failure records (where the final update never runs) will correctly show `false`.

### Implementation Steps

1. **Prisma schema** — add field to `ActionResult` model:
   ```
   ptcEnabled  Boolean  @default(false)  @map("ptc_enabled")
   ```

2. **DB migration** — run `prisma migrate dev` to generate and apply:
   ```sql
   ALTER TABLE action_results ADD COLUMN ptc_enabled BOOLEAN NOT NULL DEFAULT false;
   ```

3. **Final UPDATE write path** (`skill-invoker.service.ts:1702`) — add `ptcEnabled` to the existing `updateMany` data:
   ```
   data: {
     status,
     errorType: ...,
     errors: ...,
     ptcEnabled: config.configurable.ptcEnabled ?? false,   // ← add this
   }
   ```

### Files to Modify

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `ptcEnabled` field to `ActionResult` |
| `apps/api/src/modules/skill/skill-invoker.service.ts` | Add `ptcEnabled` to final `updateMany` at line ~1702 |

### Edge Cases

- **Pre-check failures** (`createFailedActionResult`): no invoke config built → column stays `false` (correct, PTC was never active)
- **Media generation** (`media-generator.service.ts`): unrelated to PTC → column stays `false` (correct)
- **Duplication** (`duplicateActionResults`): copies source record → column stays `false` by default (acceptable, source PTC status is historical)

## Plan

- [x] Phase 1: Schema & migration
  - [x] Add `ptcEnabled` field to `ActionResult` in `schema.prisma`
  - [ ] Run `prisma migrate dev` to generate and apply migration
- [x] Phase 2: Backend write
  - [x] Add `ptcEnabled: config.configurable.ptcEnabled ?? false` to `actionResult.updateMany` in `skill-invoker.service.ts`
- [ ] Phase 3: Verify
  - [ ] Confirm migration applies cleanly
  - [ ] Confirm field is written correctly for a PTC-enabled run and a non-PTC run

## Notes

### Deployment Order

Because the code writes `ptc_enabled` in an `UPDATE` (not `INSERT`), the column must exist before the new code runs. However, existing records are unaffected — the column defaults to `false`.

**Correct order:**

1. **Run DB migration first** (`migration.sql`) — adds the column with `DEFAULT false`, no downtime
2. **Deploy new code** — starts writing `ptc_enabled` in the final UPDATE

**Rollback safety:**
- If the new code is rolled back after migration, the column simply stays in the DB with all rows as `false` — no harm.
- If migration is rolled back after code deploy: the code will fail to write `ptc_enabled` since the column no longer exists. Roll back code before rolling back the migration.

**Why migration-first is safe:**
- Adding a `NOT NULL DEFAULT false` column is non-blocking on PostgreSQL (no table rewrite needed for constant defaults in Postgres 11+).
- Old code (without `ptcEnabled` in the UPDATE) works fine with the new column present — it simply doesn't write to it, leaving it as `false`.
