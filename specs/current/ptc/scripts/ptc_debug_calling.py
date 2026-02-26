#!/usr/bin/env python3
"""PTC Debug Calling — Full execution trace: conversation messages, tool inputs/outputs, errors."""

import json
from collections import defaultdict

from ptc_common import (
    SEPARATOR,
    TRUNCATE_LEN,
    assign_unlinked_ptc,
    check_schema_columns,
    connect_db,
    fetch_ptc_enabled,
    fmt_status_icon,
    fmt_time,
    make_arg_parser,
    parse_json_safe,
    print_result_info,
    resolve_result,
    truncate,
)


# ── Formatting helpers ─────────────────────────────────────────────────────────

def format_block(content, separator="-" * 100, truncate_len=TRUNCATE_LEN, full=False):
    if not content:
        return "(empty)"
    content = str(content).strip()
    if not full and len(content) > truncate_len:
        content = content[:truncate_len] + f"\n... ({len(content)} chars total)"
    return f"\n{separator}\n{content}\n{separator}"


def extract_code_input(input_data):
    parsed = parse_json_safe(input_data)
    if isinstance(parsed, dict):
        inner = parsed.get("input")
        if isinstance(inner, str):
            inner_parsed = parse_json_safe(inner)
            if isinstance(inner_parsed, dict) and "code" in inner_parsed:
                return inner_parsed["code"]
        return (
            parsed.get("code")
            or parsed.get("input")
            or json.dumps(parsed, ensure_ascii=False)
        )
    return str(input_data) if input_data else ""


def extract_ptc_summary(tool_name, input_data):
    parsed = parse_json_safe(input_data)
    if isinstance(parsed, dict):
        inner = parsed.get("input", parsed)
        if isinstance(inner, str):
            inner = parse_json_safe(inner) or {}
        if isinstance(inner, dict):
            for key in ("symbol", "keywords", "query", "ticker", "name", "url", "topic"):
                if key in inner:
                    return f"({inner[key]})"
            for k, v in inner.items():
                if v is not None and isinstance(v, str) and len(v) < 50:
                    return f"({v})"
    return ""


def extract_output_summary(output_data, tool_name=None):
    parsed = parse_json_safe(output_data)
    if isinstance(parsed, dict):
        data = parsed.get("data", parsed)
        if isinstance(data, dict):
            stdout = data.get("output") or data.get("stdout") or ""
            exit_code = data.get("exitCode", data.get("exit_code"))
            if stdout or exit_code is not None:
                parts = []
                if stdout:
                    parts.append(str(stdout).strip())
                if exit_code is not None and exit_code != 0:
                    parts.append(f"[exit={exit_code}]")
                return "\n".join(parts) if parts else "(empty output)"
        return json.dumps(parsed, ensure_ascii=False)
    return str(output_data) if output_data else "(empty output)"


# ── Data fetch / organize ──────────────────────────────────────────────────────

def fetch_tool_calls(cur, r_id, r_ver, has_type_col, has_ptc_col):
    if has_type_col and has_ptc_col:
        cur.execute(
            """
            SELECT call_id, tool_name, type, status, input, output, error, created_at, ptc_call_id
            FROM refly.tool_call_results
            WHERE result_id = %s AND version = %s AND deleted_at IS NULL
            ORDER BY created_at ASC
            """,
            (r_id, r_ver),
        )
    else:
        cur.execute(
            """
            SELECT call_id, tool_name, NULL AS type, status, input, output, error, created_at, NULL AS ptc_call_id
            FROM refly.tool_call_results
            WHERE result_id = %s AND version = %s AND deleted_at IS NULL
            ORDER BY created_at ASC
            """,
            (r_id, r_ver),
        )
    return cur.fetchall()


def organize_calls(raw_rows):
    agent_calls = []
    ptc_by_parent = defaultdict(list)
    agent_count = ptc_count = 0

    for call_id, tool_name, tc_type, status, inp, out, error, created_at, ptc_call_id in raw_rows:
        is_ptc = (tc_type == "ptc") if tc_type else call_id.startswith("ptc:")
        row = {
            "call_id": call_id,
            "tool_name": tool_name,
            "status": status,
            "input": inp,
            "output": out,
            "error": error,
            "created_at": created_at,
            "ptc_call_id": ptc_call_id,
        }
        if is_ptc:
            ptc_count += 1
            ptc_by_parent[ptc_call_id if ptc_call_id else "__unlinked__"].append(row)
        else:
            agent_calls.append(row)
            agent_count += 1

    assign_unlinked_ptc(agent_calls, ptc_by_parent)
    return agent_calls, ptc_by_parent, agent_count, ptc_count


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = make_arg_parser("PTC Debug Calling: full execution trace for an agent result")
    args = parser.parse_args()

    conn = connect_db()
    cur = conn.cursor()

    r_id, r_ver, r_type, r_model, r_status, r_title, r_input, r_created = resolve_result(cur, args.id)
    ptc_enabled = fetch_ptc_enabled(cur, r_id, r_ver)

    print(f"\n{SEPARATOR}")
    print(f" PTC DEBUG CALLING: {r_id}")
    print(f"{SEPARATOR}\n")

    print_result_info(r_id, r_ver, r_model, r_status, r_title, r_input, r_created, args.full, ptc_enabled=ptc_enabled)

    # [2] CONVERSATION MESSAGES
    cur.execute(
        """
        SELECT message_id, type, content, tool_call_meta, tool_call_id, created_at
        FROM refly.action_messages
        WHERE result_id = %s AND version = %s
        ORDER BY created_at ASC
        """,
        (r_id, r_ver),
    )
    messages = cur.fetchall()

    type_counts = defaultdict(int)
    for _, mtype, *_ in messages:
        type_counts[mtype] += 1
    counts_str = ", ".join(f"{v} {k}" for k, v in sorted(type_counts.items()))
    print(f"[2] CONVERSATION ({counts_str or 'no messages'})")

    for msg_id, mtype, content, tool_call_meta, tool_call_id, created_at in messages:
        label = mtype.upper() if mtype else "UNKNOWN"
        meta = parse_json_safe(tool_call_meta)
        meta_info = ""
        if isinstance(meta, dict) and meta.get("toolName"):
            status_icon = fmt_status_icon(meta.get("status", ""))
            meta_info = f" [{meta['toolName']} {status_icon}]"
        print(f"  --- {label} ({msg_id or '?'}) @ {fmt_time(created_at)}{meta_info} ---")
        if content:
            display = truncate(content, TRUNCATE_LEN, args.full)
            for line in display.split("\n"):
                print(f"  {line}")
        print()

    # [3] TOOL CALLS TIMELINE
    has_type_col, has_ptc_col = check_schema_columns(cur)
    raw = fetch_tool_calls(cur, r_id, r_ver, has_type_col, has_ptc_col)
    agent_calls, ptc_by_parent, agent_count, ptc_count = organize_calls(raw)

    print(f"[3] TOOL CALLS TIMELINE ({agent_count} agent + {ptc_count} ptc)")
    print()

    for ac in agent_calls:
        status_icon = fmt_status_icon(ac["status"])
        print(f"  [Agent] {ac['tool_name']} @ {fmt_time(ac['created_at'])} ({ac['status']}) {status_icon}")

        if ac["tool_name"] == "execute_code":
            code = extract_code_input(ac["input"])
            print(f"    Code: {format_block(code, truncate_len=TRUNCATE_LEN, full=args.full)}")
            parsed_input = parse_json_safe(ac["input"])
            if isinstance(parsed_input, dict) and parsed_input.get("language"):
                print(f"    Lang: {parsed_input['language']}")
        else:
            inp_display = truncate(str(ac["input"] or ""), TRUNCATE_LEN, args.full)
            if inp_display != "(empty)":
                print(f"    Input: {inp_display}")

        out_summary = extract_output_summary(ac["output"], ac["tool_name"])
        print(f"    Output: {format_block(out_summary, truncate_len=TRUNCATE_LEN, full=args.full)}")

        if ac["error"]:
            print(f"    Error: {format_block(ac['error'], truncate_len=TRUNCATE_LEN, full=args.full)}")

        for ptc in ptc_by_parent.get(ac["call_id"], []):
            ptc_icon = fmt_status_icon(ptc["status"])
            ptc_summary = extract_ptc_summary(ptc["tool_name"], ptc["input"])
            print(f"    └─ [PTC] {ptc['tool_name']} {ptc_summary} @ {fmt_time(ptc['created_at'])} {ptc_icon}")
            if args.full:
                if ptc["input"]:
                    print(f"       Input: {ptc['input']}")
                if ptc["output"]:
                    print(f"       Output: {truncate(ptc['output'], TRUNCATE_LEN, args.full)}")
                if ptc["error"]:
                    print(f"       Error: {ptc['error']}")
        print()

    # Orphan PTC calls (explicit ptc_call_id that doesn't match any agent call)
    all_agent_ids = {ac["call_id"] for ac in agent_calls}
    orphan_ptc = [
        (call_id, tool_name, status, inp, created_at, ptc_call_id)
        for call_id, tool_name, tc_type, status, inp, out, error, created_at, ptc_call_id in raw
        if ((tc_type == "ptc") if tc_type else call_id.startswith("ptc:"))
        and ptc_call_id and ptc_call_id not in all_agent_ids
    ]
    if orphan_ptc:
        print(f"  [Orphan PTC calls — parent not found] ({len(orphan_ptc)})")
        for call_id, tool_name, status, inp, created_at, ptc_call_id in orphan_ptc:
            icon = fmt_status_icon(status)
            summary = extract_ptc_summary(tool_name, inp)
            print(f"    └─ [PTC] {tool_name} {summary} @ {fmt_time(created_at)} {icon}  (parent: {ptc_call_id})")
        print()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
