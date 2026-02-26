#!/usr/bin/env python3
"""PTC Debug Billing — Full billing trace: per-call credits, inline totals, discounts, warnings."""

from ptc_common import (
    SEPARATOR,
    check_schema_columns,
    connect_db,
    fetch_billing_tool_calls,
    fetch_ptc_enabled,
    fmt_agent_line,
    fmt_ptc_line,
    fmt_status_icon,
    fmt_time,
    make_arg_parser,
    organize_billing_calls,
    print_result_info,
    resolve_result,
)

DIVIDER = "  " + "─" * 58


# ── Section [2]: BILLING TRACE with inline summary ─────────────────────────────

def print_billing_trace(cur, r_id, r_ver, agent_calls, ptc_by_parent, raw, agent_count, ptc_count, full=False):
    print(f"[2] BILLING TRACE  ({agent_count} agent + {ptc_count} ptc)")
    print()

    total_agent_credits = total_ptc_credits = 0

    for ac in agent_calls:
        print(fmt_agent_line(ac))
        total_agent_credits += ac["credits_charged"]

        for ptc in ptc_by_parent.get(ac["call_id"], []):
            print(fmt_ptc_line(ptc))
            if full:
                if ptc["duration"] is not None:
                    print(f"       Duration: {ptc['duration']:.1f}s")
                print(f"       Call ID:  {ptc['call_id'][:40]}...")
            total_ptc_credits += ptc["credits_charged"]

        print()

    # Orphan PTC calls (explicit ptc_call_id pointing to a non-existent agent call)
    all_agent_ids = {ac["call_id"] for ac in agent_calls}
    orphan_ptc = []
    for (
        call_id, tool_name, tc_type, status,
        created_at, updated_at, ptc_call_id, toolset_id,
        credits_charged, original_price, billing_toolset_key,
    ) in raw:
        is_ptc = (tc_type == "ptc") if tc_type else call_id.startswith("ptc:")
        if is_ptc and ptc_call_id and ptc_call_id not in all_agent_ids:
            orphan_ptc.append({
                "call_id": call_id, "tool_name": tool_name, "status": status,
                "created_at": created_at, "toolset_id": toolset_id,
                "credits_charged": credits_charged or 0, "original_price": original_price or 0,
                "billing_toolset_key": billing_toolset_key,
                "is_non_billable": False, "duration": None,
            })

    if orphan_ptc:
        print(f"  [Orphan PTC — parent not found] ({len(orphan_ptc)})")
        for ptc in orphan_ptc:
            print(fmt_ptc_line(ptc))
            total_ptc_credits += ptc["credits_charged"]
        print()

    # Inline billing summary
    cur.execute(
        """
        SELECT
          SUM(CASE WHEN usage_type = 'tool_call'  THEN amount     ELSE 0 END),
          SUM(CASE WHEN usage_type = 'model_call' THEN amount     ELSE 0 END),
          SUM(amount),
          SUM(CASE WHEN usage_type = 'tool_call'  THEN due_amount ELSE 0 END),
          SUM(CASE WHEN usage_type = 'model_call' THEN due_amount ELSE 0 END)
        FROM refly.credit_usages
        WHERE action_result_id = %s AND version = %s
        """,
        (r_id, r_ver),
    )
    row = cur.fetchone()
    tool_credits = model_credits = total_credits = total_original = 0
    if row:
        tool_credits  = row[0] or 0
        model_credits = row[1] or 0
        total_credits = row[2] or 0
        tool_original = (row[3] or 0) + (row[4] or 0)
    total_discount = tool_original - total_credits

    print(DIVIDER)
    print(f"  Tools:  {tool_credits:>8} credits  (agent: {total_agent_credits} | ptc: {total_ptc_credits})")
    print(f"  Model:  {model_credits:>8} credits")
    if total_discount > 0:
        print(f"  Total:  {total_credits:>8} credits  (original: {tool_original}, discount: {total_discount})")
    else:
        print(f"  Total:  {total_credits:>8} credits")
    print(DIVIDER)
    print()


# ── Section [3]: WARNINGS ──────────────────────────────────────────────────────

def print_warnings(warnings, section_num, full=False):
    if not warnings:
        return
    print(f"[{section_num}] ⚠️  BILLING WARNINGS ({len(warnings)} issue{'s' if len(warnings) != 1 else ''})")
    print()
    print("  The following tool calls completed successfully but were NOT billed:")
    print()
    for w in warnings:
        print(f"  ⚠️  [{w['toolset']}] {w['tool_name']}")
        print(f"     Time: {fmt_time(w['created_at'])}")
        if full:
            print(f"     Call ID: {w['call_id'][:40]}...")
        print("     Reason: Successful execution but 0 credits charged")
        print("     → Check if tool is configured for billing (isGlobal=true)")
        print()


# ── Section [4]: DETAILED BREAKDOWN (--full only) ─────────────────────────────

def print_detailed_breakdown(cur, r_id, r_ver, section_num):
    print(f"[{section_num}] DETAILED BREAKDOWN BY TOOLSET")
    print()
    cur.execute(
        """
        SELECT
          COALESCE(cu.tool_call_meta::json->>'toolsetKey', tc.toolset_id) AS toolset,
          tc.tool_name,
          tc.type AS call_type,
          COUNT(*)                                                         AS calls,
          COUNT(CASE WHEN tc.status = 'completed' THEN 1 END)             AS success,
          SUM(COALESCE(cu.amount,     0))                                  AS total_credits,
          SUM(COALESCE(cu.due_amount, 0))                                  AS original_price
        FROM refly.tool_call_results tc
        LEFT JOIN refly.credit_usages cu
          ON tc.call_id = cu.tool_call_id AND cu.usage_type = 'tool_call'
        WHERE tc.result_id = %s AND tc.version = %s AND tc.deleted_at IS NULL
        GROUP BY toolset, tc.tool_name, tc.type
        ORDER BY total_credits DESC
        """,
        (r_id, r_ver),
    )
    breakdown = cur.fetchall()
    if not breakdown:
        return

    max_toolset_len = max(len(str(b[0] or "?")) for b in breakdown)
    max_tool_len    = max(len(str(b[1] or "?")) for b in breakdown)

    print(
        f"  {'Toolset':<{max_toolset_len}}  {'Tool':<{max_tool_len}}  {'Type':<6}  "
        f"{'Calls':>6}  {'Success':>7}  {'Credits':>8}  {'Original':>8}"
    )
    print(
        f"  {'-' * max_toolset_len}  {'-' * max_tool_len}  {'-' * 6}  "
        f"{'-' * 6}  {'-' * 7}  {'-' * 8}  {'-' * 8}"
    )
    for toolset, tool_name, call_type, calls, success, total_credits, original_price in breakdown:
        print(
            f"  {(toolset or '?'):<{max_toolset_len}}  {(tool_name or '?'):<{max_tool_len}}  "
            f"{(call_type or '?'):<6}  {calls:>6}  {success:>7}  {total_credits:>8}  {original_price:>8}"
        )
    print()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = make_arg_parser("PTC Debug Billing: full billing trace for an agent result")
    args = parser.parse_args()

    conn = connect_db()
    cur = conn.cursor()

    r_id, r_ver, r_type, r_model, r_status, r_title, r_input, r_created = resolve_result(cur, args.id)
    ptc_enabled = fetch_ptc_enabled(cur, r_id, r_ver)

    print(f"\n{SEPARATOR}")
    print(f" PTC DEBUG BILLING: {r_id}")
    print(f"{SEPARATOR}\n")

    print_result_info(r_id, r_ver, r_model, r_status, r_title, r_input, r_created, args.full, ptc_enabled=ptc_enabled)

    has_type_col, has_ptc_col = check_schema_columns(cur)
    raw = fetch_billing_tool_calls(cur, r_id, r_ver, has_type_col, has_ptc_col)
    agent_calls, ptc_by_parent, agent_count, ptc_count, warnings = organize_billing_calls(raw)

    print_billing_trace(cur, r_id, r_ver, agent_calls, ptc_by_parent, raw, agent_count, ptc_count, args.full)

    next_section = 3
    if warnings:
        print_warnings(warnings, next_section, args.full)
        next_section += 1

    if args.full:
        print_detailed_breakdown(cur, r_id, r_ver, next_section)

    print(f"{SEPARATOR}\n")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
