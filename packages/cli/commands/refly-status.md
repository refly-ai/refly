---
name: refly-status
description: Check Refly CLI configuration and authentication status
---

Run:

```bash
refly status
```

Parse JSON and summarize:
- CLI version
- Current user
- API endpoint
- Auth status + expiry
- Skill installation status

If not authenticated, suggest running `refly login`.
