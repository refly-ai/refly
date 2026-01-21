/**
 * Lazy loader types
 * Unified type definitions for lazy loading modules
 */

/**
 * Lazy module loading status
 */
export type LazyModuleStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Load result type
 */
export interface LoadResult<T> {
  module: T;
  loadTime: number;
  fromCache: boolean;
}

/**
 * Load error with additional context
 */
export interface LoadError extends Error {
  moduleName: string;
  loadTime: number;
  originalError: Error;
}

/**
 * Telemetry event data for reporting
 */
export interface TelemetryEventData {
  moduleName: string;
  loadTime: number;
  success: boolean;
  errorMessage?: string;
  errorStack?: string;
  fromCache: boolean;
}

/**
 * Lazy load configuration options
 */
export interface LazyLoadOptions<T, TInit = T> {
  /**
   * Unique module identifier (used for caching and telemetry)
   */
  name: string;

  /**
   * Dynamic import function
   * @example () => import('mermaid')
   */
  loader: () => Promise<unknown>;

  /**
   * Extract desired content from imported module
   * @default (m) => m.default ?? m
   */
  extractor?: (module: unknown) => T;

  /**
   * Optional initialization function, executed after module is first loaded
   * Return value will be cached as the final instance
   * @example async (mermaid) => { mermaid.initialize({...}); return mermaid; }
   */
  initializer?: (extracted: T) => Promise<TInit> | TInit;

  /**
   * Load timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Whether to cache the loaded module
   * @default true
   */
  cache?: boolean;

  /**
   * Whether to report telemetry events
   * @default true
   */
  telemetry?: boolean;

  /**
   * Number of retry attempts on failure
   * @default 0
   */
  retries?: number;

  /**
   * Delay between retries in milliseconds
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * Lazy module instance interface
 */
export interface LazyModule<T> {
  /**
   * Get module instance (triggers loading if not cached)
   */
  get: () => Promise<T>;

  /**
   * Get current loading status
   */
  getStatus: () => LazyModuleStatus;

  /**
   * Preload module without blocking (fire and forget)
   */
  preload: () => void;

  /**
   * Clear cached module
   */
  clear: () => void;

  /**
   * Module name identifier
   */
  readonly name: string;
}

/**
 * Simple lazy import options
 */
export interface LazyImportOptions {
  /**
   * Whether to report telemetry events
   * @default true
   */
  telemetry?: boolean;

  /**
   * Load timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}
