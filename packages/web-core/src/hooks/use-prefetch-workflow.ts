import { useEffect, useRef } from 'react';

/**
 * Intelligently prefetch workflow page resources on workspace page
 *
 * Strategy:
 * 1. Use requestIdleCallback to prefetch during browser idle time, doesn't block main thread
 * 2. Prefetch workflow page chunk (includes Canvas components, etc.)
 * 3. Prefetch key libraries required by workflow (@xyflow/react)
 * 4. Only prefetch once, avoid repeated loading
 *
 * Use case:
 * - Called on workspace page (/workspace)
 * - User may click a workflow to enter edit page
 * - Preloading makes page transitions smoother
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

        // Note: Don't prefetch Monaco Editor because it's large (~2MB) and not all users will use it
        // Monaco loads on-demand when user actually opens code editor
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
