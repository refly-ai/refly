import { registerServiceWorker } from './register';
import { initMessageHandler } from './message-handler';
import { initNetworkActivityTracking } from './network-activity';

/**
 * Initialize Service Worker in one call
 * Includes registration and message handling
 *
 * Background precaching is now handled directly in the Service Worker (service-worker-sw.ts)
 * and will run automatically after SW activation on ANY page that registers this SW.
 *
 * Replaces the original useEffect in App.tsx and initServiceWorkerHandler in index.tsx
 */
export function initServiceWorker() {
  // Must initialize message handler first (ensure listener is bound before SW sends messages)
  initMessageHandler();
  initNetworkActivityTracking();

  // Then register Service Worker
  // Note: Background precaching now runs in SW context after activation
  registerServiceWorker();
}
