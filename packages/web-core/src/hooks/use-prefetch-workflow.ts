import { useCallback } from 'react';

// Prefetch the Workflow page chunks
export const usePrefetchWorkflow = () => {
  const prefetch = useCallback(() => {
    // Prefetch workflow page (includes Canvas component and its dependencies)
    // Use webpackPrefetch magic comment to explicitly specify low-priority prefetch
    // The workflow page will automatically include all its dependencies like @xyflow/react
    // which will be separated into vendor chunks by the splitChunks configuration
    // import(/* webpackPrefetch: true */ '../pages/workflow')
    //   .then(() => {
    //     console.log('[Prefetch] Workflow page loaded');
    //   })
    //   .catch((err) => {
    //     console.warn('[Prefetch] Failed to prefetch workflow:', err);
    //   });
  }, []);

  return prefetch;
};
