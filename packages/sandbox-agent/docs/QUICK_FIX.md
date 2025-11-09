# Quick Fix: Timeout Error 🔧

## Problem
Getting `Request timed out` error with OpenRouter? 

## Solution

### Step 1: Update Your `.env` File

```bash
# Increase timeout to 5 minutes
REQUEST_TIMEOUT=300
```

### Step 2: Restart Your Application

```bash
# Stop the current process (Ctrl+C)
# Then restart
npm start
```

## Why This Works

The timeout was previously too short (180 seconds in config was interpreted as 180ms). Now it's properly set to 5 minutes (300 seconds = 300,000ms).

## Still Having Issues?

### Try a Faster Model

```bash
# Use GPT-3.5 Turbo (fastest)
MODEL=openai/gpt-4o

# Or Claude Haiku (also fast)
MODEL=anthropic/claude-3-haiku
```

### Increase Timeout Further

```bash
# For complex tasks, use 10 minutes
REQUEST_TIMEOUT=600
```

### Enable Debug Mode

```bash
DEBUG=true
```

This will show you detailed logs to help diagnose the issue.

## Recommended Settings for OpenRouter

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
MODEL=openai/gpt-4o
REQUEST_TIMEOUT=300
MAX_RETRY=3
DEBUG=true
```

## Need Help?

- Check the full documentation: [OPENROUTER.md](./OPENROUTER.md)
- Read the bug fix details: [BUGFIX_TIMEOUT.md](./BUGFIX_TIMEOUT.md)
- Report issues on GitHub

---

**TL;DR**: Set `REQUEST_TIMEOUT=300` in your `.env` file and restart. ✅

