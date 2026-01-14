import { useCallback } from 'react';

// Prefetch the Workflow page chunks
export const usePrefetchWorkflow = () => {
  const prefetch = useCallback(() => {
    // Dynamic import will trigger the browser to download the chunks
    // The /* webpackPrefetch: true */ comment is a hint to webpack/rspack
    // but standard dynamic import is enough for runtime discovery
    import('../pages/workflow');
  }, []);

  return prefetch;
};
