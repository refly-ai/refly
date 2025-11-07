# Sandbox API Design

This directory contains the sandbox integration for the code interpreter agent.

## Architecture

The sandbox integration follows a layered architecture:

1. **Low-level SDK** (`@scalebox/sdk`) - Direct integration with Scalebox API
2. **CodeBox Adapter** (`codebox-adapter.ts`) - Simplified interface compatible with codeboxapi
3. **Agent Tools** (`index.ts`) - LangChain tools for agent interaction

## CodeBox Adapter

The `CodeBox` class provides a simplified, high-level interface for code execution that's compatible with the original `codeboxapi` package. This adapter wraps the Scalebox SDK and provides:

### Key Features

- **Simple API**: Match the codeboxapi interface for easy migration
- **Automatic Package Management**: Install Python packages automatically when needed
- **File Operations**: Upload and download files to/from the sandbox
- **Code Execution**: Execute Python code with proper output handling
- **Session Management**: Create, resume, and stop sandbox sessions

### API Reference

#### Constructor

```typescript
new CodeBox(options?: CodeBoxOptions)
```

Options:
- `requirements`: Array of Python packages to install on startup
- `timeoutMs`: Sandbox timeout in milliseconds (default: 30 minutes)
- `envs`: Environment variables
- `metadata`: Additional metadata
- `apiKey`: Scalebox API key (defaults to `SCALEBOX_API_KEY` env var)

#### Methods

##### `start(): Promise<CodeBoxStatus>`
Start the sandbox and install required packages.

##### `run(code: string): Promise<CodeBoxOutput>`
Execute Python code and return the output. Automatically handles:
- Text output
- Image generation (PNG)
- Error messages
- Module installation errors

##### `upload(filename: string, content: Buffer | string): Promise<void>`
Upload a file to the sandbox workspace.

##### `download(filename: string): Promise<{ content: string | null }>`
Download a file from the sandbox workspace.

##### `install(packageName: string): Promise<void>`
Install a Python package using pip.

##### `stop(): Promise<CodeBoxStatus>`
Stop the sandbox and release resources.

##### `status(): Promise<CodeBoxStatus>`
Get the current sandbox status.

##### `isRunning(): Promise<boolean>`
Check if the sandbox is currently running.

#### Static Methods

##### `fromId(sessionId: string, options?: CodeBoxOptions): Promise<CodeBox>`
Reconnect to an existing sandbox session.

### Output Types

```typescript
interface CodeBoxOutput {
  type: 'text' | 'image/png' | 'error';
  content: string;
}
```

- `text`: Standard text output from code execution
- `image/png`: Base64-encoded PNG image
- `error`: Error message or traceback

## Integration with session.ts

The adapter is designed to be a drop-in replacement for `codeboxapi`. The main changes needed in `session.ts`:

```typescript
// Before
import { CodeBox, CodeBoxOutput } from 'codeboxapi';

// After
import { CodeBox, CodeBoxOutput } from './sandbox/codebox-adapter';
```

All the existing code using CodeBox continues to work without modifications:

```typescript
// Creating a new sandbox
const codebox = new CodeBox({ 
  requirements: ['numpy', 'pandas'],
  apiKey: process.env.SCALEBOX_API_KEY,
});
await codebox.start();

// Executing code
const result = await codebox.run('import numpy as np; print(np.array([1,2,3]))');

// Uploading files
await codebox.upload('data.csv', csvContent);

// Downloading files
const file = await codebox.download('output.png');

// Stopping the sandbox
await codebox.stop();

// Reconnecting to existing session
const codebox = await CodeBox.fromId(sessionId);
```

## Design Benefits

### 1. **Separation of Concerns**
- **Adapter Layer**: Handles the complexity of Scalebox SDK
- **Agent Tools**: Focus on LangChain integration
- **Session Management**: High-level orchestration in session.ts

### 2. **Backward Compatibility**
- Drop-in replacement for codeboxapi
- Minimal changes to existing code
- Same interface, different implementation

### 3. **Flexibility**
- Easy to switch between different sandbox providers
- Can add caching, retries, or other middleware
- Testable with mocks

### 4. **Type Safety**
- Full TypeScript support
- Clear interfaces and type definitions
- Compile-time error checking

### 5. **Error Handling**
- Automatic retry for module installation
- Graceful degradation
- Detailed error messages

## Agent Tools

The `index.ts` file exports LangChain-compatible tools for agent interaction:

- `ScaleboxCreate`: Create a new sandbox
- `ScaleboxConnect`: Connect to existing sandbox
- `ScaleboxRunCode`: Execute code with full features
- `ScaleboxFiles*`: File system operations
- `ScaleboxCommands*`: Command execution
- And more...

These tools are used when you need more granular control or want to expose sandbox operations directly to the LLM agent.

## Usage Examples

### Basic Code Execution

```typescript
const codebox = new CodeBox({
  requirements: ['matplotlib', 'seaborn'],
  apiKey: process.env.SCALEBOX_API_KEY,
});

await codebox.start();

const result = await codebox.run(`
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.plot(x, y)
plt.title('Sine Wave')
plt.savefig('sine.png')
`);

if (result.type === 'image/png') {
  console.log('Generated image:', result.content);
}
```

### File Operations

```typescript
// Upload data file
const csvData = 'name,age\nJohn,30\nJane,25';
await codebox.upload('data.csv', csvData);

// Process data
await codebox.run(`
import pandas as pd
df = pd.read_csv('data.csv')
df['age_plus_10'] = df['age'] + 10
df.to_csv('result.csv', index=False)
`);

// Download result
const result = await codebox.download('result.csv');
console.log('Result:', result.content);
```

### Session Resumption

```typescript
// First session
const codebox1 = new CodeBox();
await codebox1.start();
const sessionId = codebox1.sessionId;
await codebox1.run('x = 42');

// Later, in a different process
const codebox2 = await CodeBox.fromId(sessionId);
const result = await codebox2.run('print(x)');
// Output: "42"
```

## Environment Variables

- `SCALEBOX_API_KEY`: API key for Scalebox SDK (required)

## Error Handling

The adapter handles several error scenarios automatically:

1. **Module Not Found**: Automatically installs missing packages
2. **Connection Errors**: Returns error output instead of throwing
3. **Timeout**: Respects the configured timeout
4. **File Not Found**: Returns null content for missing files

## Future Improvements

- [ ] Add support for streaming output
- [ ] Implement connection pooling
- [ ] Add metrics and monitoring
- [ ] Support for multiple programming languages
- [ ] Caching layer for repeated operations
- [ ] Retry mechanism for transient failures

