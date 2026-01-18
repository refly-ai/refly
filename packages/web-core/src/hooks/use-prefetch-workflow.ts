import { useEffect, useRef } from 'react';

/**
 * Intelligently prefetch workflow page resources on workspace page
 *
 * Strategy:
 * 1. Use requestIdleCallback to prefetch during browser idle time, doesn't block main thread
 * 2. Prefetch workflow page chunk (includes Canvas components, etc.)
 * 3. Only prefetch once, avoid repeated loading
 *
 * Use case:
 * - Called on workspace page (/workspace)
 * - User may click a workflow to enter edit page
 * - Preloading makes page transitions smoother
 *
 * Note: This only preloads the main workflow chunk (group-workflow).
 * Async dependencies will still be loaded on-demand when user accesses the page.
 * After first access, all chunks are cached by Service Worker for instant loading.
 */
export const usePrefetchWorkflow = () => {
  const hasPreloadedRef = useRef(false);

  useEffect(() => {
    // If already preloaded, don't repeat
    if (hasPreloadedRef.current) {
      return;
    }

    // Use requestIdleCallback to prefetch during browser idle time
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    const idleId = idleCallback(
      () => {
        console.log('[Workspace] Starting workflow resources prefetch...');
        hasPreloadedRef.current = true;

        // Visual debug indicator (won't be removed by removeConsole)
        if (process.env.NODE_ENV === 'production') {
          (window as any).__REFLY_PREFETCH_START__ = Date.now();
        }

        // Prefetch workflow page (includes Canvas component and dependencies)
        // Workflow page automatically imports required dependencies:
        // - @xyflow/react (Canvas core)
        // - Tiptap (rich text editor)
        // - Various workflow-related components
        import('../pages/workflow')
          .then(() => {
            console.log('[Workspace] Workflow page and dependencies loaded');
          })
          .catch((err) => {
            console.warn('[Workspace] Failed to prefetch workflow page:', err);
          });

        // Note: We don't prefetch all async chunks because:
        // 1. Would waste bandwidth (user may not need all features)
        // 2. Service Worker already caches them after first access
        // 3. Subsequent visits are already fast (~50-100ms from SW cache)
      },
      { timeout: 3000 }, // Wait max 3 seconds, force execute on timeout
    );

    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);
};
