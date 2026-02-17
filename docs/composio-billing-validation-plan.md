# Composio Billing Validation Plan

> **Owner:** TBD  
> **Date:** 2026-02-17  
> **Status:** Draft  
> **Related Design:** `docs/composio-billing-design.md`

## Purpose

Record a reusable validation plan for release and regression review of Composio billing changes, including provider pricing, tier mapping, accumulator behavior, and discount rules.

## Validation Principle

Release sign-off must be based on runtime evidence:

1. Request execution evidence (`uid`, `toolsetKey`, `toolName`, `resultId`, `version`)
2. Server log evidence (billing path + rule/tier decisions)
3. DB evidence (`tool_call_results`, `credit_usages`, pricing/promotion tables)

Unit tests are supporting evidence only.

## Evidence Collection

### Log search patterns

```bash
rg -n "Billing processed|dynamic billing|legacy billing|discount|provider billing|composio" /var/log/refly/api*.log
```

```bash
docker logs <api-container> 2>&1 | rg "Billing processed|dynamic billing|legacy billing|discount|provider billing|composio"
```

### SQL checks

```sql
SELECT result_id, version, uid, toolset_id, tool_name, status, created_at
FROM tool_call_results
WHERE uid = :uid
ORDER BY created_at DESC
LIMIT 50;
```

```sql
SELECT usage_id, uid, amount, due_amount, usage_type, action_result_id, version, description, created_at
FROM credit_usages
WHERE uid = :uid
  AND action_result_id = :result_id
  AND version = :version
ORDER BY created_at DESC;
```

```sql
SELECT provider_key, plan, standard_rate_per_1k, premium_rate_per_1k, margin, active
FROM tool_provider_billing
WHERE provider_key = 'composio'
ORDER BY updated_at DESC;
```

```sql
SELECT key, type, credit_billing, updated_at
FROM toolset_inventory
WHERE key IN ('twitter','googledocs','googledrive','gmail','github','reddit','notion');
```

```sql
SELECT provider_key, inventory_key, toolset_key, tool_name, user_segment, rule_type, rule_value, priority, enabled, start_at, end_at
FROM tool_billing_promotion
WHERE enabled = true
ORDER BY priority ASC, updated_at DESC;
```

## Runtime Cases (Release Gate)

Use these IDs consistently in review notes and incident follow-up.

- `RT-001`: Composio standard tier billing
- `RT-002`: Composio premium tier billing
- `RT-003`: Unknown action fallback to `_default` tier
- `RT-004`: First-month free campaign path
- `RT-005`: Toolset-level half-price campaign (e.g. Google Docs)
- `RT-006`: Dynamic tool discount path (e.g. `fal_image`)
- `RT-007`: Legacy numeric `credit_billing` compatibility
- `RT-008`: Missing provider config fallback behavior
- `RT-009`: Plan switch + cache refresh behavior
- `RT-010`: Accumulator threshold flush behavior
- `RT-011`: Concurrency near flush threshold
- `RT-012`: Migration idempotency and data consistency

Case definitions and expected outcomes are maintained in:
- `docs/composio-billing-design.md` -> `Verification Plan` section.

## Test Data Setup (Beginner Friendly)

Prepare these test users before running cases:

- `user_normal`: standard paid path
- `user_first_month_free`: eligible for first-month-free rule
- `user_promo_half_price`: eligible for half-price rule (if segmented)

Prepare these tool connections:

- Composio OAuth connected: `twitter`, `googledocs`
- Dynamic tool available: one billed method (example: `fal_image`)

Prepare these DB rows:

- Active Composio plan row in `tool_provider_billing`
- Promotion rows needed for `RT-004`, `RT-005`, `RT-006`

## How To Run Each Runtime Case

Use the same 5-step flow for every `RT-*` case.

1. Trigger one real request.
2. Record request metadata (`uid`, `toolsetKey`, `toolName`, timestamp).
3. Capture response metadata (`resultId`, `version`, status).
4. Search server logs for billing decision lines in same time window.
5. Run SQL queries and attach evidence rows.

Example request record template:

```md
- Case ID:
- uid:
- toolsetKey:
- toolName:
- requestAt (UTC):
- resultId:
- version:
```

### Suggested trigger methods

- API endpoint (if available in your env): call the tool execution route used by UI/workflow.
- Existing workflow/skill: run one workflow node that calls the target tool.
- CLI script: use your internal script that executes one tool call and returns `resultId`.

Important: do not run high-volume calls before single-call evidence is captured.

## Log Location Guide

Use the environment-specific location below.

- Local process logs: `/var/log/refly/api*.log` (or your configured app log file)
- Docker: `docker logs <api-container>`
- K8s: `kubectl logs deploy/<api-deployment> -n <namespace>`

Per-case grep command (replace `<FROM>` `<TO>` with your test time window):

```bash
docker logs <api-container> 2>&1 | \
rg "Billing processed|dynamic billing|legacy billing|discount|provider billing|composio" | \
rg "<uid>|<toolsetKey>|<toolName>|<resultId>"
```

PASS signal in logs:

- billing path is explicit (provider/dynamic/legacy)
- tier/rule decision appears where applicable
- no unexpected error on billing process

## DB Query Guide (With Variables)

Recommended variable values:

- `:uid` = test user id
- `:result_id` = response `resultId`
- `:version` = response `version`

Use `psql` variable mode example:

```sql
\set uid 'user_xxx'
\set result_id 'ar_xxx'
\set version 0
```

PASS signal in DB:

- one matching `tool_call_results` row exists with expected `toolset_id` + `tool_name`
- `credit_usages` row amount matches expected billing policy
- zero-charge cases have no unexpected charge row for same `resultId`/`version`

## Expected Numbers (Quick Reference)

Assume:

- `USD_TO_CREDITS_RATE = 120`
- plan = Ridiculously Cheap
- margin = `1.0`

| Type | Formula | Expected Credits/Call |
|------|---------|-----------------------|
| Standard | `(0.299 / 1000) * 120` | `0.03588` |
| Premium | `(0.897 / 1000) * 120` | `0.10764` |

Accumulator example:

- 28 standard calls: `28 * 0.03588 = 1.00464`
- expected behavior: flush `1` credit, keep remainder `~0.00464`

Rounding policy must be documented by engineering and used consistently in verification notes.

## Failure Handling Playbook

If log evidence is missing:

1. Confirm you are checking correct service instance/container.
2. Confirm log level includes billing debug/info lines.
3. Re-run single request and narrow to 1-minute window.

If DB evidence mismatches expected charge:

1. Re-check promotion rule overlap/priority.
2. Re-check active provider plan row.
3. Re-check whether call went through legacy path.
4. File issue with full evidence bundle:
   request data, response, log lines, SQL output.

Escalation owner suggestion:

- billing logic: Tool/Billing owner
- data issues: DB migration owner
- runtime/logging gaps: API platform owner

## Production Gate (Must Pass)

Do not promote to production unless all conditions are true:

- All required `RT-*` cases pass in staging.
- Each case has request + log + DB evidence saved.
- No unexplained fallback to `3` credits for Composio standard actions.
- Discount rules verified on both Composio and dynamic tool paths.
- Migration rerun is idempotent (no duplicated rows / broken constraints).

## Review Checklist

- [ ] All required `RT-*` cases executed in staging
- [ ] Each case has request/log/DB evidence attached
- [ ] Any mismatch has issue ID and owner
- [ ] No unexplained 3-credit fallback for Composio standard actions
- [ ] Discount paths verified for both Composio and dynamic tools
- [ ] Plan-switch behavior verified after cache refresh window
- [ ] Migration scripts rerun safely without duplicate data

## Sign-off Record Template

```md
## Billing Validation Sign-off

- Build/Commit:
- Environment:
- Validator:
- Date:

### Executed Cases
- RT-001: PASS/FAIL (evidence links)
- RT-002: PASS/FAIL (evidence links)
- RT-003: PASS/FAIL (evidence links)
- RT-004: PASS/FAIL (evidence links)
- RT-005: PASS/FAIL (evidence links)
- RT-006: PASS/FAIL (evidence links)
- RT-007: PASS/FAIL (evidence links)
- RT-008: PASS/FAIL (evidence links)
- RT-009: PASS/FAIL (evidence links)
- RT-010: PASS/FAIL (evidence links)
- RT-011: PASS/FAIL (evidence links)
- RT-012: PASS/FAIL (evidence links)

### Open Issues
- <issue-id>: <summary>

### Decision
- Release: APPROVED / BLOCKED
- Notes:
```
