export { RemoteService, RemoteMethod, remote } from './decorators';
export type { RemoteServiceConfig, RemoteMethodMeta } from './decorators';

export { KubectlProxyManager, kubectlProxySingleton } from './kubectl';

export { logger, createLogger } from './lib/logger';

export { BridgeError, KubectlProxyError, RemoteMethodError } from './lib/exceptions';

export { ensure } from './lib/ensure';
