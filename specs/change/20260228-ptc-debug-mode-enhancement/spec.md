---
id: "20260228-ptc-debug-mode-enhancement"
name: "Ptc Debug Mode Enhancement"
status: implemented
created: "2026-02-28"
---

## Overview

### Problem Statement
- `PTC_DEBUG` currently only supports `true/false`. When `true`, it enables PTC only for nodes whose title contains "ptc", **overriding** all other config.
- Too rigid: no way to enable PTC for all nodes except a few, without changing `PTC_MODE`.
- Priority bug: the current override skips the `PTC_MODE`/`PTC_USER_ALLOWLIST` check — so `PTC_DEBUG=true` with `PTC_MODE=off` can still activate PTC unintentionally.

### Goals
- Extend `PTC_DEBUG` to two named modes for title-based filtering (opt-in and opt-out).
- Fix priority: debug filter only applies **after** `isPtcEnabledForToolsets` already returns `true`.
- When `PTC_DEBUG` is unset/empty, behavior is unchanged.

### Scope
**In scope:**
- New `PTC_DEBUG` values `opt-in` / `opt-out` for title-based filtering
- Priority fix: debug title filter runs only when base check already permits PTC
- `REFLY_PTC_DEBUG=true` injected into sandbox for both modes
- Legacy `PTC_DEBUG=true` preserved as alias for `opt-in`

**Out of scope:**
- Changes to `PTC_MODE`, `PTC_USER_ALLOWLIST`, or toolset allow/blocklist logic

## Design

### PTC_DEBUG values

| Value | Behaviour |
|-------|-----------|
| unset / empty | Debug filtering off; PTC_MODE + allowlist decide |
| `opt-in` | PTC on only for nodes whose title contains "useptc" |
| `opt-out` | PTC on for all nodes except those whose title contains "nonptc" |
| `true` (legacy) | Treated as `opt-in` |

### Priority

```
PTC_MODE=off or user not in PTC_USER_ALLOWLIST
  → ptcEnabled = false  (debug filter never runs)

PTC_MODE=on/partial and user allowed
  → ptcEnabled = true
  → if PTC_DEBUG=opt-in:  ptcEnabled = title.includes("useptc")
  → if PTC_DEBUG=opt-out: ptcEnabled = !title.includes("nonptc")
  → else: ptcEnabled stays true
```

### Files changed

- `ptc-config.ts` — new `PtcDebugMode` enum; `PtcConfig.debug → debugMode`; `parsePtcDebugMode()`
- `skill-invoker.service.ts` — fixed priority; handles `opt-in` / `opt-out`
- `ptc-env.service.ts` — `REFLY_PTC_DEBUG=true` when any non-empty debug mode is set
- `ptc-config.spec.ts` — updated tests for new enum values

## Plan

- [x] Add `PtcDebugMode` enum (`opt-in`, `opt-out`) to `ptc-config.ts`
- [x] Replace `PtcConfig.debug: boolean` with `debugMode: PtcDebugMode | null`; move to end of interface
- [x] Add `parsePtcDebugMode()` with legacy `true` → `opt-in` fallback
- [x] Fix priority in `skill-invoker.service.ts`: apply debug filter only when base check passes
- [x] Update `ptc-env.service.ts`: inject `REFLY_PTC_DEBUG=true` for any non-empty debug mode
- [x] Update `ptc-config.spec.ts`: replace boolean test with cases for `opt-in`, `opt-out`, legacy `true`, invalid

## Notes

- `PTC_DEBUG=true` is kept as a legacy alias for `opt-in` to avoid breaking existing dev setups.
- Title matching is case-insensitive (`toLowerCase()`). Keywords are "useptc" (opt-in) and "nonptc" (opt-out) — chosen to be disjoint substrings with no overlap.
- `REFLY_PTC_DEBUG` in the sandbox reflects whether *any* debug mode is active, not which mode — the sandbox only needs to know it's a debug run.
