---
name: refly
description: "Base skill for Refly ecosystem: creates, discovers, and runs domain-specific skills bound to workflows. Routes user intent to matching domain skills via symlinks, delegates execution to Refly backend. Use when user asks to: create skills, run workflows, automate multi-step tasks, or manage pipelines. Triggers: refly, skill, workflow, run skill, create skill, automation, pipeline. Requires: @refly/cli installed and authenticated."
---

# Refly

## Rules

1. **CLI only** - Use `refly <command>`, never call API directly.
2. **Trust JSON** - Only trust CLI JSON (`ok`, `payload`, `error`, `hint`).
3. **No fabricated IDs** - Never invent workflow/run/node IDs.
4. **No tokens** - Never print or request auth tokens.
5. **Stop on error** - If `ok=false`, stop and show `hint`.

## Available Commands

**IMPORTANT: Only use the commands listed below. Do NOT invent or guess commands.**

| Command | Description |
|---------|-------------|
| `refly status` | Check authentication and connection status |
| `refly login` | Authenticate with Refly |
| `refly skill list` | List all available skills in the marketplace |
| `refly skill installations` | List your installed skills (get installationId here) |
| `refly skill run --id <installationId> --input '<json>'` | Run an installed skill |
| `refly workflow status <runId> --watch` | Watch workflow execution status |
| `refly workflow detail <runId>` | Get workflow run details and node outputs |
| `refly file list` | List files in your Refly account |
| `refly file download <fileId> -o <path>` | Download a file |

**Commands that do NOT exist** (never use these):
- ~~`refly skill status`~~ - Use `refly status` instead
- ~~`refly skill create`~~ - Skills are created via refly.ai web UI
- ~~`refly run`~~ - Use `refly skill run --id <installationId>` instead

**Tip**: Get `installationId` from `refly skill installations` after installing a skill on refly.ai.

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
