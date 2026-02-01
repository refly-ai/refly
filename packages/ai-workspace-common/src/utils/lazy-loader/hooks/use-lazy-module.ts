/**
 * React Hook for lazy loading modules
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LazyModule, LazyModuleStatus } from '../types';

export interface UseLazyModuleResult<T> {
  /** Module instance, null before loaded */
  module: T | null;
  /** Current loading status */
  status: LazyModuleStatus;
  /** Loading error if any */
  error: Error | null;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether loaded successfully */
  isLoaded: boolean;
  /** Whether loading failed */
  isError: boolean;
  /** Manually trigger load */
  load: () => Promise<T>;
  /** Reload (clear cache and load again) */
  reload: () => Promise<T>;
}

export interface UseLazyModuleOptions<T> {
  /** Whether to load immediately, default true */
  immediate?: boolean;
  /** Callback when load completes */
  onLoad?: (module: T) => void;
  /** Callback when load fails */
  onError?: (error: Error) => void;
}

/**
 * React Hook for lazy loading modules
 *
 * @example
 * const { module: mermaid, isLoading, error } = useLazyModule(mermaidLoader);
 *
 * useEffect(() => {
 *   if (mermaid) {
 *     mermaid.render('diagram', code);
 *   }
 * }, [mermaid, code]);
 *
 * @example
 * // With callbacks
 * const { module, load } = useLazyModule(shikiLoader, {
 *   immediate: false,
 *   onLoad: (highlighter) => console.log('Loaded!'),
 *   onError: (err) => console.error('Failed:', err),
 * });
 *
 * // Later trigger load manually
 * await load();
 */
export function useLazyModule<T>(
  loader: LazyModule<T>,
  options: UseLazyModuleOptions<T> = {},
): UseLazyModuleResult<T> {
  const { immediate = true, onLoad, onError } = options;

  const [module, setModule] = useState<T | null>(null);
  const [status, setStatus] = useState<LazyModuleStatus>(loader.getStatus());
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const load = useCallback(async (): Promise<T> => {
    if (loadingRef.current) {
      return loader.get();
    }

    loadingRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const result = await loader.get();

      if (mountedRef.current) {
        setModule(result);
        setStatus('loaded');
        onLoad?.(result);
      }

      return result;
    } catch (err) {
      const e = err as Error;

      if (mountedRef.current) {
        setError(e);
        setStatus('error');
        onError?.(e);
      }

      throw e;
    } finally {
      loadingRef.current = false;
    }
  }, [loader, onLoad, onError]);

  const reload = useCallback(async (): Promise<T> => {
    loader.clear();
    return load();
  }, [loader, load]);

  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      load().catch(() => {
        // Error already handled in load
      });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [immediate, load]);

  return {
    module,
    status,
    error,
    isLoading: status === 'loading',
    isLoaded: status === 'loaded',
    isError: status === 'error',
    load,
    reload,
  };
}
