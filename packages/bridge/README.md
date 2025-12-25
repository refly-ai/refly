# @refly/bridge

Lightweight microservice bridge for Kubernetes development. Provides transparent routing from local development to Kubernetes services through kubectl proxy.

## Features

- 🚀 **Zero Config**: Minimal setup, maximum productivity
- 🎯 **Type Safe**: Full TypeScript support with decorators
- 🔌 **Transparent**: No code changes in production
- 🛡️ **Validated**: Zod-based configuration validation
- 🧪 **Tested**: E2E tests with Vitest

## Installation

```bash
pnpm add @refly/bridge
```

## Quick Start

### 1. Initialize Bridge in main.ts

```typescript
import BridgeBootstrap from '@refly/bridge';

async function bootstrap() {
  // Initialize bridge
  const bridge = new BridgeBootstrap({
    enabled: process.env.ENABLE_REMOTE_BRIDGE === 'true',
    namespace: process.env.K8S_NAMESPACE || 'default',
    kubectlProxyPort: 8001,
    bridgeProxyPort: 9001,
  });

  await bridge.initialize();

  // Your app initialization...
}

bootstrap();
```

### 2. Use Decorator in Services

```typescript
import { RpcInterceptor } from '@refly/bridge';

class MyService {
  @RpcInterceptor('sandbox')
  private sandboxClient: any;

  async executeCode(code: string) {
    // Automatically routed through bridge when enabled
    const response = await this.sandboxClient.post('/execute', { code });
    return response.data;
  }
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable bridge (default: false)
ENABLE_REMOTE_BRIDGE=true

# Kubernetes namespace (required when enabled)
K8S_NAMESPACE=test-env

# kubectl proxy port (default: 8001)
K8S_PROXY_PORT=8001

# Bridge proxy port (default: 9001)
BRIDGE_PROXY_PORT=9001
```

### Initialization Options

```typescript
interface BridgeInitOptions {
  enabled: boolean;           // Enable bridge functionality
  namespace: string;          // Kubernetes namespace
  kubectlProxyPort?: number; // kubectl proxy port (default: 8001)
  bridgeProxyPort?: number;  // Bridge proxy port (default: 9001)
}
```

## Architecture

```
Application Code
  ↓
@RpcInterceptor Decorator
  ↓
Bridge Proxy Server (localhost:9001)
  ↓ (routes to correct K8s service)
kubectl proxy (localhost:8001)
  ↓
Kubernetes Cluster Services
```

## Built-in Services

Currently supports:

- **sandbox**: Code execution service (port 8080)

## Advanced Usage

### Manual Client Creation

```typescript
import { createBridgedClient } from '@refly/bridge';

const config = createBridgedClient('sandbox');
const client = new HttpClient(config);
```

### Custom Service Registration

```typescript
import { metadataRegistry } from '@refly/bridge';

metadataRegistry.register('my-service', {
  name: 'my-k8s-service',
  port: 3000,
});
```

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### E2E Tests

E2E tests require a valid kubectl configuration:

```bash
export K8S_NAMESPACE=test-env
pnpm test:e2e
```

## How It Works

1. **Initialization**: Bridge starts kubectl proxy and HTTP proxy server
2. **Registration**: Services are registered in metadata registry
3. **Decoration**: `@RpcInterceptor` modifies property getters
4. **Routing**: HTTP proxy intercepts requests and forwards to kubectl proxy
5. **Forwarding**: kubectl proxy routes to actual Kubernetes services

## Requirements

- Node.js >= 20.19.0
- kubectl configured with cluster access
- TypeScript with `experimentalDecorators` enabled

## License

ISC
