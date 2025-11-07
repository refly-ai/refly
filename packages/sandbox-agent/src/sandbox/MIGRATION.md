# Migration Guide: From codeboxapi to CodeBox Adapter

This guide explains how the new CodeBox adapter improves upon the original codeboxapi integration and how to migrate existing code.

## Why the Change?

### Problems with Direct codeboxapi Usage

1. **External Dependency**: Required installing and maintaining `codeboxapi` package
2. **Limited Control**: Couldn't customize the sandbox behavior easily
3. **No Type Safety**: Limited TypeScript support
4. **Hard to Test**: Difficult to mock for unit tests
5. **Vendor Lock-in**: Tied to specific implementation

### Benefits of CodeBox Adapter

1. **Native Integration**: Built on top of `@scalebox/sdk` which is already in use
2. **Full Control**: Can customize behavior, add middleware, etc.
3. **Type Safety**: Full TypeScript support with proper types
4. **Testable**: Easy to mock or create test implementations
5. **Flexible**: Easy to switch providers or add features

## API Comparison

### Before (codeboxapi)

```typescript
import { CodeBox } from 'codeboxapi';

// Create sandbox
const codebox = new CodeBox();
await codebox.start();

// Run code
const output = await codebox.run('print("Hello")');

// Stop sandbox
await codebox.stop();
```

### After (CodeBox Adapter)

```typescript
import { CodeBox } from './sandbox/codebox-adapter';

// Create sandbox with options
const codebox = new CodeBox({
  requirements: ['numpy', 'pandas'],
  apiKey: process.env.SCALEBOX_API_KEY,
});
await codebox.start();

// Run code (same API)
const output = await codebox.run('print("Hello")');

// Stop sandbox (same API)
await codebox.stop();
```

## Migration Steps

### Step 1: Update Imports

```diff
- import { CodeBox, CodeBoxOutput, CodeBoxStatus } from 'codeboxapi';
+ import { CodeBox, CodeBoxOutput } from './sandbox/codebox-adapter';
```

### Step 2: Update Constructor Calls

```diff
- const codebox = new CodeBox();
+ const codebox = new CodeBox({
+   requirements: settings.CUSTOM_PACKAGES,
+   apiKey: process.env.SCALEBOX_API_KEY,
+ });
```

### Step 3: Update Static Methods

```diff
- const codebox = await CodeBox.fromId(sessionId);
+ const codebox = await CodeBox.fromId(sessionId, {
+   apiKey: process.env.SCALEBOX_API_KEY,
+ });
```

### Step 4: No Changes Needed for These Methods

The following methods work exactly the same:
- `codebox.start()`
- `codebox.run(code)`
- `codebox.stop()`
- `codebox.status()`
- `codebox.upload(filename, content)`
- `codebox.download(filename)`
- `codebox.install(packageName)`
- `codebox.isRunning()`

## Feature Comparison

| Feature | codeboxapi | CodeBox Adapter |
|---------|-----------|-----------------|
| Basic code execution | ✅ | ✅ |
| File upload/download | ✅ | ✅ |
| Package installation | ✅ | ✅ |
| Session resumption | ✅ | ✅ |
| Image output | ✅ | ✅ |
| Error handling | ✅ | ✅ Enhanced |
| Auto-install missing packages | ❌ | ✅ |
| TypeScript types | Partial | ✅ Full |
| Custom configuration | Limited | ✅ Extensive |
| Environment variables | ❌ | ✅ |
| Custom timeout | ❌ | ✅ |
| Metadata support | ❌ | ✅ |

## Enhanced Features

### 1. Automatic Package Installation

The adapter automatically detects `ModuleNotFoundError` and installs missing packages:

```typescript
const result = await codebox.run('import requests');
// If requests is not installed, it will be installed automatically
```

### 2. Better Error Handling

Errors are returned as CodeBoxOutput instead of throwing exceptions:

```typescript
const result = await codebox.run('invalid python code');
if (result.type === 'error') {
  console.log('Error:', result.content);
}
```

### 3. Configuration Options

```typescript
const codebox = new CodeBox({
  requirements: ['numpy', 'pandas'],
  timeoutMs: 1800000, // 30 minutes
  envs: {
    'API_KEY': 'secret',
  },
  metadata: {
    'user': 'john@example.com',
    'project': 'data-analysis',
  },
  apiKey: process.env.SCALEBOX_API_KEY,
});
```

### 4. Multiple Result Types

The adapter handles different output types:

```typescript
const result = await codebox.run(`
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.savefig('plot.png')
`);

if (result.type === 'image/png') {
  // Handle PNG image (base64)
  console.log('Image generated:', result.content);
} else if (result.type === 'text') {
  // Handle text output
  console.log('Output:', result.content);
} else if (result.type === 'error') {
  // Handle error
  console.error('Error:', result.content);
}
```

## Implementation Details

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                 CodeInterpreterSession               │
│                   (session.ts)                       │
└─────────────────────────────────────────────────────┘
                          │
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────┐
│                    CodeBox Adapter                   │
│              (sandbox/codebox-adapter.ts)            │
│                                                       │
│  • Simplified API                                    │
│  • Error handling                                    │
│  • Output type detection                             │
│  • Auto package installation                         │
└─────────────────────────────────────────────────────┘
                          │
                          │ wraps
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Scalebox SDK                        │
│                (@scalebox/sdk)                       │
│                                                       │
│  • Sandbox.create()                                  │
│  • sandbox.runCode()                                 │
│  • sandbox.files.*                                   │
│  • sandbox.commands.*                                │
└─────────────────────────────────────────────────────┘
```

### Code Flow

1. **Session creates CodeBox** with requirements and options
2. **CodeBox.start()** creates a Scalebox sandbox
3. **CodeBox.run()** executes code via `sandbox.runCode()`
4. **Result processing** converts ExecutionResult to CodeBoxOutput
5. **Type detection** identifies text/image/error outputs
6. **Error handling** catches and formats errors appropriately

## Testing Strategy

### Unit Tests

```typescript
import { CodeBox } from './sandbox/codebox-adapter';
import { Sandbox } from '@scalebox/sdk';

jest.mock('@scalebox/sdk');

describe('CodeBox', () => {
  it('should execute code successfully', async () => {
    // Mock Sandbox
    const mockSandbox = {
      runCode: jest.fn().mockResolvedValue({
        stdout: 'Hello, World!',
        stderr: '',
        error: null,
      }),
    };
    
    (Sandbox.create as jest.Mock).mockResolvedValue(mockSandbox);
    
    const codebox = new CodeBox();
    await codebox.start();
    
    const result = await codebox.run('print("Hello, World!")');
    
    expect(result.type).toBe('text');
    expect(result.content).toBe('Hello, World!');
  });
});
```

### Integration Tests

```typescript
describe('CodeBox Integration', () => {
  it('should execute real code', async () => {
    const codebox = new CodeBox({
      apiKey: process.env.SCALEBOX_API_KEY,
    });
    
    await codebox.start();
    
    const result = await codebox.run(`
import sys
print(f"Python version: {sys.version}")
    `);
    
    expect(result.type).toBe('text');
    expect(result.content).toContain('Python version');
    
    await codebox.stop();
  }, 30000);
});
```

## Performance Considerations

### Connection Pooling

Future enhancement: Reuse sandbox instances

```typescript
class CodeBoxPool {
  private pool: CodeBox[] = [];
  
  async acquire(): Promise<CodeBox> {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    const codebox = new CodeBox();
    await codebox.start();
    return codebox;
  }
  
  async release(codebox: CodeBox): Promise<void> {
    this.pool.push(codebox);
  }
}
```

### Caching

Future enhancement: Cache execution results

```typescript
class CachedCodeBox extends CodeBox {
  private cache = new Map<string, CodeBoxOutput>();
  
  async run(code: string): Promise<CodeBoxOutput> {
    const cacheKey = this.hashCode(code);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const result = await super.run(code);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

## Troubleshooting

### Issue: "Sandbox not initialized"

**Solution**: Make sure to call `start()` before executing code:

```typescript
const codebox = new CodeBox();
await codebox.start(); // Required!
await codebox.run('print("Hello")');
```

### Issue: "Module not found"

**Solution**: The adapter should auto-install, but you can pre-install:

```typescript
const codebox = new CodeBox({
  requirements: ['missing-package'],
});
await codebox.start();
```

### Issue: "Session timeout"

**Solution**: Increase timeout or implement keep-alive:

```typescript
const codebox = new CodeBox({
  timeoutMs: 3600000, // 1 hour
});
```

### Issue: "API key not found"

**Solution**: Set the environment variable or pass it explicitly:

```typescript
const codebox = new CodeBox({
  apiKey: process.env.SCALEBOX_API_KEY || 'your-api-key',
});
```

## Best Practices

### 1. Always Clean Up

```typescript
try {
  const codebox = new CodeBox();
  await codebox.start();
  // ... use codebox
} finally {
  await codebox.stop();
}
```

### 2. Use Try-Catch for Critical Operations

```typescript
try {
  const result = await codebox.run(userCode);
  if (result.type === 'error') {
    // Handle error gracefully
  }
} catch (error) {
  // Handle exception
}
```

### 3. Pre-install Common Packages

```typescript
const codebox = new CodeBox({
  requirements: [
    'numpy',
    'pandas',
    'matplotlib',
    'scikit-learn',
  ],
});
```

### 4. Set Reasonable Timeouts

```typescript
const codebox = new CodeBox({
  timeoutMs: 1800000, // 30 minutes
});
```

### 5. Use Session IDs for Long-Running Tasks

```typescript
const codebox = new CodeBox();
await codebox.start();

// Save session ID for later
const sessionId = codebox.sessionId;
localStorage.setItem('sessionId', sessionId);

// Later, reconnect
const reconnected = await CodeBox.fromId(sessionId);
```

## Summary

The CodeBox adapter provides a clean, type-safe, and flexible interface for code execution while maintaining compatibility with the original codeboxapi. The migration is straightforward and brings numerous benefits including better error handling, auto-installation of packages, and enhanced configurability.

