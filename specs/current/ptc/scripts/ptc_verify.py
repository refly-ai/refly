#!/usr/bin/env python3
"""PTC Verify — Billing timeline first, then consolidated checks + warnings at the end."""

from ptc_common import (
    SEPARATOR,
    check_schema_columns,
    connect_db,
    fetch_billing_tool_calls,
    fetch_ptc_enabled,
    fmt_agent_line,
    fmt_datetime,
    fmt_ptc_line,
    fmt_time,
    make_arg_parser,
    organize_billing_calls,
    print_result_info,
    resolve_result,
)

DIVIDER = "  " + "─" * 58


# ── Section [2]: BILLING TIMELINE ─────────────────────────────────────────────


def print_billing_timeline(
    agent_calls, ptc_by_parent, raw, agent_count, ptc_count, warnings
):
    warn_ids = {w["call_id"] for w in warnings}
    all_agent_ids = {ac["call_id"] for ac in agent_calls}

    print(f"[2] BILLING TIMELINE  ({agent_count} agent + {ptc_count} ptc)")
    print()

    for ac in agent_calls:
        print(fmt_agent_line(ac, warn_ids))
        for ptc in ptc_by_parent.get(ac["call_id"], []):
            print(fmt_ptc_line(ptc, warn_ids))
        print()

    # Orphan PTC calls
    orphan_ptc = [
        {
            "call_id": call_id,
            "tool_name": tool_name,
            "status": status,
            "created_at": created_at,
            "toolset_id": toolset_id,
            "credits_charged": credits_charged or 0,
            "original_price": original_price or 0,
            "billing_toolset_key": billing_toolset_key,
            "is_non_billable": False,
            "duration": None,
        }
        for (
            call_id,
            tool_name,
            tc_type,
            status,
            created_at,
            updated_at,
            ptc_call_id,
            toolset_id,
            credits_charged,
            original_price,
            billing_toolset_key,
        ) in raw
        if ((tc_type == "ptc") if tc_type else call_id.startswith("ptc:"))
        and ptc_call_id
        and ptc_call_id not in all_agent_ids
    ]
    if orphan_ptc:
        print(f"  [Orphan PTC — parent not found] ({len(orphan_ptc)})")
        for ptc in orphan_ptc:
            print(fmt_ptc_line(ptc, warn_ids))
        print()


# ── Section [3]: CHECKS (includes billing warnings) ───────────────────────────


def print_checks(
    cur,
    r_id,
    r_ver,
    r_uid,
    r_created,
    ptc_enabled,
    agent_calls,
    ptc_by_parent,
    ptc_count,
    warnings,
    full=False,
):
    print("[3] CHECKS")
    print()
    issues = []

    # ── action_results.ptc_enabled ──────────────────────────────────────────────
    print("  action_results:")
    if ptc_enabled is None:
        print("    — ptc_enabled column not present (old schema)")
    elif ptc_enabled:
        print("    ✓ ptc_enabled = true")
    else:
        print("    ⚠ ptc_enabled = false  ← PTC was not active for this run")
        issues.append("ptc_enabled is false")
    print()

    # ── action_messages ─────────────────────────────────────────────────────────
    cur.execute(
        "SELECT COUNT(*) FROM refly.action_messages WHERE result_id = %s AND version = %s",
        (r_id, r_ver),
    )
    msg_count = cur.fetchone()[0]
    print("  action_messages:")
    if msg_count > 0:
        print(f"    ✓ {msg_count} messages recorded")
    else:
        print("    ⚠ no messages found")
        issues.append("no action_messages")
    print()

    # ── user_api_keys (temp sandbox key) ────────────────────────────────────────
    if r_uid:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'refly' AND table_name = 'user_api_keys'
            LIMIT 1
        """)
        print("  user_api_keys:")
        if cur.fetchone():
            cur.execute(
                """
                SELECT expires_at, created_at
                FROM refly.user_api_keys
                WHERE uid = %s
                  AND created_at >= %s::timestamp - interval '1 hour'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (r_uid, r_created),
            )
            key_row = cur.fetchone()
            if key_row:
                expires_at, key_created = key_row
                print(
                    f"    ✓ temp key found  "
                    f"(created: {fmt_time(key_created)}, expires: {fmt_datetime(expires_at)})"
                )
            else:
                print(
                    "    ⚠ no temp API key found near run time  ← sandbox may not have authenticated"
                )
                issues.append("no temp API key found")
        else:
            print("    — user_api_keys table not found")
        print()

    # ── tool_call_results: ptc_call_id linkage ──────────────────────────────────
    all_agent_ids = {ac["call_id"] for ac in agent_calls}
    orphan_count = sum(
        len(children)
        for parent_id, children in ptc_by_parent.items()
        if parent_id not in all_agent_ids
    )
    print("  tool_call_results:")
    if ptc_count == 0:
        print("    — no PTC tool calls recorded")
    elif orphan_count == 0:
        print(
            f"    ✓ ptc_call_id linkage: {ptc_count}/{ptc_count} PTC calls linked to valid parent"
        )
    else:
        linked = ptc_count - orphan_count
        print(
            f"    ⚠ ptc_call_id linkage: {linked}/{ptc_count} linked  ({orphan_count} orphan{'s' if orphan_count > 1 else ''})"
        )
        issues.append(f"{orphan_count} orphan PTC call(s)")
    print()

    # ── credit_usages: tool_call_id foreign key integrity ───────────────────────
    cur.execute(
        """
        SELECT
          COUNT(*)               AS total_billed,
          COUNT(tc.call_id)      AS matched
        FROM refly.credit_usages cu
        LEFT JOIN refly.tool_call_results tc ON cu.tool_call_id = tc.call_id
        WHERE cu.action_result_id = %s AND cu.version = %s AND cu.usage_type = 'tool_call'
        """,
        (r_id, r_ver),
    )
    billed_row = cur.fetchone()
    print("  credit_usages:")
    if billed_row:
        total_billed, matched = billed_row
        if total_billed == 0:
            print("    — no tool_call billing records")
        elif total_billed == matched:
            print(
                f"    ✓ tool_call_id linkage: {matched}/{total_billed} billed calls matched"
            )
        else:
            broken = total_billed - matched
            print(
                f"    ✗ tool_call_id linkage: {matched}/{total_billed} matched  ({broken} broken ref{'s' if broken > 1 else ''})"
            )
            issues.append(f"{broken} broken credit_usage link(s)")
    print()

    # ── billing warnings (unbilled completed calls) ──────────────────────────────
    if warnings:
        print(
            f"  billing warnings:  ({len(warnings)} issue{'s' if len(warnings) != 1 else ''})"
        )
        for w in warnings:
            print(
                f"    ⚠ [{w['toolset']}] {w['tool_name']}  @ {fmt_time(w['created_at'])}"
            )
            if full:
                print(f"      CallID: {w['call_id'][:40]}...")
            print("      Reason: Completed but 0 credits charged")
            print(
                "      Fix:    Ensure tool has isGlobal=true and billing is configured"
            )
        issues.append(f"{len(warnings)} unbilled completed call(s)")
        print()

    # ── Result ──────────────────────────────────────────────────────────────────
    print(DIVIDER)
    if issues:
        print(
            f"  Result: ✗ {len(issues)} issue{'s' if len(issues) > 1 else ''} found: {', '.join(issues)}"
        )
    else:
        print("  Result: ✓ All checks passed")
    print(DIVIDER)
    print()


# ── Main ───────────────────────────────────────────────────────────────────────


def main():
    parser = make_arg_parser("PTC Verify: billing timeline + consolidated checks")
    args = parser.parse_args()

    conn = connect_db()
    cur = conn.cursor()

    r_id, r_ver, _r_type, r_model, r_status, r_title, r_input, r_created = (
        resolve_result(cur, args.id, args.title)
    )
    ptc_enabled = fetch_ptc_enabled(cur, r_id, r_ver)

    print(f"\n{SEPARATOR}")
    print(f" PTC VERIFY: {r_id}")
    print(f"{SEPARATOR}\n")

    print_result_info(
        r_id,
        r_ver,
        r_model,
        r_status,
        r_title,
        r_input,
        r_created,
        args.full,
        ptc_enabled=ptc_enabled,
    )

    cur.execute(
        "SELECT uid FROM refly.action_results WHERE result_id = %s AND version = %s",
        (r_id, r_ver),
    )
    uid_row = cur.fetchone()
    r_uid = uid_row[0] if uid_row else None

    has_type_col, has_ptc_col = check_schema_columns(cur)
    raw = fetch_billing_tool_calls(cur, r_id, r_ver, has_type_col, has_ptc_col)
    agent_calls, ptc_by_parent, agent_count, ptc_count, warnings = (
        organize_billing_calls(raw)
    )

    print_billing_timeline(
        agent_calls, ptc_by_parent, raw, agent_count, ptc_count, warnings
    )
    print_checks(
        cur,
        r_id,
        r_ver,
        r_uid,
        r_created,
        ptc_enabled,
        agent_calls,
        ptc_by_parent,
        ptc_count,
        warnings,
        args.full,
    )

    print(f"{SEPARATOR}\n")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
