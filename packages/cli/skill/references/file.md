# File Reference

## File Commands

```bash
# List files
refly file list [options]
  --page <n>           # Page number (default: 1)
  --page-size <n>      # Files per page (default: 20)
  --canvas-id <id>     # Filter by canvas ID
  --result-id <id>     # Filter by action result ID
  --include-content    # Include file content in response

# Get file details
refly file get <fileId> [options]
  --no-content         # Exclude file content

# Download file
refly file download <fileId> [options]
  -o, --output <path>  # Output path (defaults to original filename)

# Upload file(s)
refly file upload <path> [options]
  --canvas-id <id>     # Canvas ID (required)
  --filter <ext>       # Filter by extensions (e.g., pdf,docx,png)
```

## Interaction

- File IDs typically come from action results (`node.md`) or workflow outputs (`workflow.md`).
- Use file commands to retrieve content produced by workflow runs.
- Use `--result-id` or `--canvas-id` to narrow file listings to a specific run context.
