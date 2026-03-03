# PTC Debug Scripts

Python scripts for inspecting PTC (Programmatic Tool Calling) agent runs in the Refly database.

## Prerequisites

```bash
pip install psycopg2-binary
```

Set the database URL via environment variable:

```bash
export REFLY_DATABASE_URL_LOCAL="postgresql://user:pass@localhost:5432/refly"
```

## Parameters

All scripts accept:

```bash
python <script>.py <id> [title] [--full]
```

| Parameter | Meaning |
|-----------|---------|
| `id` | Action result ID (`ar-...` / `sk-...`) or canvas ID (`c-...`) |
| `title` | _(optional)_ Exact title match — narrows a canvas lookup to a specific result |
| `--full` | Show full inputs/outputs without truncation |

### ID / title resolution

| `id` | `title` | Behaviour |
|------|---------|-----------|
| `ar-...` / `sk-...` | — | Fetches the latest version of that result |
| `c-...` | — | Fetches the most recent result for that canvas |
| `c-...` | provided | Fetches the most recent result in that canvas whose `title` matches exactly |

## Scripts

### `ptc_debug_billing.py` — Billing trace

Shows per-call credit charges, discounts, and totals for an agent run.

```bash
python ptc_debug_billing.py <id>
python ptc_debug_billing.py <id> [title]
python ptc_debug_billing.py <id> --full        # full details + toolset breakdown
```

**Output sections:**

1. **RESULT INFO** — result ID, version, model, status, PTC flag, prompt, timestamp
2. **BILLING TRACE** — each agent call with its nested PTC sub-calls, credits charged, toolset key, duration
   - Inline summary: tools total / model total / grand total credits, with discount if any
3. **BILLING WARNINGS** _(if any)_ — completed calls that were charged 0 credits (possible misconfiguration)
4. **DETAILED BREAKDOWN** _(--full only)_ — per-toolset/tool aggregated table: calls, success count, credits, original price

Orphan PTC calls (whose parent agent call is missing) are shown separately.

### `ptc_debug_calling.py` — Execution trace

Shows the full conversation and tool call timeline, including inputs and outputs.

```bash
python ptc_debug_calling.py <id>
python ptc_debug_calling.py <id> [title]
python ptc_debug_calling.py <id> --full        # show full inputs/outputs without truncation
```

**Output sections:**

1. **RESULT INFO** — same as above
2. **CONVERSATION** — all `action_messages` in order (user/assistant/tool messages with content)
3. **TOOL CALLS TIMELINE** — each agent call with:
   - Input
   - Output summary
   - Error (if any)
   - Nested PTC sub-calls with brief argument summary

By default, content is truncated at 1500 chars. Use `--full` to see everything.

### `ptc_verify.py` — Health checks

Billing timeline plus consolidated correctness checks for a PTC run.

```bash
python ptc_verify.py <id>
python ptc_verify.py <id> [title]
python ptc_verify.py <id> --full
```

**Output sections:**

1. **RESULT INFO**
2. **BILLING TIMELINE** — compact view (same layout as `ptc_debug_billing` trace, with ⚠️ flags on unbilled calls)
3. **CHECKS** — automated health checks:
   - `ptc_enabled` flag on the result row
   - `action_messages` recorded
   - Temp API key presence (sandbox authentication)
   - `ptc_call_id` linkage integrity (orphan PTC calls)
   - `credit_usages` foreign key integrity (broken billing refs)
   - Unbilled completed calls
   - **Result line**: ✓ all passed / ✗ N issues found

## Examples

```bash
# Quick billing check on a canvas (latest result)
python ptc_debug_billing.py c-abc123

# Billing check for a specific result by title within a canvas
python ptc_debug_billing.py c-abc123 "My workflow title"

# Full calling trace for a specific result
python ptc_debug_calling.py ar-xyz789 --full

# Calling trace for a canvas result matched by title
python ptc_debug_calling.py c-abc123 "My workflow title" --full

# Verify PTC health for a skill result
python ptc_verify.py sk-def456

# Verify by canvas + title
python ptc_verify.py c-abc123 "My workflow title"
```
