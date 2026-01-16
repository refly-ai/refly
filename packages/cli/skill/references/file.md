# File Reference

## File Commands

```bash
refly file list
refly file list --canvas-id <id>
refly file get <fileId>
refly file download <fileId> -o ./output.txt
```

## Interaction

- File IDs typically come from action results (`node.md`) or workflow outputs (`workflow.md`).
- Use file commands to retrieve content produced by workflow runs.

## Backend API (File)

- GET /v1/cli/file list files
- GET /v1/cli/file/:id get file
