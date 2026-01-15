---
name: refly
description: |
  Base skill for Refly ecosystem: creates, discovers, and runs domain-specific skills bound to workflows.
  Routes user intent to matching domain skills via local registry, delegates execution to Refly backend.
  Use when user asks to: create skills, run workflows, automate multi-step tasks, or manage pipelines.
  Triggers: refly, skill, workflow, run skill, create skill, automation, pipeline.
  Requires: @refly/cli installed and authenticated.
---

# Refly

## Rules

1. **CLI only** - Use `refly <command>`, never call API directly.
2. **Trust JSON** - Only trust CLI JSON (`ok`, `payload`, `error`, `hint`).
3. **No fabricated IDs** - Never invent workflow/run/node IDs.
4. **No tokens** - Never print or request auth tokens.
5. **Stop on error** - If `ok=false`, stop and show `hint`.

## Quick Commands

```bash
refly status
refly login
refly skill list
refly skill run <name> --input '<json>'
```

## Directory Structure

```
~/.claude/skills/refly/
├── SKILL.md                    # Base skill (this file)
├── registry.json               # Routing registry
├── references/                 # Core CLI docs
│   ├── workflow.md
│   ├── node.md
│   ├── file.md
│   └── skill.md
└── domain-skills/              # Domain skills (one directory per skill)
    └── <skill-name>/
        ├── skill.md            # Entry file
        └── ...                 # Additional docs
```

## Routing

User intent → match domain skill (name/trigger/description) → read domain skill `.md`
→ execute via `refly skill run` → return CLI-verified result.

## References

- `references/workflow.md`
- `references/node.md`
- `references/file.md`
- `references/skill.md`
