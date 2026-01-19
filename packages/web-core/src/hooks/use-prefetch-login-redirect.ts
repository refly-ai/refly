import { useEffect } from 'react';

/**
 * Route matching rules - Match page chunks based on path
 */
const ROUTE_CHUNK_MAP: Array<{
  pattern: RegExp;
  loader: () => Promise<any>;
  name: string;
}> = [
  {
    pattern: /^\/workspace$/,
    loader: () => import('../pages/workspace'),
    name: 'workspace',
  },
  {
    pattern: /^\/workflow\/[^/]+$/,
    loader: () => import('../pages/workflow'),
    name: 'workflow',
  },
  {
    pattern: /^\/workflow-list$/,
    loader: () => import('../pages/workflow-list'),
    name: 'workflow-list',
  },
  {
    pattern: /^\/run-history(\/[^/]+)?$/,
    loader: () => import('../pages/run-history'),
    name: 'run-history',
  },
  {
    pattern: /^\/marketplace$/,
    loader: () => import('../pages/marketplace'),
    name: 'marketplace',
  },
  {
    pattern: /^\/pricing$/,
    loader: () => import('../pages/pricing'),
    name: 'pricing',
  },
  {
    pattern: /^\/workflow-template\/[^/]+$/,
    loader: () => import('../pages/workflow-app'),
    name: 'workflow-app',
  },
  {
    pattern: /^\/share\/canvas\/[^/]+$/,
    loader: () => import('../pages/share'),
    name: 'share-canvas',
  },
];

/**
 * Match and prefetch corresponding page chunk based on path
 */
const prefetchPageChunk = (pathname: string): void => {
  // Find matching route rule
  const matchedRoute = ROUTE_CHUNK_MAP.find((route) => route.pattern.test(pathname));

  if (matchedRoute) {
    console.log(`[Login Prefetch] Preloading chunk for: ${matchedRoute.name} (${pathname})`);
    matchedRoute
      .loader()
      .then(() => {
        console.log(`[Login Prefetch] Successfully loaded chunk: ${matchedRoute.name}`);
      })
      .catch((error) => {
        console.warn(`[Login Prefetch] Failed to load chunk ${matchedRoute.name}:`, error);
      });
  } else {
    console.log(`[Login Prefetch] No matching route found for: ${pathname}`);
  }
};

/**
 * Intelligently prefetch page that may be redirected to after login
 *
 * Logic:
 * 1. If returnUrl parameter exists, prefetch corresponding page chunk
 * 2. If no returnUrl, default prefetch workspace page (default post-login destination)
 *
 * Features:
 * - Uses requestIdleCallback to prefetch during browser idle time, doesn't block main thread
 * - Uses dynamic import() to prefetch actual JS chunk, not HTML
 * - Supports path matching, automatically identifies page to prefetch
 *
 * @param returnUrl - Target URL to redirect to after login (optional)
 */
export const usePrefetchLoginRedirect = (returnUrl?: string | null) => {
  useEffect(() => {
    // Use requestIdleCallback to prefetch during browser idle time
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    const idleId = idleCallback(() => {
      if (returnUrl) {
        // Has returnUrl - parse and prefetch corresponding page
        try {
          const decodedUrl = decodeURIComponent(returnUrl);
          // Extract path part (remove query params and hash)
          const urlPath = decodedUrl.split('?')[0]?.split('#')[0];

          // Check if it's an internal path
          if (urlPath?.startsWith('/')) {
            prefetchPageChunk(urlPath);
          } else {
            // External URL doesn't need prefetching
            console.log('[Login Prefetch] External URL, skipping prefetch:', urlPath);
          }
        } catch (error) {
          console.warn('[Login Prefetch] Failed to parse returnUrl:', error);
        }
      } else {
        // No returnUrl - default prefetch workspace (default post-login destination)
        console.log('[Login Prefetch] No returnUrl, preloading default: workspace');
        prefetchPageChunk('/workspace');
      }
    });

    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [returnUrl]);
};
