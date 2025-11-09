# Sandbox Agent-Tool

A powerful agent-tool that provides AI-powered code interpreter capabilities with session management. This tool wraps the `@refly/sandbox-agent` package to provide a clean interface for code execution, data analysis, and visualization within the Refly agent ecosystem.

## Features

- **Code Execution**: Execute Python and other programming languages
- **Session Management**: Persistent execution contexts across multiple interactions
- **File Processing**: Upload and process various file types (CSV, images, documents)
- **Data Visualization**: Generate charts, plots, and visual outputs
- **File Upload Integration**: Automatic upload of generated files to Refly storage

## Available Tools

### 1. generateResponse
Generate responses using the code interpreter with optional file uploads.

**Parameters:**
- `sessionId` (optional): Existing session ID to use
- `message`: The request to send to the code interpreter
- `files` (optional): Array of files to upload (base64 encoded)
- `options` (optional): Session configuration options

**Use Cases:**
- Data analysis and processing
- Code execution and debugging
- Creating visualizations and charts
- Processing uploaded files

### 2. startSession
Start a new code interpreter session for persistent execution context.

**Parameters:**
- `options` (optional): Session configuration options

### 3. stopSession
Stop an existing code interpreter session and clean up resources.

**Parameters:**
- `sessionId`: Session ID to stop

### 4. getSessionStatus
Get the current status of a code interpreter session.

**Parameters:**
- `sessionId`: Session ID to check

## Usage Example

```typescript
import { SandboxToolset } from '@refly/agent-tools';

// Create toolset with required parameters
const toolset = new SandboxToolset({
  user: currentUser,
  reflyService: reflyServiceInstance,
});

// Initialize tools
const tools = toolset.initializeTools();

// Start a session
const startTool = toolset.getToolInstance('startSession');
const sessionResult = await startTool._call({
  options: { verbose: true }
});

// Generate response with code execution
const generateTool = toolset.getToolInstance('generateResponse');
const result = await generateTool._call({
  sessionId: sessionResult.data.sessionId,
  message: 'Create a bar chart with data [1, 2, 3, 4, 5]',
});

console.log('Generated files:', result.data.uploadedFiles);
```

## File Upload Support

The tool supports uploading files to the code interpreter session:

```typescript
const csvData = 'name,age\nAlice,25\nBob,30';
const base64Content = Buffer.from(csvData).toString('base64');

await generateTool._call({
  sessionId: 'your-session-id',
  message: 'Analyze this CSV data and create a summary',
  files: [{
    name: 'data.csv',
    content: base64Content,
  }],
});
```

## Integration with Refly

This tool integrates seamlessly with the Refly ecosystem:

- **File Storage**: Generated files are automatically uploaded to Refly storage
- **User Context**: Uses Refly user authentication and permissions
- **Credit System**: Tracks credit usage based on code executions

## Dependencies

- `@refly/sandbox-agent`: Core code interpreter functionality
- `@refly/openapi-schema`: Type definitions for Refly API
- `@langchain/core`: Base tool interfaces

## Configuration

The tool requires the following environment variables for the underlying sandbox-agent:

- `SCALEBOX_API_KEY`: API key for Scalebox service (if using Scalebox backend)
- `OPENAI_API_KEY`: OpenAI API key for LLM functionality
- Additional LLM provider keys as needed

See the `@refly/sandbox-agent` documentation for complete configuration options.

## Error Handling

The tool provides comprehensive error handling:

- Session management errors (session not found, start/stop failures)
- Code execution errors (syntax errors, runtime exceptions)
- File upload errors (invalid format, upload failures)
- Network and API errors

All errors are returned in a standardized format with descriptive messages.

## Credit Usage

Credit costs are calculated based on:
- Session operations (start/stop): 1 credit
- Code executions: 1 credit per execution
- File processing: Additional credits based on complexity

## Best Practices

1. **Session Management**: Always stop sessions when done to free resources
2. **File Sizes**: Keep uploaded files reasonably sized for better performance
3. **Error Handling**: Always check the `status` field in responses
4. **Resource Cleanup**: Use session timeouts to prevent resource leaks
5. **Security**: Validate file contents before processing in production

## Troubleshooting

Common issues and solutions:

- **Session not found**: Ensure session was started and ID is correct
- **Code execution timeout**: Increase timeout in session options
- **File upload failures**: Check file format and size limits
- **Permission errors**: Verify user has required permissions

For more detailed troubleshooting, enable verbose logging in session options.
