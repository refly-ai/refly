# Skill Execution Reference

## Quick Reference

| Command | Purpose |
|---------|---------|
| `refly skill run --id <skpi-xxx> --input '<json>'` | Run skill, returns RUN_ID |
| `refly workflow status <we-xxx> --watch --interval 30000` | Wait for completion |
| `refly workflow detail <we-xxx>` | Get execution details and status |
| `refly workflow toolcalls <we-xxx> --files --latest` | Get files and text content |
| `refly file download <df-xxx> -o <path>` | Download file to local path |

## ID Formats

| Format | Example | Used For |
|--------|---------|----------|
| `skpi-xxx` | skpi-h9kpmts9ho1kl9l1sohaloeu | `skill run --id` only |
| `we-xxx` | we-abc123def456 | `workflow status`, `workflow detail`, `workflow toolcalls` |
| `c-xxx` | c-g6emwcpi1wpalsz6j4gyi3d9 | Browser URL only (https://refly.ai/workflow/c-xxx) |
| `df-xxx` | df-b3yxyelshtwsbxbrkmcqxmx9 | `file download` |
| `skpe-xxx` | skpe-qga5lpyv59yjzz2ghz2iv9bu | **Do NOT use** for workflow commands |

---

## Standard Execution Flow

### Step 1: Run Skill and Get Run ID

```bash
RESULT=$(refly skill run --id <installationId> --input '{
  "key": "value"
}')

# Check if command succeeded
if [ "$(echo "$RESULT" | jq -r '.ok')" != "true" ]; then
  echo "Error: $(echo "$RESULT" | jq -r '.error.message')"
  echo "Hint: $(echo "$RESULT" | jq -r '.hint // empty')"
  exit 1
fi

RUN_ID=$(echo "$RESULT" | jq -r '.payload.workflowExecutions[0].id')
echo "Run ID: $RUN_ID"
```

**Important**: Run ID is in `.payload.workflowExecutions[0].id` (we-xxx format)

### Step 2: Open Workflow in Browser and Wait for Completion

```bash
# Open workflow in browser (optional, for monitoring)
open "https://refly.ai/workflow/<workflowId>"

# Poll every 30 seconds until workflow finishes
refly workflow status "$RUN_ID" --watch --interval 30000
```

### Step 3: Get Results (Choose Based on Skill Category)

Choose the pattern based on the skill's `category` field in SKILL.md:
- `category: file-generation` → Pattern A
- `category: text-data` → Pattern B
- `category: action` → Pattern C

---

## Pattern A: File Generation Skills

**Use for**: Skills with `category: file-generation` (image, video, audio skills)

```bash
# Get files from the latest toolcall
TOOLCALL_RESULT=$(refly workflow toolcalls "$RUN_ID" --files --latest)

# Check if files exist
FILES=$(echo "$TOOLCALL_RESULT" | jq -r '.payload.files // empty')
if [ -z "$FILES" ] || [ "$FILES" = "null" ]; then
  echo "No files generated. Check workflow status:"
  refly workflow detail "$RUN_ID"
  exit 1
fi

# Download and open each file
echo "$FILES" | jq -c '.[]' | while read -r file; do
  FILE_ID=$(echo "$file" | jq -r '.fileId')
  FILE_NAME=$(echo "$file" | jq -r '.name')
  if [ -n "$FILE_ID" ] && [ "$FILE_ID" != "null" ]; then
    refly file download "$FILE_ID" -o "$HOME/Desktop/${FILE_NAME}"
    echo "Downloaded: $HOME/Desktop/${FILE_NAME}"
    open "$HOME/Desktop/${FILE_NAME}"
  fi
done
```

**Expected Output**: Files downloaded to `~/Desktop/` and opened automatically

---

## Pattern B: Text/Data Skills

**Use for**: Skills with `category: text-data` (search, research, report, analytics skills)

```bash
# Get text content from toolcalls
TOOLCALL_RESULT=$(refly workflow toolcalls "$RUN_ID" --files --latest)

# Extract content from nodes
CONTENT=$(echo "$TOOLCALL_RESULT" | jq -r '.payload.nodes[].content // empty')
if [ -z "$CONTENT" ]; then
  echo "No content returned. Check workflow status:"
  refly workflow detail "$RUN_ID"
  exit 1
fi

echo "$CONTENT"
```

**Expected Output**: Text content displayed to user

---

## Pattern C: Action Skills

**Use for**: Skills with `category: action` (email, messaging, CRM integration skills)

```bash
# Confirm action completed
DETAIL=$(refly workflow detail "$RUN_ID")
STATUS=$(echo "$DETAIL" | jq -r '.payload.status')

if [ "$STATUS" = "finish" ]; then
  echo "Action completed successfully"
else
  echo "Action status: $STATUS"
  echo "$DETAIL" | jq '.payload'
fi
```

**Expected Output**: Status confirmation (finish = success)

---

## Workflow Status Values

| Status | Description | Action |
|--------|-------------|--------|
| `init` | Workflow is initializing | Wait |
| `executing` | Workflow is running | Wait |
| `finish` | Workflow completed successfully | Get results |
| `failed` | Workflow encountered an error | Check error details |

---

## Error Handling

### Check CLI Response
```bash
RESULT=$(refly skill run --id <installationId> --input '<json>')
if [ "$(echo "$RESULT" | jq -r '.ok')" != "true" ]; then
  echo "Error: $(echo "$RESULT" | jq -r '.error.message')"
  echo "Hint: $(echo "$RESULT" | jq -r '.hint // empty')"
fi
```

### Check Workflow Failed
```bash
DETAIL=$(refly workflow detail "$RUN_ID")
STATUS=$(echo "$DETAIL" | jq -r '.payload.status')
if [ "$STATUS" = "failed" ]; then
  echo "Workflow failed. Details:"
  echo "$DETAIL" | jq '.payload.nodes[] | select(.status == "failed")'
fi
```

### No Files or Content Returned
```bash
# Get verbose output to debug
refly workflow toolcalls "$RUN_ID" --raw
```

---

## Troubleshooting

### Get Full Workflow Details
```bash
refly workflow detail "$RUN_ID"
```

### Get All Toolcalls (Verbose)
```bash
refly workflow toolcalls "$RUN_ID" --raw
```

### Filter Toolcalls by Status
```bash
refly workflow toolcalls "$RUN_ID" --status completed
refly workflow toolcalls "$RUN_ID" --status failed
```

### Check Authentication
```bash
refly status
```

### List Installed Skills
```bash
refly skill installations
```

---

## Required Behavior

1. **CLI only** - Use `refly <command>`, never call API directly
2. **Trust JSON** - Only trust CLI JSON (`ok`, `payload`, `error`, `hint`)
3. **No fabricated IDs** - Never invent workflow/run/node IDs
4. **Stop on error** - If `ok=false`, stop and show `hint`
5. **Use correct IDs** - `skpi-xxx` for run, `we-xxx` for workflow commands
