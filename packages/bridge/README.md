# @refly/bridge

Lightweight microservice bridge for transparent K8s service access during local development.

## Overview

Zero-config bridge that allows local development to access Kubernetes cluster services through kubectl proxy. No manual port-forwarding or mirrord installation required.

## Features

- **Zero Config**: Environment-driven, no initialization code needed
- **Type Safe**: TypeScript decorators with full type support
- **Transparent**: Same code works in all environments (local/staging/production)
- **Auto-managed**: kubectl proxy spawns/stops automatically
- **Structured Logging**: Pino with Grafana Loki compatible format

## Directory Structure

```
packages/bridge/
├── src/
│   ├── kubectl.ts           # kubectl proxy singleton manager
│   ├── decorators.ts        # @RemoteService/@RemoteMethod decorators
│   ├── index.ts             # Public API exports
│   └── lib/                 # Core utilities
│       ├── axios.ts         # Axios instance factory
│       ├── ensure.ts        # Functional assertions
│       ├── exceptions.ts    # Custom error types
│       └── logger.ts        # Pino logger
├── e2e/
│   ├── bridge.spec.ts       # Unit E2E tests
│   ├── k8s.spec.ts          # K8s integration tests
│   ├── setup.ts             # Test environment setup
│   └── fixtures/            # Test manifests
├── dist/                    # Compiled output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Quick Start

### 1. Configure Environment Variables

```bash
# Enable kubectl proxy mode (default: false)
BRIDGE_KUBECTL_PROXY_ENABLED=true

# kubectl proxy port (default: 8001)
BRIDGE_KUBECTL_PROXY_PORT=18001

# Target K8s namespace (default: 'default')
BRIDGE_K8S_NAMESPACE=test-env

# Service FQDN suffix (e.g., .test-env.svc.cluster.local)
BRIDGE_SVC_SUFFIX=.test-env.svc.cluster.local
```

### 2. Define Service Client with Decorators

```typescript
import { RemoteService, RemoteMethod, remote } from '@refly/bridge';

@Injectable()
@RemoteService({
  serviceName: 'sandbox-service',  // Will use BRIDGE_SVC_SUFFIX to build full host
  port: 3000,
  proxy: true,  // Optional: override BRIDGE_KUBECTL_PROXY_ENABLED
})
class SandboxClient {
  @RemoteMethod({ path: '/execute_code', method: 'POST' })
  executeCode(req: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    return remote();
  }

  @RemoteMethod({
    path: '/health',
    method: 'GET',
    proxy: false,  // Optional: disable proxy for this specific method
  })
  health(): Promise<{ status: string }> {
    return remote();
  }
}
```

**Alternative: Use explicit host**

```typescript
@RemoteService({
  host: 'sandbox-service.test-env.svc.cluster.local',  // Full FQDN
  port: 3000,
})
class SandboxClient {
  @RemoteMethod({
    path: '/special',
    method: 'POST',
    host: 'other-service.prod.svc.cluster.local',  // Override for specific method
  })
  specialMethod(): Promise<any> {
    return remote();
  }
}
```

### 3. Use Anywhere

```typescript
const client = new SandboxClient();
const result = await client.executeCode({ code: 'print("hello")' });
```

**That's it!** No initialization, no manual proxy management. Bridge handles everything.

## How It Works

```
Application Code
  ↓
@RemoteService/@RemoteMethod
  ↓
kubectl proxy (auto-spawned)
  ↓
Kubernetes Cluster Services
```

When `BRIDGE_KUBECTL_PROXY_ENABLED=true`:
1. First method call triggers kubectl proxy spawn (lazy initialization)
2. Requests route to `http://localhost:{port}/api/v1/namespaces/{ns}/services/{name}:{port}/proxy{path}`
3. kubectl proxy forwards to actual K8s service
4. Process exit automatically stops kubectl proxy

When `BRIDGE_KUBECTL_PROXY_ENABLED=false`:
- Direct connection: `http://{host}:{port}{path}`
- Same code works without modification

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_KUBECTL_PROXY_ENABLED` | `false` | Enable kubectl proxy mode |
| `BRIDGE_KUBECTL_PROXY_PORT` | `8001` | kubectl proxy listening port |
| `BRIDGE_K8S_NAMESPACE` | `default` | Default K8s namespace |
| `BRIDGE_SVC_SUFFIX` | `""` | Service FQDN suffix (e.g., `.test-env.svc.cluster.local`) |

## Configuration Priority

Bridge supports multi-level configuration with clear priority rules:

### Host Configuration Priority

**Priority Order**: `@RemoteMethod.host` > `@RemoteService.host` > `@RemoteService.serviceName + BRIDGE_SVC_SUFFIX`

```typescript
// Method-level host (highest priority)
@RemoteService({ serviceName: 'my-service', port: 3000 })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST', host: 'override.example.com' })
  method() { return remote(); }
}

// Service-level host (medium priority)
@RemoteService({ host: 'my-service.prod.svc.cluster.local', port: 3000 })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST' })
  method() { return remote(); }
}

// serviceName + BRIDGE_SVC_SUFFIX (lowest priority)
@RemoteService({ serviceName: 'my-service', port: 3000 })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST' })
  method() { return remote(); }
}
// Resolves to: my-service + BRIDGE_SVC_SUFFIX
```

### Proxy Configuration Priority

**Priority Order**: `@RemoteMethod.proxy` > `@RemoteService.proxy` > `BRIDGE_KUBECTL_PROXY_ENABLED`

```typescript
// Method-level proxy (highest priority)
@RemoteService({ host: 'example.com', port: 3000, proxy: true })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST', proxy: false })
  method() { return remote(); }
  // This method will NOT use kubectl proxy
}

// Service-level proxy (medium priority)
@RemoteService({ host: 'example.com', port: 3000, proxy: false })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST' })
  method() { return remote(); }
  // This method will NOT use kubectl proxy
}

// Environment variable (lowest priority)
@RemoteService({ host: 'example.com', port: 3000 })
class MyClient {
  @RemoteMethod({ path: '/api', method: 'POST' })
  method() { return remote(); }
  // Uses BRIDGE_KUBECTL_PROXY_ENABLED
}
```

## Development

### Build

```bash
pnpm build
```

### Run Tests

```bash
# Unit E2E tests
pnpm test

# K8s integration tests (requires kubectl configured)
pnpm test:k8s

# Watch mode
pnpm test:watch
```

### K8s E2E Testing

Requires:
- Valid kubectl configuration
- Access to K8s cluster (e.g., AWS EKS)

```bash
export BRIDGE_KUBECTL_PROXY_ENABLED=true
export BRIDGE_KUBECTL_PROXY_PORT=18001
export BRIDGE_K8S_NAMESPACE=default
export BRIDGE_SVC_SUFFIX=.default.svc.cluster.local

pnpm test:k8s
```

Test flow:
1. Deploys test container (mccutchen/go-httpbin) to K8s
2. kubectl proxy spawns automatically
3. Tests all HTTP methods: GET, POST, PUT, DELETE, PATCH
4. Tests configuration overrides (host, proxy)
5. Tests error handling (404, 500)
6. Verifies response data
7. Cleans up test resources

## API Reference

### Decorators

**`@RemoteService(config: RemoteServiceConfig)`**

Class decorator to define remote service configuration.

```typescript
interface RemoteServiceConfig {
  host?: string;         // Full K8s service FQDN or hostname (optional)
  serviceName?: string;  // K8s service name without namespace/domain (optional)
  port: number;          // Service port (required)
  proxy?: boolean;       // Override BRIDGE_KUBECTL_PROXY_ENABLED (optional)
}
```

**Configuration Rules:**
- Provide either `host` OR `serviceName` (at least one required)
- If `host` is provided, it takes priority over `serviceName`
- If only `serviceName` is provided, full host will be: `{serviceName}{BRIDGE_SVC_SUFFIX}`
- `proxy` setting overrides environment variable `BRIDGE_KUBECTL_PROXY_ENABLED`

**Examples:**

```typescript
// Using serviceName (will append BRIDGE_SVC_SUFFIX)
@RemoteService({
  serviceName: 'sandbox-service',
  port: 3000,
  proxy: true,
})

// Using explicit host
@RemoteService({
  host: 'sandbox-service.prod.svc.cluster.local',
  port: 3000,
})

// Using both (host takes priority)
@RemoteService({
  host: 'sandbox-service.prod.svc.cluster.local',
  serviceName: 'sandbox-service',  // Ignored
  port: 3000,
})
```

**`@RemoteMethod(config: RemoteMethodConfig)`**

Method decorator to define HTTP endpoint routing.

```typescript
interface RemoteMethodConfig {
  path: string;       // HTTP path (required, e.g., '/api/execute')
  method: string;     // HTTP method (required: GET/POST/PUT/DELETE/PATCH)
  host?: string;      // Override service host for this method (optional)
  proxy?: boolean;    // Override service proxy setting for this method (optional)
}
```

**Configuration Rules:**
- `host` overrides `@RemoteService` host configuration
- `proxy` overrides `@RemoteService` proxy configuration

**Examples:**

```typescript
// Basic method
@RemoteMethod({ path: '/execute', method: 'POST' })

// Override host for specific method
@RemoteMethod({
  path: '/special',
  method: 'POST',
  host: 'other-service.prod.svc.cluster.local',
})

// Disable proxy for specific method
@RemoteMethod({
  path: '/health',
  method: 'GET',
  proxy: false,  // Direct connection
})
```

**`remote(): any`**

Placeholder function for method body (required by TypeScript).

### kubectl Proxy Singleton

```typescript
import { kubectlProxySingleton } from '@refly/bridge';

// Get proxy URL for a service (with optional proxy override)
const url = kubectlProxySingleton.getProxyUrl(
  'sandbox-service.test-env.svc.cluster.local',
  3000,
  '/api/execute',
  true  // Optional: force proxy mode (overrides BRIDGE_KUBECTL_PROXY_ENABLED)
);
// => http://localhost:18001/api/v1/namespaces/test-env/services/sandbox-service:3000/proxy/api/execute

// Or without proxy
const directUrl = kubectlProxySingleton.getProxyUrl(
  'example.com',
  3000,
  '/api/execute',
  false  // Force direct connection
);
// => http://example.com:3000/api/execute

// Ensure kubectl proxy is running (auto-called by decorators)
await kubectlProxySingleton.ensureRunning();
```

## Requirements

- Node.js >= 20.19.0
- TypeScript with `experimentalDecorators: true`
- kubectl configured with cluster access (for proxy mode)

## License

ISC
