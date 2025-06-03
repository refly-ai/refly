# Refly Observability Package

This package provides OpenTelemetry integration with Langfuse for the Refly project.

## Features

- OpenTelemetry span monitoring with Langfuse
- Data desensitization for security
- Easy integration with existing OpenTelemetry setup

## Installation

```bash
npm install @refly/observability
```

## Usage

### Basic Setup

```typescript
import { LangfuseListener } from '@refly/observability';

// Create the listener
const langfuseListener = new LangfuseListener({
  publicKey: 'your-langfuse-public-key',
  secretKey: 'your-langfuse-secret-key',
  baseUrl: 'https://your-langfuse-instance.com' // optional
});

// Use with OpenTelemetry span processor
// Note: This is a simplified example. In practice, you would integrate
// this with your OpenTelemetry span processor setup
```

### Integration with OpenTelemetry

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseListener } from '@refly/observability';

const langfuseListener = new LangfuseListener({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL
});

// The LangfuseListener implements the OpenTelemetryListener interface
// and can be used with custom span processors to monitor spans
```

## Configuration

### Environment Variables

- `LANGFUSE_PUBLIC_KEY`: Your Langfuse public key
- `LANGFUSE_SECRET_KEY`: Your Langfuse secret key  
- `LANGFUSE_BASE_URL`: Your Langfuse instance URL (optional)

## Security Features

The package includes built-in data desensitization features:

- URL parameter sanitization (removes tokens, keys, passwords)
- SQL query sanitization (redacts sensitive values)
- General value sanitization for sensitive keywords

## API Reference

### LangfuseListener

Implements the `OpenTelemetryListener` interface for monitoring OpenTelemetry spans.

#### Constructor

```typescript
new LangfuseListener(options: {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
})
```

#### Methods

- `onSpanStart(span: Span): void` - Called when a span starts
- `onSpanEnd(span: Span): void` - Called when a span ends  
- `onSpanError(span: Span, error: Error): void` - Called when a span encounters an error
- `flush(): Promise<void>` - Flushes pending data to Langfuse

## License

MIT 