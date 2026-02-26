#!/usr/bin/env python3
"""Shared utilities for PTC debug/verify scripts."""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

try:
    import psycopg2
except ImportError:
    print(
        "Error: psycopg2 is required. Install with: pip install psycopg2-binary",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Constants ──────────────────────────────────────────────────────────────────

SEPARATOR = "═" * 62
TRUNCATE_LEN = 1500
TITLE_TRUNCATE = 200
TITLE_DISPLAY_TRUNCATE = 50

# Built-in tools that are intentionally free (no creditCost set)
NON_BILLABLE_TOOL_NAMES = {
    "get_time",
    "read_file",
    "list_files",
    "read_agent_result",
    "read_tool_result",
    "generate_doc",
    "generate_code_artifact",
    "execute_code",
}

# ── Timezone ───────────────────────────────────────────────────────────────────

LOCAL_TZ = datetime.now().astimezone().tzinfo


def to_local_time(dt):
    if dt is None:
        return None
    if not isinstance(dt, datetime):
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ)


# ── String / format helpers ────────────────────────────────────────────────────

def parse_json_safe(s):
    if not s:
        return None
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return s


def truncate(s, length, full=False):
    if not s:
        return "(empty)"
    s = str(s).strip()
    if full or len(s) <= length:
        return s
    return s[:length] + f"... ({len(s)} chars total)"


def fmt_time(dt):
    if dt is None:
        return "?"
    local_dt = to_local_time(dt)
    if isinstance(local_dt, datetime):
        return local_dt.strftime("%H:%M:%S")
    return str(local_dt)


def fmt_datetime(dt):
    if dt is None:
        return "?"
    local_dt = to_local_time(dt)
    if isinstance(local_dt, datetime):
        return local_dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(local_dt)


def fmt_status_icon(status):
    if status in ("completed", "finish", "success"):
        return "✓"
    elif status in ("failed", "error"):
        return "✗"
    elif status in ("running", "in_progress", "executing"):
        return "⟳"
    return "?"


def extract_prompt_from_title(title):
    """Strip Variables JSON block from title, return only the user prompt."""
    if not title:
        return title
    if not title.strip().startswith("Variables:"):
        return title

    lines = title.split("\n")
    in_json = False
    prompt_lines = []
    found_prompt = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("["):
            in_json = True
            continue
        if in_json:
            if stripped.startswith("]"):
                in_json = False
            continue
        if not found_prompt and not stripped:
            continue
        if stripped.startswith("Variables:"):
            continue
        if stripped:
            found_prompt = True
            prompt_lines.append(line)

    return "\n".join(prompt_lines).strip() if prompt_lines else title


# ── Arg parser / DB setup ──────────────────────────────────────────────────────

def make_arg_parser(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "id",
        help="Action result ID (ar-... or sk-...) or canvas ID (c-...)",
    )
    parser.add_argument(
        "title",
        nargs="?",
        default=None,
        help="Optional title (exact match) to select a specific result within the canvas (only used with c-... IDs)",
    )
    parser.add_argument(
        "--full", action="store_true", help="Show full details without truncation"
    )
    return parser


def connect_db():
    db_url = os.environ.get("REFLY_DATABASE_URL_LOCAL")
    if not db_url:
        print(
            "Error: REFLY_DATABASE_URL_LOCAL env var required",
            file=sys.stderr,
        )
        sys.exit(1)
    return psycopg2.connect(db_url)


def resolve_result(cur, id_arg, title=None):
    """
    Resolve canvas ID or result ID to an action_result row.

    - canvas ID (c-...) + title: exact match on title within that canvas
    - canvas ID (c-...): latest result for that canvas
    - result ID (ar-... / sk-...): latest version of that result

    Returns (result_id, version, type, model_name, status, title, input, created_at) or exits.
    """
    is_canvas = id_arg.startswith("c-")
    is_result = id_arg.startswith("ar-") or id_arg.startswith("sk-")

    if not is_canvas and not is_result:
        print(
            f"Error: ID must start with 'ar-'/'sk-' (result_id) or 'c-' (canvas_id), got: {id_arg}",
            file=sys.stderr,
        )
        sys.exit(1)

    if is_canvas and title:
        cur.execute(
            """
            SELECT result_id, version, type, model_name, status, title, input, created_at
            FROM refly.action_results
            WHERE target_id = %s AND title = %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (id_arg, title),
        )
    elif is_canvas:
        cur.execute(
            """
            SELECT result_id, version, type, model_name, status, title, input, created_at
            FROM refly.action_results
            WHERE target_id = %s
            ORDER BY created_at DESC LIMIT 1
            """,
            (id_arg,),
        )
    else:
        cur.execute(
            """
            SELECT result_id, version, type, model_name, status, title, input, created_at
            FROM refly.action_results
            WHERE result_id = %s
            ORDER BY version DESC LIMIT 1
            """,
            (id_arg,),
        )

    row = cur.fetchone()
    if not row:
        if is_canvas and title:
            print(f"No result found for canvas_id={id_arg} with title={title!r}", file=sys.stderr)
        else:
            label = "canvas_id" if is_canvas else "result_id"
            print(f"No result found for {label}={id_arg}", file=sys.stderr)
        sys.exit(1)
    return row


def fetch_ptc_enabled(cur, r_id, r_ver):
    """Return ptc_enabled value for the given result, or None if column doesn't exist."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'refly' AND table_name = 'action_results'
          AND column_name = 'ptc_enabled'
    """)
    if not cur.fetchone():
        return None
    cur.execute(
        "SELECT ptc_enabled FROM refly.action_results WHERE result_id = %s AND version = %s",
        (r_id, r_ver),
    )
    row = cur.fetchone()
    return row[0] if row else None


def print_result_info(r_id, r_ver, r_model, r_status, r_title, r_input, r_created, full=False, ptc_enabled=None):
    """Print section [1] RESULT INFO."""
    user_prompt = ""
    if r_input:
        input_data = parse_json_safe(r_input)
        if isinstance(input_data, dict) and "query" in input_data:
            user_prompt = extract_prompt_from_title(input_data["query"])
    if not user_prompt:
        user_prompt = extract_prompt_from_title(r_title)

    print("[1] RESULT INFO")
    print(f"  Result ID: {r_id}")
    print(f"  Version:   {r_ver}")
    print(f"  Model:     {r_model}")
    print(f"  Status:    {r_status}")
    if ptc_enabled is not None:
        print(f"  PTC:       {'true' if ptc_enabled else 'false'}")
    print(f"  Title:     {truncate(r_title, TITLE_DISPLAY_TRUNCATE, full)}")
    print(f"  Prompt:    {truncate(user_prompt, TITLE_TRUNCATE, full)}")
    print(f"  Created:   {fmt_datetime(r_created)}")
    print()


def check_schema_columns(cur):
    """Returns (has_type_col, has_ptc_col) for tool_call_results schema compatibility."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'refly' AND table_name = 'tool_call_results'
          AND column_name IN ('type', 'ptc_call_id')
    """)
    extra_cols = {r[0] for r in cur.fetchall()}
    return "type" in extra_cols, "ptc_call_id" in extra_cols


# ── Tool call organization ─────────────────────────────────────────────────────

def assign_unlinked_ptc(agent_calls, ptc_by_parent):
    """
    Move '__unlinked__' PTC calls into ptc_by_parent keyed by the nearest
    preceding agent call's call_id (by timestamp). Mutates ptc_by_parent in-place.
    """
    unlinked = ptc_by_parent.pop("__unlinked__", [])
    if not unlinked or not agent_calls:
        return
    for ptc in unlinked:
        parent = None
        for ac in agent_calls:
            if ac["created_at"] <= ptc["created_at"]:
                parent = ac
            else:
                break
        target = parent if parent else agent_calls[0]
        ptc_by_parent[target["call_id"]].append(ptc)


# ── Billing fetch + organize (shared by ptc_debug_billing and ptc_verify) ──────

def fetch_billing_tool_calls(cur, r_id, r_ver, has_type_col, has_ptc_col):
    """Fetch tool_call_results joined with credit_usages for billing analysis."""
    if has_type_col and has_ptc_col:
        cur.execute(
            """
            SELECT
                tc.call_id, tc.tool_name, tc.type, tc.status,
                tc.created_at, tc.updated_at, tc.ptc_call_id, tc.toolset_id,
                cu.amount        AS credits_charged,
                cu.due_amount    AS original_price,
                cu.tool_call_meta::json->>'toolsetKey' AS billing_toolset_key
            FROM refly.tool_call_results tc
            LEFT JOIN refly.credit_usages cu
                ON tc.call_id = cu.tool_call_id AND cu.usage_type = 'tool_call'
            WHERE tc.result_id = %s AND tc.version = %s AND tc.deleted_at IS NULL
            ORDER BY tc.created_at ASC
            """,
            (r_id, r_ver),
        )
    else:
        cur.execute(
            """
            SELECT
                tc.call_id, tc.tool_name, NULL AS type, tc.status,
                tc.created_at, tc.updated_at, NULL AS ptc_call_id, tc.toolset_id,
                cu.amount        AS credits_charged,
                cu.due_amount    AS original_price,
                cu.tool_call_meta::json->>'toolsetKey' AS billing_toolset_key
            FROM refly.tool_call_results tc
            LEFT JOIN refly.credit_usages cu
                ON tc.call_id = cu.tool_call_id AND cu.usage_type = 'tool_call'
            WHERE tc.result_id = %s AND tc.version = %s AND tc.deleted_at IS NULL
            ORDER BY tc.created_at ASC
            """,
            (r_id, r_ver),
        )
    return cur.fetchall()


def organize_billing_calls(raw_rows):
    """
    Organize billing raw rows into agent_calls and ptc_by_parent dicts.

    Each row dict keys: call_id, tool_name, type, status, created_at, updated_at,
    ptc_call_id, toolset_id, credits_charged, original_price, billing_toolset_key,
    duration, is_non_billable.

    Returns (agent_calls, ptc_by_parent, agent_count, ptc_count, warnings).
    warnings is a list of {type, tool_name, toolset, call_id, created_at}.
    """
    agent_calls = []
    ptc_by_parent = defaultdict(list)
    agent_count = ptc_count = 0
    warnings = []

    for (
        call_id, tool_name, tc_type, status,
        created_at, updated_at, ptc_call_id, toolset_id,
        credits_charged, original_price, billing_toolset_key,
    ) in raw_rows:
        is_ptc = (tc_type == "ptc") if tc_type else call_id.startswith("ptc:")
        is_non_billable = tool_name in NON_BILLABLE_TOOL_NAMES
        duration = (
            (updated_at - created_at).total_seconds()
            if created_at and updated_at
            else None
        )

        row = {
            "call_id": call_id,
            "tool_name": tool_name,
            "type": "ptc" if is_ptc else "agent",
            "status": status,
            "created_at": created_at,
            "updated_at": updated_at,
            "ptc_call_id": ptc_call_id,
            "toolset_id": toolset_id,
            "credits_charged": credits_charged or 0,
            "original_price": original_price or 0,
            "billing_toolset_key": billing_toolset_key,
            "duration": duration,
            "is_non_billable": is_non_billable,
        }

        if status == "completed" and (credits_charged or 0) == 0 and not is_non_billable:
            warnings.append({
                "type": "unbilled_success",
                "tool_name": tool_name,
                "toolset": billing_toolset_key or toolset_id,
                "call_id": call_id,
                "created_at": created_at,
            })

        if is_ptc:
            ptc_count += 1
            ptc_by_parent[ptc_call_id if ptc_call_id else "__unlinked__"].append(row)
        else:
            agent_calls.append(row)
            agent_count += 1

    assign_unlinked_ptc(agent_calls, ptc_by_parent)
    return agent_calls, ptc_by_parent, agent_count, ptc_count, warnings


def billing_icons(row):
    """Return (billing_icon, billing_details) for a billing row dict."""
    credits = row["credits_charged"]
    original = row["original_price"]
    if row["is_non_billable"]:
        return "—", "—"
    elif credits > 0:
        icon = "💰"
    elif row["status"] == "failed":
        icon = "✗"
    else:
        icon = "⚠️"

    details = f"{icon} {credits} credits"
    if original and original != credits:
        discount = original - credits
        details = f"{details} (orig: {original}, disc: {discount})"
    return icon, details


def fmt_agent_line(ac, warn_ids=None):
    """Format one agent-call line for billing display."""
    status_icon = fmt_status_icon(ac["status"])
    duration = f"{ac['duration']:.1f}s" if ac["duration"] is not None else "?"
    warn_flag = "  ← ⚠️ UNBILLED" if warn_ids and ac["call_id"] in warn_ids else ""

    if ac["is_non_billable"]:
        detail = f"— (non-billable | {duration})"
    else:
        toolset = ac["billing_toolset_key"] or ac["toolset_id"] or "?"
        _, billing_details = billing_icons(ac)
        detail = f"[{toolset}]  {billing_details} | {duration}"

    return f"  [Agent] {ac['tool_name']} @ {fmt_time(ac['created_at'])} {status_icon}  {detail}{warn_flag}"


def fmt_ptc_line(ptc, warn_ids=None):
    """Format one PTC child line for billing display."""
    status_icon = fmt_status_icon(ptc["status"])
    warn_flag = "  ← ⚠️ UNBILLED" if warn_ids and ptc["call_id"] in warn_ids else ""

    if ptc["is_non_billable"]:
        detail = "—"
    else:
        toolset = ptc["billing_toolset_key"] or ptc["toolset_id"] or "?"
        _, billing_details = billing_icons(ptc)
        detail = f"[{toolset}]  {billing_details}"

    return f"    └─ [PTC] {ptc['tool_name']} @ {fmt_time(ptc['created_at'])} {status_icon}  {detail}{warn_flag}"
