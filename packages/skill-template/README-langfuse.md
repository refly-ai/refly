# Langfuse Integration for Skill Template

This document describes how to integrate Langfuse observability into your skill implementations using the skill-template package.

## Overview

The Langfuse integration provides comprehensive monitoring and observability for:
- Skill execution events
- LangChain operations (LLM calls, chains, tools, retrievers)
- MCP tool calls
- Custom spans and traces

## Setup

### 1. Environment Configuration

Add the following environment variables to your API configuration:

```bash
# Langfuse Configuration
LANGFUSE_PUBLIC_KEY=pk_your_public_key
LANGFUSE_SECRET_KEY=sk_your_secret_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # or your self-hosted instance
LANGFUSE_ENABLED=true
```

### 2. Dependencies

The following packages are automatically included:
- `@refly/observability` - Core observability package
- `langfuse` - Langfuse SDK
- `langfuse-langchain` - LangChain integration
- `@paralleldrive/cuid2` - ID generation

## Usage

### Basic Integration

```typescript
import { Agent } from '@refly/skill-template';
import { createLangfuseIntegration } from '@refly/skill-template/langfuse-integration';

// Create Langfuse integration
const langfuseIntegration = createLangfuseIntegration({
  sessionId: 'user-session-123',
  userId: 'user-456',
  tags: ['production', 'skill-execution'],
  metadata: {
    environment: 'production',
    version: '1.0.0',
  },
});

// Create and configure agent
const agent = new Agent({
  // ... your agent configuration
});

// Attach monitoring to agent
langfuseIntegration.attachToAgent(agent);

// Execute skill with monitoring
const traceId = langfuseIntegration.createSkillTrace('my-skill', { input: 'data' });

try {
  const result = await agent.run({ input: 'data' });
  langfuseIntegration.updateSkillTrace(traceId, result);
} catch (error) {
  langfuseIntegration.failSkillTrace(traceId, error);
}

// Cleanup
langfuseIntegration.cleanup();
```

### LangChain Integration

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { createLangfuseIntegration } from '@refly/skill-template/langfuse-integration';

const langfuseIntegration = createLangfuseIntegration({
  sessionId: 'session-123',
  userId: 'user-456',
});

// Get LangChain callback handler
const callback = langfuseIntegration.getLangChainCallback();

// Use with LangChain components
const llm = new ChatOpenAI({
  callbacks: callback ? [callback] : [],
});

const response = await llm.invoke('Hello, world!');
```

### Method Tracing with Decorator

```typescript
import { traced } from '@refly/skill-template/langfuse-integration';

class MySkill {
  @traced('custom-operation')
  async performOperation(input: string): Promise<string> {
    // This method will be automatically traced
    return `Processed: ${input}`;
  }
}
```

### Manual Span Creation

```typescript
const langfuseIntegration = createLangfuseIntegration();

// Create a span for a custom operation
const spanId = langfuseIntegration.createSpan('data-processing', {
  inputSize: data.length,
  processingType: 'batch',
});

try {
  const result = await processData(data);
  langfuseIntegration.updateSpan(spanId, {
    outputSize: result.length,
    processingTime: Date.now() - startTime,
  });
} catch (error) {
  langfuseIntegration.failSpan(spanId, error);
}
```

### LLM Generation Logging

```typescript
const langfuseIntegration = createLangfuseIntegration();

// Log LLM generation with token usage
langfuseIntegration.logGeneration(
  'text-completion',
  'What is the capital of France?',
  'The capital of France is Paris.',
  {
    promptTokens: 8,
    completionTokens: 7,
    totalTokens: 15,
  },
  {
    model: 'gpt-4',
    temperature: 0.7,
  }
);
```

## Event Monitoring

The integration automatically monitors the following skill events:

- `start` - Skill execution started
- `end` - Skill execution completed
- `error` - Skill execution failed
- `token_usage` - Token usage information
- `create_node` - Node creation events
- `log` - Log messages
- `stream` - Streaming data
- `artifact` - Artifact creation
- `structured_data` - Structured data output

### Custom Event Configuration

```typescript
const langfuseIntegration = createLangfuseIntegration({
  eventListener: {
    enabled: true,
    includeEvents: ['start', 'end', 'error'], // Only monitor these events
    excludeEvents: ['stream'], // Exclude streaming events
  },
});
```

## MCP Tool Monitoring

MCP tool calls are automatically monitored when using the skill-template's MCP client. Each tool call creates a span with:

- Tool name and server information
- Input arguments (sanitized)
- Output results
- Execution time
- Error information (if applicable)

## Data Privacy and Security

The integration includes automatic data sanitization:

- Sensitive keys are automatically redacted (`password`, `token`, `key`, `secret`, `auth`, `credential`, `api_key`)
- Large text content is truncated to prevent excessive data transmission
- Custom sanitization can be configured

## Configuration Options

### LangfuseIntegrationConfig

```typescript
interface LangfuseIntegrationConfig {
  enabled?: boolean;              // Enable/disable integration
  sessionId?: string;             // Session identifier
  userId?: string;                // User identifier
  tags?: string[];                // Tags for all traces
  metadata?: Record<string, any>; // Additional metadata
  
  eventListener?: {
    enabled?: boolean;            // Enable event monitoring
    includeEvents?: string[];     // Events to include
    excludeEvents?: string[];     // Events to exclude
  };
  
  langchainCallback?: {
    enabled?: boolean;            // Enable LangChain monitoring
  };
}
```

## Best Practices

1. **Session Management**: Use consistent `sessionId` and `userId` for better trace correlation
2. **Resource Cleanup**: Always call `cleanup()` when done to prevent memory leaks
3. **Error Handling**: Wrap operations in try-catch blocks and use `failSkillTrace`/`failSpan`
4. **Selective Monitoring**: Use `includeEvents`/`excludeEvents` to reduce noise
5. **Metadata**: Add relevant metadata for better trace analysis

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**: Ensure all Langfuse environment variables are set
2. **Network Issues**: Check connectivity to Langfuse instance
3. **Performance Impact**: Monitor for performance impact and adjust event filtering if needed

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=langfuse*
```

## Examples

See the `examples/` directory for complete implementation examples:

- Basic skill monitoring
- LangChain integration
- Custom span creation
- Error handling patterns

## API Reference

### LangfuseIntegration Class

- `attachToAgent(agent)` - Attach monitoring to an Agent instance
- `getLangChainCallback()` - Get LangChain callback handler
- `createSkillTrace(name, input, metadata)` - Create skill execution trace
- `updateSkillTrace(traceId, output, metadata)` - Update trace with results
- `failSkillTrace(traceId, error, metadata)` - Mark trace as failed
- `createSpan(name, input, metadata)` - Create custom span
- `updateSpan(spanId, output, metadata)` - Update span with results
- `failSpan(spanId, error, metadata)` - Mark span as failed
- `logGeneration(name, input, output, usage, metadata)` - Log LLM generation
- `cleanup()` - Clean up resources

### Utility Functions

- `createLangfuseIntegration(config)` - Factory function
- `@traced(name)` - Method tracing decorator 