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

| Command | ID Format | Description |
|---------|-----------|-------------|
| `refly status` | - | Check authentication and connection status |
| `refly login` | - | Authenticate with Refly |
| `refly skill list` | - | List all available skills in the marketplace |
| `refly skill installations` | - | List your installed skills (get installationId here) |
| `refly skill run --id <installationId> --input '<json>'` | skpi-xxx | Run an installed skill, returns runId (we-xxx) |
| `refly workflow status <runId> --watch` | we-xxx | Watch workflow execution status |
| `refly workflow detail <runId>` | we-xxx | Get workflow run details |
| `refly workflow toolcalls <runId> --files --latest` | we-xxx | Get files from latest toolcall |
| `refly file download <fileId> -o <path>` | df-xxx | Download a file |

**Tip**: Get `installationId` (skpi-xxx) from `refly skill installations`.

### Command Options

| Command | Option | Description |
|---------|--------|-------------|
| `workflow status` | `--watch` | Poll until workflow completes |
| `workflow status` | `--interval <ms>` | Polling interval in milliseconds (default: 5000) |
| `workflow toolcalls` | `--files` | Return simplified output with only files and content |
| `workflow toolcalls` | `--latest` | With `--files`, return only files from the most recent toolcall |
| `workflow toolcalls` | `--raw` | Disable output sanitization (show full tool outputs) |

**Recommended**: Use `--files --latest` to get files from the final output without processing all toolcalls.

## Skill Categories & Execution Patterns

Choose the execution pattern based on the skill's output type:

| Category | Skills | Output | Pattern |
|----------|--------|--------|---------|
| **File Generation** | image, video, audio skills | Files (png/mp4/mp3) | Run → Wait → Download → Open |
| **Text/Data** | search, research, report skills | Text content | Run → Wait → Extract content |
| **Action** | email, messaging, integration skills | Status confirmation | Run → Wait → Confirm |

---

### Pattern A: File Generation Skills
**Use for**: nano-banana-pro, fal-image, fal-video, fal-audio, seedream-image, kling-video, wan-video

```bash
# Step 1: Run and capture RUN_ID
RESULT=$(refly skill run --id <installationId> --input '<json>')
RUN_ID=$(echo "$RESULT" | jq -r '.payload.workflowExecutions[0].id')

# Step 2: Wait for completion
refly workflow status "$RUN_ID" --watch --interval 30000

# Step 3: Get files and download to Desktop
FILES=$(refly workflow toolcalls "$RUN_ID" --files --latest | jq -r '.payload.files[]')
echo "$FILES" | jq -c '.' | while read -r file; do
  FILE_ID=$(echo "$file" | jq -r '.fileId')
  FILE_NAME=$(echo "$file" | jq -r '.name')
  if [ -n "$FILE_ID" ] && [ "$FILE_ID" != "null" ]; then
    refly file download "$FILE_ID" -o "$HOME/Desktop/${FILE_NAME}"
    open "$HOME/Desktop/${FILE_NAME}"
  fi
done
```

---

### Pattern B: Text/Data Skills
**Use for**: jina, perplexity, weather-report, exa, research skills

```bash
# Step 1: Run and capture RUN_ID
RESULT=$(refly skill run --id <installationId> --input '<json>')
RUN_ID=$(echo "$RESULT" | jq -r '.payload.workflowExecutions[0].id')

# Step 2: Wait for completion
refly workflow status "$RUN_ID" --watch --interval 30000

# Step 3: Extract text content from toolcalls
CONTENT=$(refly workflow toolcalls "$RUN_ID" --files --latest | jq -r '.payload.nodes[].content')
echo "$CONTENT"
```

---

### Pattern C: Action Skills
**Use for**: send-email, slack, microsoft-teams, zoom, calendar, CRM integrations

```bash
# Step 1: Run and capture RUN_ID
RESULT=$(refly skill run --id <installationId> --input '<json>')
RUN_ID=$(echo "$RESULT" | jq -r '.payload.workflowExecutions[0].id')

# Step 2: Wait for completion
refly workflow status "$RUN_ID" --watch --interval 30000

# Step 3: Confirm action status
STATUS=$(refly workflow detail "$RUN_ID" | jq -r '.payload.status')
echo "Action completed with status: $STATUS"
```

---

**ID Types:**
| ID Format | Example | Used For |
|-----------|---------|----------|
| `skpi-xxx` | skpi-h9kpmts9ho1kl9l1sohaloeu | `skill run --id` only |
| `we-xxx` | we-abc123def456 | `workflow status`, `workflow detail`, `workflow toolcalls` |
| `c-xxx` | c-g6emwcpi1wpalsz6j4gyi3d9 | Browser URL only |
| `df-xxx` | df-b3yxyelshtwsbxbrkmcqxmx9 | `file download` |
| `skpe-xxx` | skpe-qga5lpyv59yjzz2ghz2iv9bu | ⚠️ Do NOT use for workflow commands |

**Required behavior:**
- `skill run` returns `RUN_ID` (we-xxx) in `.payload.workflowExecutions[0].id`
- Use `we-xxx` for all workflow commands (`status`, `detail`, `toolcalls`)
- Choose execution pattern (A/B/C) based on skill category
- File skills: Download to `~/Desktop/` and `open` to show user
- Text skills: Extract `.payload.nodes[].content` for text output
- Action skills: Confirm `.payload.status` for completion

## Directory Structure

```
~/.refly/skills/
├── base/                       # Base skill files (this symlink target)
│   ├── SKILL.md
│   └── rules/
│       ├── execution.md
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

- `rules/execution.md` - **Skill execution patterns and error handling**
- `rules/workflow.md` - Workflow command reference
- `rules/node.md` - Node command reference
- `rules/file.md` - File command reference
- `rules/skill.md` - Customized Skill command reference
