---
id: 20260309-ptc-rollout-percentage-priority
name: PTC Rollout Percentage Priority
status: implemented
created: '2026-03-09'
---

## Overview

### Goals
- Add a rollout environment variable to control the percentage of users for whom PTC is enabled.
- Ensure rollout behavior works together with existing `PTC_TOOLSET_ALLOWLIST` and `PTC_TOOLSET_BLOCKLIST` controls.

### Scope
- Define and implement clear priority rules across PTC-related environment variables.
- Keep allowlist/blocklist constraints effective while introducing percentage-based rollout.

### Constraints
- Environment-variable priority must be explicit and predictable to avoid conflicting behavior during gradual rollout.

## Research

### Current Environment Variable Behavior
- `PTC_MODE` supports `off|on|partial` and defaults to `off`; `partial` requires user ID in `PTC_USER_ALLOWLIST`.
- Toolset gating is all-or-nothing for a run: all selected toolsets must pass checks; any blocked/not-allowed toolset disables PTC for that run.
- Toolset precedence is already clear: `PTC_TOOLSET_BLOCKLIST` overrides `PTC_TOOLSET_ALLOWLIST`.
- `PTC_DEBUG` is a secondary title-based filter applied only after base permission is true (`opt-in`: requires `useptc`; `opt-out`: excludes `nonptc`).
- `PTC_SEQUENTIAL` only controls prompt guidance for execution order; it does not change permission decision.

### Gap Identified
- There is no percentage-based rollout control today; existing controls are binary or list-based.
- Without an explicit rollout layer and priority, gradual rollout can conflict with existing mode/allowlist/blocklist expectations.

### Options Evaluated
1. **User-level stable rollout (recommended)**
   - Apply rollout decision per user via deterministic bucket.
   - Pros: stable user experience, reproducible incidents, cleaner metrics during ramp-up.
2. **Request-level random rollout**
   - Evaluate percentage on every request.
   - Cons: user experience flips between requests; hard to debug and compare results.

## Design

### New Env Variables
- `PTC_ROLLOUT_PERCENT` (0-100, default `100`): controls what percentage of otherwise-eligible users can use PTC.
- `PTC_ROLLOUT_SALT` (optional, default constant): stabilizes hashing and allows controlled rebucketing when needed.

### Priority Rules (High to Low)
1. `PTC_MODE=off` hard disables PTC.
2. `PTC_MODE=partial` + `PTC_USER_ALLOWLIST` user check.
3. Toolset checks: `PTC_TOOLSET_BLOCKLIST` first, then `PTC_TOOLSET_ALLOWLIST` (if configured).
4. Rollout gate: `PTC_ROLLOUT_PERCENT` user-level deterministic bucket.
5. `PTC_DEBUG` title filter as final refinement (`opt-in` / `opt-out`).

### Decision Logic
- Base eligibility must pass mode/user/toolset checks first.
- Rollout is evaluated only for eligible users; it cannot bypass blocklist/allowlist constraints.
- Deterministic bucketing uses `hash(uid + salt) % 100 < percent`.
- `PTC_SEQUENTIAL` remains orthogonal and only affects prompt behavior.

### Compatibility and Safety
- Default behavior remains unchanged with `PTC_ROLLOUT_PERCENT=100`.
- Setting `PTC_ROLLOUT_PERCENT=0` provides a non-invasive kill switch without changing mode/toolset configs.
- Existing debug behavior and toolset precedence are preserved.

## Plan

- [x] Phase 1: Config
  - [x] Add `rolloutPercent` and `rolloutSalt` to `app.config.ts` ptc block
  - [x] Add fields to `PtcConfig` interface
  - [x] Parse new env vars in `getPtcConfig()`
- [x] Phase 2: Rollout gate logic
  - [x] Add `computeRolloutBucket(uid, salt)` using SHA-256 deterministic hash
  - [x] Add `isPtcEnabledForRollout(uid, config)` exported function
  - [x] Insert rollout gate into `isPtcEnabledForToolsets()` after toolset check
- [x] Phase 3: Tests
  - [x] `getPtcConfig` parses `rolloutPercent` and `rolloutSalt` correctly
  - [x] `isPtcEnabledForRollout` returns true at 100%, false at 0%
  - [x] Rollout gate is applied inside `isPtcEnabledForToolsets`

## Notes

### Implementation

- `apps/api/src/modules/config/app.config.ts` — added `rolloutPercent` (number) and `rolloutSalt` (string) to ptc config block
- `apps/api/src/modules/tool/ptc/ptc-config.ts` — added `rolloutPercent`/`rolloutSalt` to `PtcConfig` interface; added `computeRolloutBucket` (internal) and `isPtcEnabledForRollout` (exported); refactored `isPtcEnabledForToolsets` to call rollout gate as step 3 after toolset checks
- `apps/api/src/modules/tool/ptc/ptc-config.spec.ts` — updated all `PtcConfig` literals with new fields; added 9 new test cases covering rollout behavior

### Verification

- All 24 unit tests pass (`pnpm jest ptc-config.spec.ts`)
- Default behavior is unchanged: `PTC_ROLLOUT_PERCENT=100` (or unset) keeps all eligible users enabled
- `PTC_ROLLOUT_PERCENT=0` acts as a kill switch without touching mode/toolset config
- Determinism verified: same uid+salt always produces the same bucket; different salts produce different assignments across a sample of 20 users
- Live rollout test: bucket = **2** → excluded at `PTC_ROLLOUT_PERCENT=2`, included at `PTC_ROLLOUT_PERCENT=3` ✅
