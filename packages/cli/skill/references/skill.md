# Skill Reference

## CLI Commands

```bash
# Discovery
refly skill list                    # List all domain skills
refly skill search "<query>"        # Search by keyword
refly skill get <name>              # Get skill details

# Lifecycle
refly skill create --workflow <id> --name <name>   # Create from workflow
refly skill run <name> --input '<json>'            # Run skill
refly skill delete <name>                          # Delete skill
```

---

## Directory Structure

```
~/.claude/skills/refly/
├── SKILL.md                    # Base skill
├── registry.json               # Skill index
├── references/                 # Core CLI docs
│   ├── workflow.md
│   ├── node.md
│   ├── file.md
│   └── skill.md
└── domain-skills/              # Domain skills (one directory per skill)
    └── <skill-name>/
        ├── skill.md            # Entry file
        ├── REFERENCE.md        # API reference (optional)
        └── EXAMPLES.md         # Examples (optional)
```

---

## Registry Schema

```json
{
  "version": 1,
  "updatedAt": "2025-01-14T00:00:00Z",
  "skills": [
    {
      "name": "pdf-processing",
      "description": "Extract text/tables from PDF, fill forms, merge documents.",
      "workflowId": "wf_pdf_processing_v1",
      "triggers": ["pdf extract", "处理 pdf", "fill pdf form"],
      "path": "domain-skills/pdf-processing/",
      "createdAt": "2025-01-14T00:00:00Z",
      "source": "local"
    }
  ]
}
```

---

## Registry Fields

| Field | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Unique skill identifier (lowercase, hyphens) |
| description | string | Yes | One-line summary for matching |
| workflowId | string | Yes | Bound workflow ID in Refly backend |
| triggers | string[] | Yes | Phrases that trigger this skill |
| path | string | Yes | Relative path to skill directory (e.g. `domain-skills/pdf-processing/`) |
| createdAt | string | Yes | ISO 8601 timestamp |
| source | string | Yes | `local` or `refly-cloud` |

---

## Domain Skill Template

Location: `~/.claude/skills/refly/domain-skills/<skill-name>/skill.md`

````markdown
---
name: <skill-name>
description: <one-line summary, under 100 chars>
workflowId: <workflow-id>
triggers:
  - <phrase-1>
  - <phrase-2>
---

# <Skill Name>

## Quick Start

<Minimal code example>

## Run

```bash
refly skill run <skill-name> --input '<json>'
```

## Advanced

**Feature A**: See [FEATURE_A.md](FEATURE_A.md)
**API Reference**: See [REFERENCE.md](REFERENCE.md)
````

---

## Best Practices

**Naming**: lowercase, hyphens, max 64 chars (`pdf-processing`, `doc-translator`)

**Description**: verb + what + when, third person, under 100 chars
- ✓ "Extracts text from PDF files. Use when processing PDF documents."
- ✗ "I can help you with PDFs"

**Triggers**: 3-6 high-signal phrases, mix EN/ZH if needed

**Structure**: Each skill is a directory with `skill.md` as entry; push details to sibling files
