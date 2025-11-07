# Sandbox Architecture

## Overview

This document describes the architecture of the sandbox integration, explaining how different components interact and why the design was chosen.

## Component Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         Application Layer                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            CodeInterpreterSession                         │  │
│  │              (session.ts)                                 │  │
│  │                                                            │  │
│  │  - Agent execution                                        │  │
│  │  - Memory management                                      │  │
│  │  - File tracking                                          │  │
│  │  - Response formatting                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ uses                                │
│                            ▼                                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                       Adapter Layer                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 CodeBox Adapter                           │  │
│  │           (sandbox/codebox-adapter.ts)                    │  │
│  │                                                            │  │
│  │  Responsibilities:                                        │  │
│  │  - Simplify Scalebox SDK API                             │  │
│  │  - Convert ExecutionResult → CodeBoxOutput              │  │
│  │  - Handle errors gracefully                               │  │
│  │  - Auto-install missing packages                          │  │
│  │  - Manage session lifecycle                               │  │
│  │  - Detect output types (text/image/error)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ wraps                               │
│                            ▼                                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                        SDK Layer                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Scalebox SDK                            │  │
│  │                 (@scalebox/sdk)                           │  │
│  │                                                            │  │
│  │  Features:                                                │  │
│  │  - Sandbox.create()                                       │  │
│  │  - Sandbox.connect()                                      │  │
│  │  - sandbox.runCode()                                      │  │
│  │  - sandbox.files.*                                        │  │
│  │  - sandbox.commands.*                                     │  │
│  │  - sandbox.pty.*                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ HTTP/gRPC                           │
│                            ▼                                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                      Infrastructure                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Scalebox Service                          │  │
│  │                                                            │  │
│  │  - Container orchestration                                │  │
│  │  - Code execution                                         │  │
│  │  - File system                                            │  │
│  │  - Network isolation                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Code Execution Flow

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 1. CodeInterpreterSession.generateResponse()        │
│    - Receives user message                           │
│    - Processes file uploads                          │
│    - Invokes agent executor                          │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 2. AgentExecutor (LangChain)                        │
│    - Determines which tool to use                    │
│    - Calls pythonTool.func()                         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 3. runHandler()                                      │
│    - Receives code from agent                        │
│    - Calls codebox.run(code)                         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 4. CodeBox.run()                                     │
│    - Validates sandbox is initialized                │
│    - Calls sandbox.runCode() with Python language    │
│    - Processes ExecutionResult                       │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 5. Scalebox SDK                                      │
│    - Sends gRPC/HTTP request                         │
│    - Executes code in sandbox                        │
│    - Returns ExecutionResult                         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 6. Result Processing                                 │
│    - Check for errors                                │
│    - Detect output type                              │
│    - Create CodeBoxOutput                            │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 7. Post-processing (runHandler)                      │
│    - Check for ModuleNotFoundError                   │
│    - Auto-install missing packages if needed         │
│    - Check for file modifications                    │
│    - Download modified files                         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 8. Response Formatting (outputHandler)               │
│    - Remove image markdown                           │
│    - Remove download links                           │
│    - Create CodeInterpreterResponse                  │
└─────────────────────────────────────────────────────┘
    │
    ▼
User Response
```

## Type Flow

### ExecutionResult → CodeBoxOutput Conversion

```typescript
// Input: ExecutionResult from Scalebox SDK
{
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: ExecutionError;
  png?: string;
  results?: Result[];
  // ... many other fields
}

         │ CodeBox.run()
         │ processes
         ▼

// Output: CodeBoxOutput (simplified)
{
  type: 'text' | 'image/png' | 'error';
  content: string;
}
```

### Conversion Logic

```typescript
async run(code: string): Promise<CodeBoxOutput> {
  const result: ExecutionResult = await this.sandbox.runCode(code);

  // 1. Check for errors first
  if (result.error) {
    return {
      type: 'error',
      content: result.error.traceback || result.error.message || result.stderr,
    };
  }

  // 2. Check for PNG output
  if (result.png) {
    return {
      type: 'image/png',
      content: result.png, // Base64 encoded
    };
  }

  // 3. Check multiple results for PNG
  if (result.results && result.results.length > 0) {
    const pngResult = result.results.find(r => r.png);
    if (pngResult && pngResult.png) {
      return {
        type: 'image/png',
        content: pngResult.png,
      };
    }
  }

  // 4. Default to text output
  return {
    type: 'text',
    content: result.stdout || result.text || '',
  };
}
```

## Sequence Diagrams

### Sandbox Initialization

```
User            Session         CodeBox         Scalebox SDK      Service
 │                │                │                  │              │
 │  start()       │                │                  │              │
 │───────────────>│                │                  │              │
 │                │  new CodeBox   │                  │              │
 │                │───────────────>│                  │              │
 │                │                │                  │              │
 │                │  start()       │                  │              │
 │                │───────────────>│                  │              │
 │                │                │  Sandbox.create()│              │
 │                │                │─────────────────>│              │
 │                │                │                  │  POST /api   │
 │                │                │                  │─────────────>│
 │                │                │                  │              │
 │                │                │                  │  sandbox ID  │
 │                │                │                  │<─────────────│
 │                │                │  sandbox object  │              │
 │                │                │<─────────────────│              │
 │                │                │                  │              │
 │                │                │  install pkgs    │              │
 │                │                │─────────────────>│              │
 │                │                │                  │              │
 │                │  'running'     │                  │              │
 │                │<───────────────│                  │              │
 │  SessionStatus │                │                  │              │
 │<───────────────│                │                  │              │
```

### Code Execution

```
Agent          runHandler      CodeBox       Scalebox SDK     Service
 │                │               │                │             │
 │  execute       │               │                │             │
 │───────────────>│               │                │             │
 │                │  run(code)    │                │             │
 │                │──────────────>│                │             │
 │                │               │  runCode()     │             │
 │                │               │───────────────>│             │
 │                │               │                │  execute    │
 │                │               │                │────────────>│
 │                │               │                │             │
 │                │               │                │  result     │
 │                │               │                │<────────────│
 │                │               │  ExecutionRes  │             │
 │                │               │<───────────────│             │
 │                │               │                │             │
 │                │               │ [process]      │             │
 │                │               │                │             │
 │                │  CodeBoxOutput│                │             │
 │                │<──────────────│                │             │
 │                │               │                │             │
 │                │ [check mods]  │                │             │
 │                │               │                │             │
 │  result        │               │                │             │
 │<───────────────│               │                │             │
```

### Error Handling with Auto-Install

```
CodeBox         Scalebox SDK        Service
 │                   │                 │
 │  run(code)        │                 │
 │──────────────────>│                 │
 │                   │  execute        │
 │                   │────────────────>│
 │                   │                 │
 │                   │  ModuleNotFound │
 │                   │<────────────────│
 │  error result     │                 │
 │<──────────────────│                 │
 │                   │                 │
 │ [detect error]    │                 │
 │                   │                 │
 │  run("pip install")                 │
 │──────────────────>│                 │
 │                   │  install pkg    │
 │                   │────────────────>│
 │                   │                 │
 │                   │  success        │
 │                   │<────────────────│
 │  success          │                 │
 │<──────────────────│                 │
 │                   │                 │
 │ [return message]  │                 │
```

## Design Patterns

### 1. Adapter Pattern

**Intent**: Convert the interface of Scalebox SDK into an interface clients expect.

**Implementation**:
- `CodeBox` class adapts `Sandbox` class
- Provides simpler, domain-specific interface
- Hides complexity of the underlying SDK

**Benefits**:
- Client code (session.ts) doesn't need to know about Scalebox SDK
- Easy to change implementations
- Can add features without changing clients

### 2. Facade Pattern

**Intent**: Provide a unified interface to a set of interfaces in a subsystem.

**Implementation**:
- `CodeBox` facade for file operations, code execution, package management
- Single point of entry for all sandbox operations
- Simplifies complex SDK interactions

**Benefits**:
- Reduced coupling
- Easier to use
- Promotes abstraction

### 3. Strategy Pattern (Implicit)

**Intent**: Define a family of algorithms, encapsulate each one, and make them interchangeable.

**Implementation**:
- Output type detection strategy
- Error handling strategy
- Can be extended for different execution strategies

**Benefits**:
- Flexible output processing
- Easy to add new output types
- Testable in isolation

## Error Handling Strategy

### Levels of Error Handling

```
┌─────────────────────────────────────────────────────┐
│ Level 1: Application Layer (session.ts)             │
│ - Catches all exceptions                             │
│ - Returns user-friendly error messages               │
│ - Logs errors if verbose                             │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Level 2: Adapter Layer (CodeBox)                    │
│ - Converts errors to CodeBoxOutput                   │
│ - Detects ModuleNotFoundError                        │
│ - Provides specific error messages                   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Level 3: SDK Layer (Scalebox SDK)                   │
│ - Throws exceptions for network errors               │
│ - Returns ExecutionResult with error field           │
│ - Provides detailed error information                │
└─────────────────────────────────────────────────────┘
```

### Error Flow

```typescript
// SDK throws exception
try {
  const result = await sandbox.runCode(code);
} catch (error) {
  // Adapter catches and converts
  return {
    type: 'error',
    content: error.message,
  };
}

// SDK returns error in result
if (result.error) {
  // Adapter detects and converts
  return {
    type: 'error',
    content: result.error.traceback,
  };
}

// Application handles
if (output.type === 'error') {
  // Check for auto-installable errors
  if (output.content.includes('ModuleNotFoundError')) {
    // Auto-install and retry
  }
}
```

## Performance Characteristics

### Time Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| `start()` | O(1) + network | Creates sandbox remotely |
| `run()` | O(n) + network | n = code execution time |
| `upload()` | O(m) + network | m = file size |
| `download()` | O(m) + network | m = file size |
| `stop()` | O(1) + network | Terminates sandbox |

### Space Complexity

| Component | Space | Notes |
|-----------|-------|-------|
| CodeBox instance | O(1) | Only stores references |
| Execution result | O(m) | m = output size |
| File cache | O(n*m) | n = files, m = avg size |

### Network Calls

| Operation | Calls | Caching |
|-----------|-------|---------|
| `start()` | 1 | No |
| `run()` | 1 | Future enhancement |
| `upload()` | 1 | No |
| `download()` | 1 | No |
| `stop()` | 1 | No |

## Security Considerations

### 1. API Key Management

```typescript
// Good: Use environment variables
const codebox = new CodeBox({
  apiKey: process.env.SCALEBOX_API_KEY,
});

// Bad: Hardcoded keys
const codebox = new CodeBox({
  apiKey: 'sk-1234567890',
});
```

### 2. Code Execution Isolation

- All code runs in isolated sandboxes
- No access to host system
- Network isolation configurable
- Resource limits enforced

### 3. File Access

- Files scoped to sandbox
- No access to other sandboxes
- Automatic cleanup on stop
- Size limits enforced

### 4. Input Validation

```typescript
// Validate before execution
if (!this.sandbox) {
  throw new Error('Sandbox not initialized');
}

// Sanitize file paths
const safePath = path.normalize(filename);
```

## Testing Strategy

### Unit Tests (Mocked)

```typescript
// Mock Scalebox SDK
jest.mock('@scalebox/sdk');

test('run() returns text output', async () => {
  mockSandbox.runCode.mockResolvedValue({
    stdout: 'Hello',
    stderr: '',
    error: null,
  });

  const codebox = new CodeBox();
  const result = await codebox.run('print("Hello")');

  expect(result).toEqual({
    type: 'text',
    content: 'Hello',
  });
});
```

### Integration Tests (Real SDK)

```typescript
test('execute real Python code', async () => {
  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();
  const result = await codebox.run('print(2 + 2)');

  expect(result.type).toBe('text');
  expect(result.content).toBe('4');

  await codebox.stop();
});
```

### End-to-End Tests

```typescript
test('complete session flow', async () => {
  // Create session
  const session = new CodeInterpreterSession();
  await session.start();

  // Execute code
  const response = await session.generateResponse('Calculate 10 + 20');

  // Verify response
  expect(response.content).toContain('30');

  // Clean up
  await session.stop();
});
```

## Monitoring and Observability

### Metrics to Track

1. **Performance**
   - Sandbox creation time
   - Code execution time
   - File operation latency
   - Network call duration

2. **Reliability**
   - Success rate
   - Error rate by type
   - Timeout rate
   - Retry attempts

3. **Usage**
   - Active sandboxes
   - Code executions per session
   - Average session duration
   - Resource utilization

### Logging Strategy

```typescript
class CodeBox {
  private log(level: string, message: string, data?: any) {
    if (this.options.debug) {
      console.log(`[${level}] ${message}`, data);
    }
  }

  async run(code: string): Promise<CodeBoxOutput> {
    this.log('info', 'Executing code', { length: code.length });

    const start = Date.now();
    const result = await this.sandbox.runCode(code);
    const duration = Date.now() - start;

    this.log('info', 'Execution completed', { duration, type: result.type });

    return this.processResult(result);
  }
}
```

## Conclusion

The sandbox architecture follows best practices for API design:

- **Layered**: Clear separation of concerns
- **Testable**: Easy to mock and test
- **Maintainable**: Well-documented and organized
- **Extensible**: Easy to add features
- **Performant**: Minimal overhead
- **Secure**: Proper isolation and validation

The adapter pattern provides the right level of abstraction while maintaining flexibility for future enhancements.

