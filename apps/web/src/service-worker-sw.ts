/// <reference lib="webworker" />

/**
 * Custom Service Worker with Background Precaching
 * This file runs in Service Worker context, not page context
 *
 * Benefits:
 * 1. Works on any page that registers this SW (main app, activity pages, etc.)
 * 2. Independent of page lifecycle
 * 3. More reliable - continues running even after pages close
 */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { PrecacheEntry } from 'workbox-precaching';

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }
}

declare const __PRECACHE_MANIFEST_URL__: string;

type CacheWillUpdatePlugin = {
  cacheWillUpdate?: (args: {
    request: Request;
    response: Response;
    event: ExtendableEvent;
  }) => Promise<Response | null | undefined>;
};

// TypeScript declarations for Service Worker context
declare const self: ServiceWorkerGlobalScope;

const getClientId = (event: ExtendableEvent): string | null => {
  if ('clientId' in event) {
    return (event as FetchEvent).clientId || null;
  }
  return null;
};

// Precache all files listed in the manifest (Stage 1: Critical resources)
precacheAndRoute(self.__WB_MANIFEST);

// PWA basics
self.skipWaiting();

// ============================================================================
// Runtime Caching Strategies
// ============================================================================

// === Strategy 0: Home page - NetworkOnly ===
registerRoute(
  ({ request, url }) => request.destination === 'document' && url.pathname === '/',
  new NetworkOnly(),
);

// === Strategy 1: HTML (non-home) - StaleWhileRevalidate with version check ===
registerRoute(
  ({ request, url }) => request.destination === 'document' && url.pathname !== '/',
  new StaleWhileRevalidate({
    cacheName: 'html-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
      {
        cacheWillUpdate: async ({ request, response, event }) => {
          // Only cache successful responses
          if (!response || response.status !== 200) {
            return null;
          }

          // Get cached HTML for version comparison
          const cache = await caches.open('html-cache-v1');
          const cachedResponse = await cache.match(request);

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

              // If version changed, notify the client
              if (newVersion && oldVersion && newVersion !== oldVersion) {
                console.log('[SW] New version detected! Notifying client:', clientId);

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

// === Strategy 2: Core JS chunks (not async) - CacheFirst ===
registerRoute(
  ({ url }) => url.pathname.endsWith('.js') && !url.pathname.includes('/async/'),
  new CacheFirst({
    cacheName: 'js-cache-v4',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  }),
);

// === Strategy 3: Async JS chunks - CacheFirst ===
registerRoute(
  ({ url }) => url.pathname.endsWith('.js') && url.pathname.includes('/async/'),
  new CacheFirst({
    cacheName: 'js-async-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  }),
);

// === Strategy 4: CSS - CacheFirst ===
registerRoute(
  ({ url }) => url.pathname.endsWith('.css'),
  new CacheFirst({
    cacheName: 'css-cache-v4',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  }),
);

// === Strategy 5: Images - CacheFirst ===
registerRoute(
  ({ url }) => /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);

// === Strategy 6: Fonts - CacheFirst ===
registerRoute(
  ({ url }) => /\.(?:woff|woff2|ttf|eot)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  }),
);

// === Strategy 7: Google Fonts ===
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  }),
);

// ============================================================================
// Background Precaching (Stage 2)
// Runs in Service Worker context - works on any page with this SW
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
    const precacher = new ServiceWorkerBackgroundPrecache();
    precacher
      .precacheResources(resourcesToResume)
      .then(() => {
        if (!pendingResources || pendingResources.length === 0) {
          console.log('[SW Background Precache] Completed after resume');
        }
      })
      .catch((error) => {
        console.error('[SW Background Precache] Error after resume:', error);
      });
  }, 3000);
};

/**
 * Background precache manager running in Service Worker context
 */
class ServiceWorkerBackgroundPrecache {
  private isRunning = false;

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
   * Get list of resources to precache
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
      // Get all cached resources first to know what we already have
      const cachedUrls = new Set<string>();
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (const request of requests) {
          cachedUrls.add(request.url);
        }
      }

      console.log('[SW Background Precache] Already cached:', cachedUrls.size, 'resources');

      // Method 1: Try to fetch precache manifest based on chunk graph
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

    // Prioritize resources
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
   * Filter resources based on connection mode
   */
  private shouldPrecacheUrl(url: string, mode: PrecacheMode): boolean {
    if (mode === 'full') {
      return true;
    }

    const isCoreJs = /\/static\/js\/(index|lib-react|lib-router)\.[a-f0-9]+\.js$/.test(url);
    const isCoreCss = /\/static\/css\/index\.[a-f0-9]+\.css$/.test(url);
    const isWorkspaceWorkflowJs =
      /\/static\/js\/async\/group-(workflow|workspace)[^/]*\.[a-f0-9]+\.js$/.test(url);
    const isWorkspaceWorkflowCss =
      /\/static\/css\/async\/group-(workflow|workspace)[^/]*\.[a-f0-9]+\.css$/.test(url);

    return isCoreJs || isCoreCss || isWorkspaceWorkflowJs || isWorkspaceWorkflowCss;
  }

  /**
   * Precache resources with throttling
   */
  public async precacheResources(resources: string[]) {
    await this.precacheWithThrottle(resources);
  }

  private async precacheWithThrottle(resources: string[]) {
    const chunks = this.chunkArray(resources, PRECACHE_CONFIG.maxConcurrent);

    for (let i = 0; i < chunks.length; i++) {
      if (isNetworkBusy()) {
        pendingResources = resources.slice(i * PRECACHE_CONFIG.maxConcurrent);
        return;
      }

      const chunk = chunks[i];

      // Fetch chunk concurrently
      await Promise.all(
        chunk.map((url) => {
          const controller = new AbortController();
          activePrecacheControllers.add(controller);
          return fetch(url, {
            cache: 'default',
            signal: controller.signal,
          })
            .catch((error) => {
              if (error?.name !== 'AbortError') {
                console.warn('[SW Background Precache] Failed to fetch:', url, error);
              }
            })
            .finally(() => {
              activePrecacheControllers.delete(controller);
            });
        }),
      );

      if (isNetworkBusy()) {
        pendingResources = resources.slice(i * PRECACHE_CONFIG.maxConcurrent);
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
// Service Worker Lifecycle Events
// ============================================================================

// Start background precaching after activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');

  event.waitUntil(
    (async () => {
      // Claim clients immediately
      await self.clients.claim();

      // Start background precaching
      const precacher = new ServiceWorkerBackgroundPrecache();
      await precacher.start();
    })(),
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  // Handle connection check requests
  if (event.data.type === 'CHECK_CONNECTION') {
    // Client will respond via the message port
    // This is handled by the client code
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

console.log('[SW] Service Worker loaded with background precaching support');
