# Bug Fix: Request Timeout Error with OpenRouter

## Issue

Users were experiencing `Request timed out` errors when using OpenRouter:

```
Error [TimeoutError]: Request timed out.
    at wrapOpenAIClientError (/Users/.../openai/dist/utils/openai.cjs:13:17)
    ...
    attemptNumber: 4,
    retriesLeft: 0
```

## Root Cause

The `REQUEST_TIMEOUT` configuration was set in **seconds** (180 seconds = 3 minutes), but the LangChain `ChatOpenAI` class expects the timeout parameter in **milliseconds**.

### The Problem

```typescript
// BEFORE (Incorrect)
return new ChatOpenAI({
  timeout: settings.REQUEST_TIMEOUT, // 180 (interpreted as 180ms = 0.18 seconds!)
  // ... other config
});
```

With `REQUEST_TIMEOUT = 180` (seconds in config), the actual timeout was only **180 milliseconds** (0.18 seconds), causing requests to time out immediately.

## Solution

### 1. Fixed Timeout Conversion

Convert seconds to milliseconds when initializing the LLM:

```typescript
// AFTER (Correct)
return new ChatOpenAI({
  timeout: settings.REQUEST_TIMEOUT * 1000, // Convert seconds to milliseconds
  // ... other config
});
```

### 2. Increased Default Timeout

Changed the default timeout from 3 minutes to 5 minutes:

```typescript
// config.ts
REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || String(5 * 60)), // 5 minutes
```

Reason: OpenRouter may have slightly higher latency due to the gateway layer, and some models (like Claude) need more time for complex reasoning tasks.

### 3. Added Documentation

Updated all documentation to clarify:
- Timeout is specified in **seconds** in the config
- Automatically converted to **milliseconds** internally
- Recommended value: 300 seconds (5 minutes) for OpenRouter

## Files Changed

### 1. `session.ts`

**OpenRouter Configuration:**
```typescript
if (settings.OPENROUTER_API_KEY) {
  this.log('Using OpenRouter');
  return new ChatOpenAI({
    modelName: settings.MODEL,
    openAIApiKey: settings.OPENROUTER_API_KEY,
    temperature: settings.TEMPERATURE,
    maxRetries: settings.MAX_RETRY,
    timeout: settings.REQUEST_TIMEOUT * 1000, // ✅ Convert seconds to milliseconds
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/workflow-agents/code-interpreter',
        'X-Title': 'Code Interpreter Agent',
      },
    },
  });
}
```

**Also Fixed:**
- Azure OpenAI timeout conversion
- Direct OpenAI timeout conversion

### 2. `config.ts`

```typescript
export interface CodeInterpreterAPISettings {
  // ...
  REQUEST_TIMEOUT: number; // ✅ Added comment: Timeout in seconds
  // ...
}

export const settings: CodeInterpreterAPISettings = {
  // ...
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || String(5 * 60)), // ✅ 5 minutes default
  // ...
};
```

### 3. `env.example`

```bash
REQUEST_TIMEOUT=300  # ✅ Timeout in seconds (5 minutes recommended for OpenRouter)
```

### 4. `OPENROUTER.md`

Added troubleshooting section:

```markdown
## Troubleshooting

### Request Timeout Error

If you encounter timeout errors:

**Solution 1: Increase Timeout**
\`\`\`bash
# Set timeout to 5 minutes (300 seconds) or more
REQUEST_TIMEOUT=300
\`\`\`

**Solution 2: Use Faster Models**
Some models respond faster than others. Try:
- `openai/gpt-3.5-turbo` (fastest)
- `anthropic/claude-3-haiku` (fast)
- `google/gemini-pro` (fast)

**Note**: The timeout is automatically converted from seconds to milliseconds internally.
```

## Impact

### Before Fix
- ❌ Requests timing out after ~180ms
- ❌ All OpenRouter requests failing
- ❌ Users unable to use the service
- ❌ Multiple retry attempts all failing

### After Fix
- ✅ Requests have 5 minutes to complete
- ✅ OpenRouter requests succeed
- ✅ Users can complete complex code generation tasks
- ✅ Retry logic can properly handle transient issues

## Testing

To verify the fix:

```bash
# Set up environment
export OPENROUTER_API_KEY=sk-or-v1-your-key
export MODEL=openai/gpt-3.5-turbo
export REQUEST_TIMEOUT=300
export DEBUG=true

# Run test
node example-openrouter.js
```

Expected: Requests complete successfully without timeout errors.

## Performance Considerations

### Timeout Recommendations by Model

| Model | Recommended Timeout | Typical Response Time |
|-------|--------------------|-----------------------|
| GPT-3.5 Turbo | 60-120s | 2-10s |
| GPT-4 | 120-300s | 10-30s |
| Claude 3 Opus | 180-300s | 15-45s |
| Claude 3 Sonnet | 120-180s | 8-20s |
| Gemini Pro | 60-120s | 3-15s |

### Why 5 Minutes?

1. **Complex Tasks**: Code generation and analysis can be computationally intensive
2. **Gateway Overhead**: OpenRouter adds slight latency (50-200ms)
3. **Model Variability**: Different models have different response times
4. **Safety Margin**: Accounts for network issues and high-load periods
5. **Better UX**: Users prefer waiting longer than seeing premature failures

## Related Issues

This fix also resolves:
- Azure OpenAI timeout issues (same root cause)
- Direct OpenAI timeout issues (same root cause)

## Backward Compatibility

✅ **Fully Backward Compatible**

If users have set `REQUEST_TIMEOUT=180` in their environment:
- **Before**: Interpreted as 180ms (broken)
- **After**: Interpreted as 180 seconds = 3 minutes (correct)

The fix makes the behavior match user expectations.

## Best Practices

### For Users

1. **Set Appropriate Timeouts**:
   ```bash
   # For production
   REQUEST_TIMEOUT=300  # 5 minutes
   
   # For development/testing
   REQUEST_TIMEOUT=120  # 2 minutes
   ```

2. **Monitor Timeouts**:
   - Enable verbose mode: `DEBUG=true`
   - Check logs for timeout patterns
   - Adjust based on your model and use case

3. **Choose Fast Models**:
   - Use GPT-3.5 for quick iterations
   - Reserve GPT-4/Claude for complex tasks

### For Developers

1. **Always Convert Units**:
   ```typescript
   // Good
   timeout: configValue * 1000  // seconds -> milliseconds
   
   // Bad
   timeout: configValue  // ambiguous unit
   ```

2. **Document Units Clearly**:
   ```typescript
   // Good
   REQUEST_TIMEOUT: number; // Timeout in seconds
   
   // Bad  
   REQUEST_TIMEOUT: number;
   ```

3. **Use Reasonable Defaults**:
   - Consider the slowest common use case
   - Better to timeout late than early
   - Allow users to override

## Conclusion

This bug fix resolves the critical timeout issue by:
1. Properly converting seconds to milliseconds
2. Increasing default timeout to 5 minutes
3. Adding clear documentation
4. Maintaining backward compatibility

The fix ensures OpenRouter (and all other providers) work correctly with appropriate timeout values.

## Version

- **Date**: 2025-11-07
- **Type**: Bug Fix (Critical)
- **Severity**: High (Service Breaking)
- **Status**: ✅ Fixed

