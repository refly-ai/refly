# Code Execution Context Persistence Implementation

## Overview

This document describes the implementation of code execution context persistence in the Refly sandbox agent, which allows code to maintain state (variables, functions, imports) across multiple executions within the same session.

## Architecture

The context persistence feature is implemented using the Scalebox SDK's `CodeInterpreter` service, which provides context lifecycle management separate from the `Sandbox` container.

### Key Components

1. **CodeBox** (`packages/sandbox-agent/src/sandbox/codebox-adapter.ts`)
   - Main adapter for Scalebox SDK
   - Manages both `Sandbox` (for file operations) and `CodeInterpreter` (for code execution with context)
   - Automatically creates and manages a default context for the session

2. **CodeInterpreterSession** (`packages/sandbox-agent/src/session.ts`)
   - High-level interface for LangChain-based code interpretation
   - Automatically benefits from context persistence through `CodeBox`
   - No modifications needed - context management is transparent

## Implementation Details

### CodeBox Class

The `CodeBox` class now includes:

```typescript
export class CodeBox {
  private sandbox?: Sandbox;              // For file operations and container management
  private codeInterpreter?: CodeInterpreter;  // For code execution with context
  private _defaultContext?: CodeContext;  // Default context for the session
  
  // ... other properties
}
```

### Context Lifecycle

#### 1. Session Start

When a session starts via `CodeBox.start()`:

```typescript
async start(): Promise<CodeBoxStatus> {
  // 1. Create sandbox container
  this.sandbox = await Sandbox.create('code-interpreter', { ... });
  
  // 2. Create CodeInterpreter instance
  this.codeInterpreter = await CodeInterpreter.create({
    templateId: 'code-interpreter',
    timeout: this.options.timeoutMs || 1800000,
    apiKey: this.options.apiKey || process.env.SCALEBOX_API_KEY || '',
  });
  
  // 3. Create default context for state persistence
  this._defaultContext = await this.codeInterpreter.createCodeContext({
    language: 'python',
    cwd: '/workspace',
  });
  
  return 'running';
}
```

#### 2. Code Execution

When code is executed via `CodeBox.run(code, context?)`:

```typescript
async run(code: string, context?: CodeContext): Promise<CodeBoxOutput> {
  // Use provided context, or default context if available
  const executionContext = context || this._defaultContext;
  
  // If we have CodeInterpreter and a context, use it for execution
  if (this.codeInterpreter && executionContext) {
    result = await this.codeInterpreter.execute({
      language: 'python',
      code,
      contextId: executionContext.id,  // Context ID for state persistence
    });
  } else {
    // Fallback to sandbox.runCode without context
    result = await this.sandbox.runCode(code, { language: 'python' });
  }
  
  // Process and return result
  return { type: 'text', content: result.stdout || '' };
}
```

#### 3. Session Stop

When a session stops via `CodeBox.stop()`:

```typescript
async stop(): Promise<CodeBoxStatus> {
  // 1. Clean up default context if exists
  if (this._defaultContext) {
    await this.destroyContext(this._defaultContext);
    this._defaultContext = undefined;
  }
  
  // 2. Close CodeInterpreter
  if (this.codeInterpreter) {
    await (this.codeInterpreter as any).close?.();
    this.codeInterpreter = undefined;
  }
  
  // 3. Kill sandbox container
  await this.sandbox.kill();
  return 'stopped';
}
```

### Context Management Methods

#### Create Context

```typescript
async createCodeContext(options?: {
  language?: string;
  cwd?: string;
  envVars?: Record<string, string>;
}): Promise<CodeContext | null> {
  if (!this.codeInterpreter) {
    return null;
  }
  
  const context = await this.codeInterpreter.createCodeContext({
    language: (options?.language || 'python') as any,
    cwd: options?.cwd || '/workspace',
  });
  
  return context;
}
```

#### Destroy Context

```typescript
async destroyContext(context: CodeContext | string): Promise<void> {
  if (!this.codeInterpreter) {
    return;
  }
  
  await this.codeInterpreter.destroyContext(context);
}
```

## Usage Example

### Basic Usage (Automatic Context)

```typescript
// Create and start a session
const codebox = new CodeBox({
  apiKey: process.env.SCALEBOX_API_KEY,
  timeoutMs: 1800000,
});

await codebox.start();  // Automatically creates default context

// First execution - define variables
await codebox.run(`
test_var = "Hello from context"
numbers = [1, 2, 3, 4, 5]
counter = 0
print(f"Defined variables: test_var={test_var}, numbers={numbers}")
`);

// Second execution - use previously defined variables
// Variables persist across executions in the same session
await codebox.run(`
print(f"From context: test_var={test_var}")
counter += 10
numbers.append(6)
print(f"Modified: counter={counter}, numbers={numbers}")
`);

// Stop session - automatically cleans up context
await codebox.stop();
```

### Advanced Usage (Multiple Contexts)

```typescript
const codebox = new CodeBox({
  apiKey: process.env.SCALEBOX_API_KEY,
});

await codebox.start();

// Create separate contexts for different tasks
const context1 = await codebox.createCodeContext({
  language: 'python',
  cwd: '/workspace/project1',
});

const context2 = await codebox.createCodeContext({
  language: 'python',
  cwd: '/workspace/project2',
});

// Execute code in context1
await codebox.run('x = 100', context1);

// Execute code in context2
await codebox.run('x = 200', context2);

// Verify contexts are isolated
const result1 = await codebox.run('print(x)', context1);  // Output: 100
const result2 = await codebox.run('print(x)', context2);  // Output: 200

// Clean up specific contexts
await codebox.destroyContext(context1);
await codebox.destroyContext(context2);

await codebox.stop();
```

## Integration with CodeInterpreterSession

`CodeInterpreterSession` automatically benefits from context persistence:

```typescript
const session = new CodeInterpreterSession({
  apiKey: process.env.SCALEBOX_API_KEY,
  verbose: true,
});

await session.start();  // Creates CodeBox with default context

// All code executions in this session share the same context
const response1 = await session.generateResponse('Define a variable x = 42');
const response2 = await session.generateResponse('Print the value of x');  // Will output 42

await session.stop();  // Cleans up context
```

## Benefits

1. **State Persistence**: Variables, functions, and imports are preserved across multiple code executions
2. **Context Isolation**: Multiple contexts can coexist without interfering with each other
3. **Automatic Management**: Default context is automatically created and cleaned up
4. **Backward Compatible**: Existing code continues to work without modifications
5. **Fallback Support**: Gracefully falls back to session-level state if CodeInterpreter is not available

## Technical Notes

### Scalebox SDK Integration

The implementation uses two separate Scalebox SDK components:

1. **`Sandbox`**: Container environment for file operations
   - File read/write
   - Directory operations
   - Container lifecycle

2. **`CodeInterpreter`**: Code execution service with context management
   - Context creation and destruction
   - Code execution within contexts
   - State persistence across executions

### Error Handling

The implementation includes robust error handling:

- If `CodeInterpreter` creation fails, the system falls back to `Sandbox.runCode` (session-level state)
- If context execution fails, it automatically falls back to non-context execution
- All context operations are wrapped in try-catch blocks with appropriate logging

### Compatibility

The implementation is designed to be compatible with different versions of Scalebox SDK:

- Dynamically checks for method availability
- Provides fallback mechanisms
- Logs warnings for unavailable features
- Never fails completely due to missing context support

## Testing

Refer to the test suite in the Scalebox SDK for comprehensive examples:
- Context creation and destruction
- State persistence across executions
- Multiple context isolation
- Error scenarios and edge cases

## Future Enhancements

Potential improvements for future iterations:

1. **Context Pooling**: Reuse contexts for improved performance
2. **Context Persistence**: Save and restore contexts across sessions
3. **Context Sharing**: Share contexts between multiple sessions
4. **Custom Kernels**: Support for different programming languages
5. **Context Metrics**: Track context usage and performance

## Conclusion

The context persistence feature provides a robust foundation for maintaining state across code executions in the Refly sandbox agent. It integrates seamlessly with the existing architecture and provides a transparent upgrade path for existing code.

