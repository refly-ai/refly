/**
 * Unified Lazy Loader
 *
 * Provides a consistent API for lazy loading heavy modules with:
 * - Singleton caching
 * - Telemetry reporting (success/failure with timing)
 * - Timeout and retry support
 * - TypeScript type safety
 * - React Hooks integration
 *
 * @example
 * // Using pre-configured modules
 * import { getHighlighter, getMermaid, captureElement } from '@refly-packages/ai-workspace-common/utils/lazy-loader';
 *
 * const highlighter = await getHighlighter();
 * const mermaid = await getMermaid();
 * const canvas = await captureElement(element, options);
 *
 * @example
 * // Using React Hook
 * import { useLazyModule, mermaidLoader } from '@refly-packages/ai-workspace-common/utils/lazy-loader';
 *
 * function MyComponent() {
 *   const { module: mermaid, isLoading, error } = useLazyModule(mermaidLoader);
 *   // ...
 * }
 *
 * @example
 * // Creating custom lazy loader
 * import { createLazyLoader } from '@refly-packages/ai-workspace-common/utils/lazy-loader';
 *
 * const myLoader = createLazyLoader({
 *   name: 'my-heavy-lib',
 *   loader: () => import('my-heavy-lib'),
 *   initializer: async (lib) => {
 *     await lib.initialize();
 *     return lib;
 *   },
 *   retries: 2,
 * });
 */

// Core API
export {
  createLazyLoader,
  lazyImport,
  preloadModules,
  clearAllCache,
  getModuleStatus,
} from './core';

// Types
export type {
  LazyLoadOptions,
  LazyModule,
  LazyModuleStatus,
  LoadResult,
  LoadError,
  TelemetryEventData,
  LazyImportOptions,
} from './types';

// Pre-configured modules
export {
  // Shiki
  shikiLoader,
  getHighlighter,
  configureShiki,
  isLanguageSupported,
  getSupportedLanguages,
  // Mermaid
  mermaidLoader,
  getMermaid,
  configureMermaid,
  initializeMermaid,
  renderMermaid,
  parseMermaid,
  getMermaidConfig,
  // html2canvas
  html2canvasLoader,
  getHtml2Canvas,
  captureElement,
  captureElementAsDataUrl,
  captureElementAsBlob,
  // modern-screenshot
  modernScreenshotLoader,
  getModernScreenshot,
  domToPng,
  domToJpeg,
  domToBlob,
  domToCanvas,
  domToSvg,
  // copy-to-clipboard
  copyToClipboardLoader,
  getCopyToClipboard,
  copyText,
  copyHtml,
} from './modules';

export type { ShikiConfig, MermaidConfig, Html2CanvasOptions, ScreenshotOptions } from './modules';

// React Hooks
export { useLazyModule } from './hooks';
export type { UseLazyModuleResult, UseLazyModuleOptions } from './hooks';
