---
name: refly
description: |
  Base skill for Refly ecosystem: creates, discovers, and runs domain-specific skills bound to workflows.
  Routes user intent to matching domain skills via symlinks in ~/.claude/skills/, delegates execution to Refly backend.
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
refly skill installations
refly skill run <installationId> --input '<json>'
```

Tip: Get `installationId` from `refly skill installations` after installing a skill.

## Directory Structure

```
~/.refly/skills/
├── base/                       # Base skill files (this symlink target)
│   ├── SKILL.md
│   └── rules/
│       ├── workflow.md
│       ├── node.md
│       ├── file.md
│       └── skill.md
└── <skill-name>/               # Domain skill directories
    └── SKILL.md

~/.claude/skills/
├── refly → ~/.refly/skills/base/           # Base skill symlink
└── <skill-name> → ~/.refly/skills/<name>/  # Domain skill symlinks
```

## Routing

User intent -> match domain skill (name/trigger) in `~/.claude/skills/`
-> read domain skill `SKILL.md` -> execute via `refly skill run` -> return CLI-verified result.

## References

- `rules/workflow.md` - Workflow command reference
- `rules/node.md` - Node command reference
- `rules/file.md` - File command reference
- `rules/skill.md` - Customized Skill command reference
