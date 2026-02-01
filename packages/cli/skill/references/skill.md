# Skill Reference

## CLI Commands

### Discovery

```bash
# List skill packages
refly skill list [options]
  --status <status>     # Filter: draft, published, deprecated
  --mine                # Show only my packages
  --tags <tags>         # Filter by tags (comma-separated)
  --page <number>       # Page number (default: 1)
  --page-size <number>  # Page size (default: 20)

# Search public packages
refly skill search <query> [options]
  --tags <tags>         # Filter by tags (comma-separated)
  --page <number>       # Page number (default: 1)
  --page-size <number>  # Page size (default: 20)

# Get skill details
refly skill get <skillId> [options]
  --include-workflows   # Include workflow details
  --share-id <shareId>  # Share ID for private skills
```

### Lifecycle

```bash
# Create skill package (see "Skill Creation Modes" below)
refly skill create [options]
  --name <name>                 # Skill name (required)
  --version <version>           # Semantic version (default: 1.0.0)
  --description <desc>          # Skill description
  --triggers <triggers>         # Trigger phrases (comma-separated)
  --tags <tags>                 # Category tags (comma-separated)
  --workflow <workflowId>       # Bind single workflow
  --workflow-ids <ids>          # Bind multiple workflows (comma-separated)
  --workflow-spec <json>        # Workflow spec JSON
  --workflow-query <query>      # Natural language description
  --verbose                     # Include workflow details in output

# Publishing
refly skill publish <skillId>   # Make public
refly skill unpublish <skillId> # Make private
refly skill delete <skillId> [options]
  --force                       # Skip confirmation

# Local management
refly skill sync [options]      # Sync registry with filesystem
  --dry-run                     # Preview changes only
  --prune                       # Remove orphan entries

refly skill validate [path] [options]
  --fix                         # Attempt to fix issues
```

### Installation

```bash
# Install skill
refly skill install <skillId> [options]
  --version <version>   # Specific version
  --share-id <shareId>  # Share ID for private skills
  --config <json>       # Installation config JSON

# List installations
refly skill installations [options]
  --status <status>     # Filter: downloading, initializing, ready, error, disabled
  --page <number>       # Page number (default: 1)
  --page-size <number>  # Page size (default: 20)

# Uninstall
refly skill uninstall <installationId> [options]
  --force               # Skip confirmation
```

### Execution

```bash
# Run installed skill
refly skill run <installationId> [options]
  --input <json>                # Input JSON for the skill
  --workflow <skillWorkflowId>  # Run specific workflow only
  --async                       # Run asynchronously
```

---

## Skill Creation Modes

### Mode 1: Generate Workflow from Query

```bash
refly skill create --name <name> --workflow-query "<query>"
```

Behavior:
1. Calls backend AI to generate workflow
2. Creates skill and binds workflow
3. Returns skillId + workflowId

Optional metadata (does not generate workflow by itself):
- `--description`, `--triggers`, `--tags`

Example:
```bash
refly skill create \
  --name comfyui-refly-skill \
  --workflow-query "ComfyUI image generation workflow collection" \
  --description "ComfyUI image workflow collection" \
  --triggers "comfyui,text to image,image generation,image to image" \
  --tags "image,comfyui"
```

### Mode 2: Bind Existing Workflow(s)

```bash
refly skill create --name <name> --workflow <workflowId>
```

Bind multiple workflows:
```bash
refly skill create --name <name> --workflow-ids "<workflowId1,workflowId2>"
```

Example:
```bash
refly skill create \
  --name my-skill \
  --description "My custom skill" \
  --workflow c-zybbx65ydi5npo7xevjx1wlr \
  --triggers "custom,workflow" \
  --tags "internal"
```

### Mode 3b: Bind Multiple Workflows (Explicit)

```bash
refly skill create --name <name> --workflow-ids "<workflowId1,workflowId2>"
```

Example:
```bash
refly skill create \
  --name multi-workflow-skill \
  --description "Multiple workflow entry points" \
  --workflow-ids "c-aaa111,c-bbb222" \
  --triggers "multi,entry" \
  --tags "batch,workflow"
```

### Mode 3: Use Workflow Spec (Structured)

```bash
refly skill create --name <name> --workflow-spec '<json>'
```

Example:
```bash
refly skill create \
  --name pdf-processor \
  --workflow-spec '{
    "nodes": [
      {"id": "n1", "type": "start", "data": {"title": "Start"}},
      {"id": "n2", "type": "skillResponse", "data": {"title": "Process PDF", "metadata": {"query": "Extract and summarize PDF content"}}}
    ],
    "edges": [
      {"id": "e1", "source": "n1", "target": "n2"}
    ]
  }'
```

> **Note**: Examples use `start` and `skillResponse`. Additional node types may be supported by backend.

### Mode 4: Local Skill Only (No Cloud Package)

Use when you only want a local skill directory and registry entry.

```bash
# Create local skill files manually, then sync
refly skill sync
```

You can later create a cloud skill package with:
```bash
refly skill create --name <name> --workflow <workflowId>
```

---

## Workflow Generation Logic

When no `--workflow`, `--workflow-ids`, `--workflow-spec`, or `--workflow-query` is specified,
CLI will return `skill.create.needs_workflow` with suggested options and examples.

---

## Directory Structure

```
~/.refly/skills/
├── base/                       # Base skill files (symlink target for 'refly')
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

### How Symlinks Work

- **Base skill**: `~/.claude/skills/refly` → `~/.refly/skills/base/`
- **Domain skills**: `~/.claude/skills/<name>` → `~/.refly/skills/<name>/`

Claude Code discovers skills via symlinks in `~/.claude/skills/`. Each skill is a symlink pointing to the actual skill directory in `~/.refly/skills/`.

---

## Domain Skill Template

Location: `~/.refly/skills/<skill-name>/SKILL.md` (accessed via `~/.claude/skills/<skill-name>/SKILL.md`)

````markdown
---
name: <skill-name>
description: <one-line summary, under 100 chars>
workflowId: <workflow-id>
triggers:
  - <phrase-1>
  - <phrase-2>
tags:
  - <tag-1>
author: <author>
version: 1.0.0
---

# <Skill Name>

## Quick Start

<Minimal code example>

## Run

```bash
refly skill run <installationId> --input '<json>'
```

## Advanced

**Feature A**: See [FEATURE_A.md](FEATURE_A.md)
**API Reference**: See [REFERENCE.md](REFERENCE.md)
````

---

## Best Practices

**Naming**: lowercase, hyphens, max 64 chars (`pdf-processing`, `doc-translator`)

**Description**: verb + what + when, third person, under 100 chars
- Good: "Extracts text from PDF files. Use when processing PDF documents."
- Bad: "I can help you with PDFs"

**Triggers**: 3-6 high-signal phrases, mix EN/ZH if needed

**Structure**: Each skill is a directory with `skill.md` as entry; push details to sibling files

**Workflow Creation**:
1. Be specific in workflow query - helps AI generate accurate workflow
2. Include diverse triggers - cover EN/ZH variations
3. Test before publish - install then run (`refly skill install` -> `refly skill run`)
4. Use `--workflow-spec` for complex scenarios requiring precise control

---

## Local Skills vs Cloud Skills

| Type | Location | Management | Use Case |
|------|----------|------------|----------|
| Local | `~/.refly/skills/<name>/` | Symlinks | Fast iteration |
| Cloud | Backend `SkillPackage` | API | Distribution & versioning |

Integration flow:
1. Create cloud skill -> `refly skill create` (generates workflow + local symlink)
2. Publish skill -> `refly skill publish` -> makes skill discoverable
3. Install to run -> `refly skill install` -> creates local SKILL.md + symlink
4. Run skill -> `refly skill run <installationId>`

---

## Output Examples

### List Output

```json
{
  "ok": true,
  "type": "skill.list",
  "version": "1.0",
  "payload": {
    "skills": [
      {
        "skillId": "skp-xxx",
        "name": "my-skill",
        "version": "1.0.0",
        "description": "Skill description",
        "status": "published",
        "isPublic": true,
        "downloadCount": 10,
        "createdAt": "2026-01-19T00:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

### Installations Output

```json
{
  "ok": true,
  "type": "skill.installations",
  "version": "1.0",
  "payload": {
    "installations": [
      {
        "installationId": "skpi-xxx",
        "skillId": "skp-xxx",
        "skillName": "my-skill",
        "skillVersion": "1.0.0",
        "status": "ready",
        "installedAt": "2026-01-19T00:00:00Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

### Execution Output

```json
{
  "ok": true,
  "type": "skill.run",
  "version": "1.0",
  "payload": {
    "executionId": "skpe-xxx",
    "installationId": "skpi-xxx",
    "status": "completed",
    "workflowExecutions": [
      {
        "skillWorkflowId": "skw-xxx",
        "workflowId": "c-xxx",
        "status": "completed"
      }
    ],
    "result": {},
    "error": null
  }
}
```

---

## Skill Sync Details

`refly skill sync` will:
- Validate existing symlinks in `~/.claude/skills/`
- Check for broken symlinks (pointing to non-existent directories)
- Check for orphan directories (directories without symlinks)
- With `--fix`: recreate broken symlinks
- With `--prune`: remove broken symlinks

---

## Skill Validate Details

`refly skill validate [path]` will:
- Validate frontmatter schema and required fields
- Return per-file errors and warnings
- Provide a summary of valid/invalid files

Example output:
```json
{
  "ok": true,
  "type": "skill.validate",
  "version": "1.0",
  "payload": {
    "path": "/path/to/skills",
    "summary": {
      "total": 3,
      "valid": 2,
      "invalid": 1,
      "warnings": 1
    }
  }
}
```

---

## Error Handling

| Error Code | Cause | Solution |
|------------|-------|----------|
| `VALIDATION_ERROR` | Missing required params or invalid format | Check `--name` and other required params |
| `ACCESS_DENIED` | No permission for resource | Verify login and resource ownership |
| `INTERNAL_ERROR` | Server error | Retry later or contact support |

> **Note**: Invalid JSON in `--workflow-spec` will fail the command; ensure it is valid JSON.
