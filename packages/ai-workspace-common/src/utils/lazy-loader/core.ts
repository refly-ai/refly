/**
 * Core lazy loader implementation
 * Provides unified lazy loading with caching, retry, timeout and telemetry
 */

import type {
  LazyLoadOptions,
  LazyModule,
  LazyModuleStatus,
  LoadError,
  LazyImportOptions,
} from './types';
import { reportLoadSuccess, reportLoadError } from './telemetry';

// Global cache storage
const moduleCache = new Map<string, unknown>();
const promiseCache = new Map<string, Promise<unknown>>();
const statusCache = new Map<string, LazyModuleStatus>();

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number, moduleName: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Module "${moduleName}" load timeout after ${ms}ms`));
    }, ms);
  });
}

/**
 * Delay function for retry mechanism
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default extractor - gets default export or the module itself
 */
function defaultExtractor<T>(module: unknown): T {
  if (module && typeof module === 'object' && 'default' in module) {
    return (module as { default: T }).default;
  }
  return module as T;
}

/**
 * Create a lazy loader for a module
 *
 * @example
 * // Simple usage - get default export
 * const html2canvasLoader = createLazyLoader({
 *   name: 'html2canvas',
 *   loader: () => import('html2canvas'),
 * });
 *
 * @example
 * // With initialization - e.g., mermaid needs initialize()
 * const mermaidLoader = createLazyLoader({
 *   name: 'mermaid',
 *   loader: () => import('mermaid'),
 *   initializer: async (mermaid) => {
 *     mermaid.initialize({ startOnLoad: false, theme: 'default' });
 *     return mermaid;
 *   },
 * });
 *
 * @example
 * // With factory function - e.g., shiki needs createHighlighter
 * const shikiLoader = createLazyLoader({
 *   name: 'shiki',
 *   loader: () => import('shiki/bundle/web'),
 *   extractor: (m) => m.createHighlighter,
 *   initializer: (createHighlighter) =>
 *     createHighlighter({ langs: ['typescript'], themes: ['github-light'] }),
 * });
 */
export function createLazyLoader<T, TInit = T>(
  options: LazyLoadOptions<T, TInit>,
): LazyModule<TInit> {
  const {
    name,
    loader,
    extractor = defaultExtractor as (module: unknown) => T,
    initializer,
    timeout = 30000,
    cache = true,
    telemetry = true,
    retries = 0,
    retryDelay = 1000,
  } = options;

  // Initialize status
  if (!statusCache.has(name)) {
    statusCache.set(name, 'idle');
  }

  /**
   * Execute a single load attempt
   */
  async function executeLoad(): Promise<TInit> {
    const imported = await loader();
    const extracted = extractor(imported);

    if (initializer) {
      return await initializer(extracted);
    }
    return extracted as unknown as TInit;
  }

  /**
   * Load with retry mechanism
   */
  async function loadWithRetry(attempt = 0): Promise<TInit> {
    try {
      return await executeLoad();
    } catch (error) {
      if (attempt < retries) {
        await delay(retryDelay);
        return loadWithRetry(attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Core load function
   */
  async function load(): Promise<TInit> {
    // Check cache first
    if (cache && moduleCache.has(name)) {
      if (telemetry) {
        reportLoadSuccess({
          moduleName: name,
          loadTime: 0,
          success: true,
          fromCache: true,
        });
      }
      return moduleCache.get(name) as TInit;
    }

    // Check if already loading
    if (promiseCache.has(name)) {
      return promiseCache.get(name) as Promise<TInit>;
    }

    // Start new load
    statusCache.set(name, 'loading');
    const startTime = performance.now();

    const loadPromise = Promise.race([loadWithRetry(), createTimeoutPromise(timeout, name)])
      .then((result) => {
        const loadTime = Math.round(performance.now() - startTime);

        // Cache result
        if (cache) {
          moduleCache.set(name, result);
        }
        statusCache.set(name, 'loaded');
        promiseCache.delete(name);

        // Report telemetry
        if (telemetry) {
          reportLoadSuccess({
            moduleName: name,
            loadTime,
            success: true,
            fromCache: false,
          });
        }

        return result;
      })
      .catch((error: Error) => {
        const loadTime = Math.round(performance.now() - startTime);
        statusCache.set(name, 'error');
        promiseCache.delete(name);

        // Report telemetry
        if (telemetry) {
          reportLoadError({
            moduleName: name,
            loadTime,
            success: false,
            fromCache: false,
            errorMessage: error?.message,
            errorStack: error?.stack,
          });
        }

        // Construct detailed error
        const loadError: LoadError = Object.assign(
          new Error(`Failed to load module "${name}": ${error?.message}`),
          {
            moduleName: name,
            loadTime,
            originalError: error,
          },
        );

        throw loadError;
      });

    promiseCache.set(name, loadPromise);
    return loadPromise;
  }

  return {
    name,
    get: load,
    getStatus: () => statusCache.get(name) || 'idle',
    preload: () => {
      load().catch(() => {
        // Silent failure for preload
      });
    },
    clear: () => {
      moduleCache.delete(name);
      promiseCache.delete(name);
      statusCache.set(name, 'idle');
    },
  };
}

/**
 * Simple one-time lazy import function
 * Suitable for scenarios that don't need cache management
 *
 * @example
 * const html2canvas = await lazyImport('html2canvas', () => import('html2canvas'));
 */
export async function lazyImport<T>(
  name: string,
  loader: () => Promise<{ default: T } | T>,
  options?: LazyImportOptions,
): Promise<T> {
  const { telemetry = true, timeout = 30000 } = options || {};
  const startTime = performance.now();

  try {
    const loadPromise = loader().then((m) => {
      if (m && typeof m === 'object' && 'default' in m) {
        return m.default;
      }
      return m as T;
    });

    const result = await Promise.race([loadPromise, createTimeoutPromise(timeout, name)]);

    const loadTime = Math.round(performance.now() - startTime);

    if (telemetry) {
      reportLoadSuccess({
        moduleName: name,
        loadTime,
        success: true,
        fromCache: false,
      });
    }

    return result;
  } catch (error) {
    const loadTime = Math.round(performance.now() - startTime);
    const err = error as Error;

    if (telemetry) {
      reportLoadError({
        moduleName: name,
        loadTime,
        success: false,
        fromCache: false,
        errorMessage: err?.message,
        errorStack: err?.stack,
      });
    }

    throw error;
  }
}

/**
 * Batch preload multiple modules
 */
export function preloadModules(modules: LazyModule<unknown>[]): void {
  for (const m of modules) {
    m.preload();
  }
}

/**
 * Clear all cached modules
 */
export function clearAllCache(): void {
  moduleCache.clear();
  promiseCache.clear();
  statusCache.clear();
}

/**
 * Get the status of a module by name
 */
export function getModuleStatus(name: string): LazyModuleStatus {
  return statusCache.get(name) || 'idle';
}
