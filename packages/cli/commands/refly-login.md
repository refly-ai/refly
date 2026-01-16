---
name: refly-login
description: Authenticate with Refly
---

Run:

```bash
refly login
```

This will:
1. Prompt for API key (or use REFLY_API_KEY env var)
2. Verify authentication with Refly API
3. Store credentials securely in `~/.refly/config.json`

After successful login, you can use all workflow commands.
