---
name: refly-upgrade
description: Upgrade Refly CLI skill files
---

Run:

```bash
refly upgrade
```

This will:
1. Reinstall the latest SKILL.md and reference files
2. Update slash commands (if `~/.claude/commands/` exists)
3. Update skill version in config

Useful when you've updated the CLI package and want to refresh skill files.
