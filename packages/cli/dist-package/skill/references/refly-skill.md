# Skill Reference

## Authentication

```bash
refly init
refly login
refly logout
refly status
refly whoami
```

## File Reference

See `references/file.md` for file commands and API details.

## Skill CLI Command Scope (Todo)

### Goal

Implement `refly skill` command family to support domain skill lifecycle and routing.

### Required Commands

- `refly skill list`
- `refly skill search <query>`
- `refly skill get <name>`
- `refly skill create --workflow <id> --name <skill>`
- `refly skill register --name <skill>`
- `refly skill run <name> --input '<json>'`
- `refly skill delete <name>`

### Supporting Capabilities

- Local registry: `~/.claude/skills/refly/registry.json`
- Registry schema versioning and migration
- Skill validation for `SKILL.md` + domain skill markdown
- Fuzzy matching (name / triggers / description)

### Integration Notes

- Base skill routes to domain skills using the registry.
- Execution must call CLI only; never invoke backend directly.
- Keep `SKILL.md` as the canonical definition file.

## Domain Skill Storage

Location:

```
~/.claude/skills/refly/references/<skill-name>.md
```

Registry:

```
~/.claude/skills/refly/registry.json
```

The registry is the primary routing source. The domain skill markdown files
are the canonical entries that bind workflow IDs.

## Domain Skill Frontmatter

```yaml
---
name: <skill-name>
workflowId: <workflow-id>
description: <one-line summary>
triggers:
  - <trigger-phrase-1>
  - <trigger-phrase-2>
---
```

## Domain Skill Template

```markdown
---
name: <skill-name>
workflowId: <workflow-id>
description: <one-line summary>
triggers:
  - <trigger-phrase-1>
  - <trigger-phrase-2>
---

## Purpose

<2-3 sentences describing what this skill does and the expected output.>

## Inputs

- <input-name>: <type> - <description>

## Outputs

- <output-name>: <type> - <description>

## Run

```bash
refly skill run <skill-name> --input '<json>'
```
```

## Error Codes (Common)

| Code | Description | Hint |
|------|-------------|------|
| AUTH_REQUIRED | Not authenticated | refly login |
| CLI_NOT_FOUND | CLI not installed | npm i -g @refly/cli |
| NETWORK_ERROR | API unreachable | Check connection |
| NOT_FOUND | Resource not found | Verify ID |
| CONFLICT | State conflict | Check status |
| INTERNAL_ERROR | Unexpected error | Report issue |

## Backend API (File)

See `references/file.md`.
