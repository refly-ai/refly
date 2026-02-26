/// <reference lib="webworker" />

/**
 * Custom Service Worker with Background Precaching - Simplified Single Cache
 *
 * Key improvements:
 * 1. Single cache bucket (app-cache-v1) for all resources
 * 2. No expiration/maxEntries (files are hashed, no need for cleanup)
 * 3. Explicit cache checking before precaching (avoid duplicate downloads)
 * 4. Singleton pattern for background precacher (avoid duplicate instances)
 */

import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { PrecacheEntry } from 'workbox-precaching';

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }
}

declare const __PRECACHE_MANIFEST_URL__: string;

type CacheKeyPlugin = {
  cacheKeyWillBeUsed?: (args: {
    request: Request;
    mode: string;
  }) => Promise<Request | string>;
};

type CacheWillUpdatePlugin = {
  cacheWillUpdate?: (args: {
    request: Request;
    response: Response;
    event: ExtendableEvent;
  }) => Promise<Response | null | undefined>;
};

// TypeScript declarations for Service Worker context
declare const self: ServiceWorkerGlobalScope;

// ============================================================================
// Configuration
// ============================================================================

const CACHE_NAME = 'app-cache-v1';

const getClientId = (event: ExtendableEvent): string | null => {
  if ('clientId' in event) {
    return (event as FetchEvent).clientId || null;
  }
  return null;
};

const normalizeHtmlCacheKey = (request: Request): string => {
  const url = new URL(request.url);

  // Normalize /workflow/* routes to /workflow/
  if (url.pathname.startsWith('/workflow/')) {
    return `${url.origin}/workflow/`;
  }

  // Normalize /workspace routes (ignore query params)
  if (url.pathname === '/workspace' || url.pathname.startsWith('/workspace/')) {
    return `${url.origin}/workspace`;
  }

  // Normalize /share/file/* routes to /share/file/
  if (url.pathname.startsWith('/share/file/')) {
    return `${url.origin}/share/file/`;
  }

  return request.url;
};

const isSsrPath = (path: string): boolean => {
  return (
    path === '/pricing' ||
    path.startsWith('/workflow-marketplace') ||
    path.startsWith('/workflow-template')
  );
};

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Only precache the most critical resources to avoid bandwidth contention
      const criticalUrls = self.__WB_MANIFEST
        .filter((entry) => {
          const url = typeof entry === 'string' ? entry : entry.url;
          // Only cache core framework files (React, Router, main entry)
          return (
            url.includes('lib-react.') ||
            url.includes('lib-router.') ||
            url.includes('/index.') ||
            url.includes('/static/css/index.')
          );
        })
        .map((entry) => {
          const url = typeof entry === 'string' ? entry : entry.url;
          return new URL(url, self.location.origin).href;
        });

      console.log(
        `[SW] Precaching ${criticalUrls.length} critical resources (filtered from ${self.__WB_MANIFEST.length})`,
      );

      try {
        await cache.addAll(criticalUrls);
        console.log('[SW] Critical resources precached');
      } catch (error) {
        console.error('[SW] Precache failed:', error);
      } finally {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          }),
      );

      // Take control immediately
      await self.clients.claim();

      console.log('[SW] Activated, waiting for page load before starting precache');
    })(),
  );
});

// ============================================================================
// Runtime Caching Strategies
// ============================================================================

// === Strategy 0: Home page - NetworkOnly ===
registerRoute(
  ({ request, url }) => request.destination === 'document' && url.pathname === '/',
  new NetworkOnly(),
);

// === Strategy 1: SSR HTML - NetworkOnly ===
registerRoute(
  ({ request, url }) => request.destination === 'document' && isSsrPath(url.pathname),
  new NetworkOnly(),
);

// === Strategy 2: API requests - NetworkOnly (never cache API responses) ===
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// === Strategy 3: HTML (non-home) - StaleWhileRevalidate with version check ===
registerRoute(
  ({ request, url }) =>
    request.destination === 'document' &&
    url.pathname !== '/' &&
    !isSsrPath(url.pathname) &&
    // Exclude static assets to prevent caching HTML content for CSS/JS files
    !url.pathname.startsWith('/static/'),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAME,
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => normalizeHtmlCacheKey(request),
      } satisfies CacheKeyPlugin,
      {
        cacheWillUpdate: async ({ request, response, event }) => {
          // Only cache successful responses
          if (!response || response.status !== 200) {
            return null;
          }

          // Get cached HTML for version comparison
          const cache = await caches.open(CACHE_NAME);
          //  Use normalized key to match the stored cache key
          const normalizedKey = normalizeHtmlCacheKey(request);
          const cachedResponse = await cache.match(normalizedKey);

          if (cachedResponse) {
            try {
              // Read new and old HTML
              const newHtml = await response.clone().text();
              const oldHtml = await cachedResponse.text();
              const clientId = getClientId(event);

              // Extract version from meta tag if available; fallback to main script hash
              const extractVersion = (html: string): string | null => {
                const metaMatch = html.match(
                  /<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']\s*\/?>/i,
                );
                if (metaMatch) {
                  return metaMatch[1];
                }
                const match = html.match(/\/static\/js\/index\.([a-f0-9]+)\.js/);
                return match ? match[1] : null;
              };

              const newVersion = extractVersion(newHtml);
              const oldVersion = extractVersion(oldHtml);

              console.log('[SW] Version check:', {
                url: request.url,
                clientId,
                old: oldVersion,
                new: newVersion,
                changed: newVersion !== oldVersion,
              });

              // If version changed, update cache immediately and notify the client
              if (newVersion && oldVersion && newVersion !== oldVersion) {
                console.log(
                  '[SW] New version detected! Updating cache and notifying client:',
                  clientId,
                );

                // 1. Clear all old HTML caches (except SSR pages)
                const allCachedRequests = await cache.keys();
                const htmlCachesToDelete = allCachedRequests.filter((req) => {
                  const url = new URL(req.url);
                  // Match both:
                  // - req.destination === 'document' (from fetch events)
                  // - req.destination === '' (from cache.put with string keys)
                  return (
                    (req.destination === 'document' || req.destination === '') &&
                    url.pathname !== '/' &&
                    !isSsrPath(url.pathname)
                  );
                });

                console.log(`[SW] Clearing ${htmlCachesToDelete.length} old HTML caches`);
                await Promise.all(htmlCachesToDelete.map((req) => cache.delete(req)));

                // 2. Immediately cache the new HTML for current route
                await cache.put(normalizedKey, response.clone());

                // 3. Proactively precache new HTML for common routes
                const commonRoutes = ['/workflow/', '/workspace', '/share/file/'];

                console.log('[SW] Precaching new HTML for common routes');
                const currentPathname = normalizedKey
                  ? new URL(normalizedKey, self.location.origin).pathname
                  : null;

                await Promise.allSettled(
                  (commonRoutes ?? [])
                    .filter((route) => route !== currentPathname)
                    .map(async (route) => {
                      try {
                        const routeUrl = new URL(route, self.location.origin).href;
                        const routeResponse = await fetch(routeUrl, {
                          cache: 'no-cache',
                        });
                        if (routeResponse.ok) {
                          await cache.put(routeUrl, routeResponse);
                          console.log('[SW] Precached new HTML:', route);
                        }
                      } catch (error) {
                        console.warn('[SW] Failed to precache route:', route, error);
                      }
                    }),
                );

                // 4. Notify the client
                const client = clientId ? await self.clients.get(clientId) : null;
                if (client) {
                  client.postMessage({
                    type: 'NEW_VERSION_AVAILABLE',
                    oldVersion,
                    newVersion,
                    url: request.url,
                    timestamp: Date.now(),
                  });
                  console.log('[SW] Message sent to client:', clientId);
                }
              }
            } catch (error) {
              console.error('[SW] Error comparing HTML versions:', error);
            }
          }

          return response;
        },
      } satisfies CacheWillUpdatePlugin,
    ],
  }),
);

// === Strategy 4: All other same-origin resources - CacheFirst ===
registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new CacheFirst({
    cacheName: CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      //  Add debug logging to see if cache matching works
      {
        cachedResponseWillBeUsed: async ({ request, cachedResponse }) => {
          if (cachedResponse) {
            console.log('[SW] Cache HIT:', request.url);
          } else {
            console.log('[SW] Cache MISS:', request.url);
          }
          return cachedResponse;
        },
      },
    ],
    matchOptions: {
      ignoreSearch: false,
      ignoreMethod: false,
      ignoreVary: false,
    },
  }),
);

// === Strategy 5: Google Fonts CSS - StaleWhileRevalidate ===
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  }),
);

// === Strategy 6: Google Fonts files - CacheFirst ===
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: CACHE_NAME,
  }),
);

// ============================================================================
// Background Precaching (Stage 2)
// ============================================================================

interface PrecacheConfig {
  enabled: boolean;
  idleTimeout: number;
  throttleDelay: number;
  maxConcurrent: number;
}

type PrecacheMode = 'skip' | 'limited' | 'full';
enum NetworkStatus {
  Busy = 'busy',
  Idle = 'idle',
}

const PRECACHE_CONFIG: PrecacheConfig = {
  enabled: true,
  idleTimeout: 2000, // 2 seconds
  throttleDelay: 0, // no delay between batches
  maxConcurrent: 1, // Max 1 concurrent request
};

let networkStatus: NetworkStatus = NetworkStatus.Idle;
let pendingResources: string[] | null = null;
let resumeTimer: number | null = null;
let routeIdleTimer: number | null = null;
const activePrecacheControllers = new Set<AbortController>();

// ✅ Global singleton precacher
let globalPrecacher: ServiceWorkerBackgroundPrecache | null = null;

const isNetworkBusy = () => networkStatus === NetworkStatus.Busy;

const abortActivePrecache = () => {
  if (activePrecacheControllers.size === 0) {
    return;
  }
  for (const controller of activePrecacheControllers) {
    controller.abort();
  }
  activePrecacheControllers.clear();
};

const handleNetworkIdle = () => {
  networkStatus = NetworkStatus.Idle;
  if (!pendingResources || pendingResources.length === 0) {
    return;
  }
  if (resumeTimer) {
    return;
  }
  resumeTimer = self.setTimeout(() => {
    resumeTimer = null;
    if (!pendingResources || pendingResources.length === 0) {
      return;
    }
    const resourcesToResume = pendingResources;
    pendingResources = null;

    // ✅ Reuse global precacher instance
    if (globalPrecacher) {
      globalPrecacher
        .precacheResources(resourcesToResume)
        .then(() => {
          if (!pendingResources || pendingResources.length === 0) {
            console.log('[SW Background Precache] Completed after resume');
          }
        })
        .catch((error) => {
          console.error('[SW Background Precache] Error after resume:', error);
        });
    }
  }, 3000);
};

/**
 * Background precache manager running in Service Worker context
 */
class ServiceWorkerBackgroundPrecache {
  public isRunning = false;

  async start() {
    if (!PRECACHE_CONFIG.enabled || this.isRunning) {
      return;
    }

    console.log('[SW Background Precache] Starting...');
    this.isRunning = true;

    try {
      // Wait a bit before starting (let critical operations finish)
      await this.sleep(PRECACHE_CONFIG.idleTimeout);

      // Check if we should skip (need to ask a client about connection)
      const mode = await this.getPrecacheMode();
      if (mode === 'skip') {
        console.log('[SW Background Precache] Slow connection or save-data, only precaching core');
      }

      // Get list of resources to precache
      const resources = await this.getResourcesToPrecache(mode);
      console.log(
        `[SW Background Precache] Found ${resources.length} resources to precache (${mode})`,
      );

      // Precache with throttling
      await this.precacheWithThrottle(resources);

      if (pendingResources && pendingResources.length > 0) {
        console.log('[SW Background Precache] Paused due to network activity');
        return;
      }

      console.log('[SW Background Precache] Completed');
    } catch (error) {
      console.error('[SW Background Precache] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if we should skip precaching (slow connection)
   */
  private async getPrecacheMode(): Promise<PrecacheMode> {
    try {
      // Ask a client about network conditions
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length === 0) {
        return 'full'; // No clients, proceed
      }

      // Send message to first client asking about connection
      const client = clients[0];
      const response = await this.sendMessageToClient(client, { type: 'CHECK_CONNECTION' });

      return response?.mode || 'full';
    } catch (error) {
      console.warn('[SW Background Precache] Error checking connection:', error);
      return 'full'; // Proceed if we can't check
    }
  }

  /**
   * Send message to client and wait for response
   */
  private sendMessageToClient(client: Client, message: any): Promise<any> {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      client.postMessage(message, [messageChannel.port2]);

      // Timeout after 1 second
      setTimeout(() => resolve(null), 1000);
    });
  }

  /**
   * ✅ Get list of resources to precache, checking the single cache
   */
  private async getResourcesToPrecache(mode: PrecacheMode): Promise<string[]> {
    const resources: Set<string> = new Set();
    const isPrecacheAsset = (path: string) => {
      if (path.endsWith('.map')) {
        return false;
      }
      return path.endsWith('.js') || path.endsWith('.css');
    };
    const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

    try {
      // ✅ Get all cached resources from the single cache
      const cachedUrls = new Set<string>();
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      for (const request of requests) {
        cachedUrls.add(request.url);
      }

      console.log('[SW Background Precache] Already cached:', cachedUrls.size, 'resources');

      // Fetch precache manifest
      try {
        const precachePath =
          typeof __PRECACHE_MANIFEST_URL__ !== 'undefined'
            ? __PRECACHE_MANIFEST_URL__
            : '/precache.json';
        const precacheUrl = new URL(precachePath, self.location.origin).href;
        const response = await fetch(precacheUrl, { cache: 'no-cache' });

        if (response.ok) {
          const manifest = await response.json();
          const coreFiles = Array.isArray(manifest.core) ? manifest.core : [];
          const workflowFiles = Array.isArray(manifest.workflow) ? manifest.workflow : [];
          const workspaceFiles = Array.isArray(manifest.workspace) ? manifest.workspace : [];
          const allFiles = Array.isArray(manifest.all)
            ? manifest.all
            : [...coreFiles, ...workflowFiles, ...workspaceFiles];

          const selectedFiles =
            mode === 'skip'
              ? coreFiles
              : mode === 'limited'
                ? [...coreFiles, ...workflowFiles, ...workspaceFiles]
                : allFiles;

          for (const file of selectedFiles) {
            if (typeof file !== 'string' || !isPrecacheAsset(file)) {
              continue;
            }
            const url = new URL(normalizePath(file), self.location.origin).href;
            if (!cachedUrls.has(url)) {
              resources.add(url);
            }
          }

          console.log(
            '[SW Background Precache] precache.json total:',
            selectedFiles.length,
            'uncached:',
            resources.size,
          );
          return resources.size > 0 ? this.prioritizeResources(Array.from(resources)) : [];
        }
      } catch (error) {
        console.log('[SW Background Precache] Precache manifest not available:', error);
      }
    } catch (error) {
      console.warn('[SW Background Precache] Error getting resources:', error);
    }

    if (resources.size === 0) {
      console.log('[SW Background Precache] No uncached resources found');
      return [];
    }

    console.log('[SW Background Precache] Found', resources.size, 'uncached resources');

    return this.prioritizeResources(Array.from(resources));
  }

  /**
   * Prioritize resources by importance
   */
  private prioritizeResources(resources: string[]): string[] {
    const priority = {
      high: [] as string[],
      medium: [] as string[],
      low: [] as string[],
    };

    for (const url of resources) {
      // High priority: frequently used pages
      if (
        url.includes('group-workflow') ||
        url.includes('group-workspace') ||
        url.includes('group-auth') ||
        url.includes('group-landing') ||
        url.includes('group-run')
      ) {
        priority.high.push(url);
      }
      // Medium priority: other async chunks
      else if (url.includes('/async/')) {
        priority.medium.push(url);
      }
      // Low priority: other resources
      else {
        priority.low.push(url);
      }
    }

    return [...priority.high, ...priority.medium, ...priority.low];
  }

  /**
   * ✅ Precache resources (can be called externally for resume)
   */
  public async precacheResources(resources: string[]) {
    await this.precacheWithThrottle(resources);
  }

  /**
   * ✅ Precache with explicit cache checking and writing
   */
  private async precacheWithThrottle(resources: string[]) {
    const chunks = this.chunkArray(resources, PRECACHE_CONFIG.maxConcurrent);
    const cache = await caches.open(CACHE_NAME);

    for (let i = 0; i < chunks.length; i++) {
      if (isNetworkBusy()) {
        pendingResources = resources.slice(i * PRECACHE_CONFIG.maxConcurrent);
        return;
      }

      const chunk = chunks[i];

      // ✅ Fetch chunk concurrently with explicit cache checking
      await Promise.all(
        chunk.map(async (url) => {
          const controller = new AbortController();
          activePrecacheControllers.add(controller);

          try {
            //  Create Request object for consistent cache key
            const request = new Request(url);

            //  Check if already cached (real-time check)
            const cached = await cache.match(request);
            if (cached) {
              return;
            }

            //  Fetch and explicitly cache
            const response = await fetch(request, {
              cache: 'default',
              signal: controller.signal,
            });

            if (response.ok) {
              // Use Request object as key for consistent matching with Workbox
              await cache.put(request, response.clone());
            }
          } catch (error) {
            if (error?.name !== 'AbortError') {
              console.warn('[SW] Failed to fetch:', url);
            }
          } finally {
            activePrecacheControllers.delete(controller);
          }
        }),
      );

      if (isNetworkBusy()) {
        pendingResources = resources.slice((i + 1) * PRECACHE_CONFIG.maxConcurrent);
        return;
      }

      // Throttle between chunks
      if (i < chunks.length - 1) {
        await this.sleep(PRECACHE_CONFIG.throttleDelay);
      }

      // Log progress
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      console.log(`[SW Background Precache] Progress: ${progress}%`);
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Message Handling
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  // Handle connection check requests
  if (event.data.type === 'CHECK_CONNECTION') {
    return;
  }

  // ✅ Handle start precache request - use singleton
  if (event.data.type === 'START_PRECACHE') {
    if (globalPrecacher?.isRunning) {
      console.log('[SW] Precache already running, ignoring duplicate request');
      return;
    }

    console.log('[SW] Received START_PRECACHE, starting background precache');
    globalPrecacher = new ServiceWorkerBackgroundPrecache();
    globalPrecacher.start().catch((error) => {
      console.error('[SW] Error starting precache:', error);
    });
    return;
  }

  if (event.data.type === 'NETWORK_BUSY') {
    networkStatus = NetworkStatus.Busy;
    abortActivePrecache();
    return;
  }

  if (event.data.type === 'NETWORK_IDLE') {
    handleNetworkIdle();
    return;
  }

  if (event.data.type === 'ROUTE_CHANGE') {
    networkStatus = NetworkStatus.Busy;
    abortActivePrecache();
    if (routeIdleTimer) {
      self.clearTimeout(routeIdleTimer);
    }
    routeIdleTimer = self.setTimeout(() => {
      routeIdleTimer = null;
      if (networkStatus === NetworkStatus.Busy) {
        handleNetworkIdle();
      }
    }, 2000);
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'document') {
    networkStatus = NetworkStatus.Busy;
    abortActivePrecache();
    if (routeIdleTimer) {
      self.clearTimeout(routeIdleTimer);
    }
    routeIdleTimer = self.setTimeout(() => {
      routeIdleTimer = null;
      if (networkStatus === NetworkStatus.Busy) {
        handleNetworkIdle();
      }
    }, 2000);
  }
});

console.log('[SW] Service Worker loaded with simplified single-cache architecture');
