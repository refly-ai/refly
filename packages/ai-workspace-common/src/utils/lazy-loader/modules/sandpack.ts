/**
 * Sandpack code sandbox lazy loader
 * Heavy dependency (~500KB+) that includes CodeMirror
 */

import { createLazyLoader } from '../core';

// Types for the Sandpack module exports
interface SandpackModuleExports {
  SandpackProvider: React.ComponentType<any>;
  SandpackPreview: React.ComponentType<any>;
  useSandpack: () => any;
}

/**
 * Sandpack lazy loader
 */
export const sandpackLoader = createLazyLoader<SandpackModuleExports, SandpackModuleExports>({
  name: 'sandpack-react',
  loader: () => import('@codesandbox/sandpack-react/unstyled'),
  extractor: (m) => m as SandpackModuleExports,
  timeout: 60000, // Longer timeout due to size
  cache: true,
  retries: 2,
});

/**
 * Get the Sandpack module
 */
export const getSandpack = (): Promise<SandpackModuleExports> => sandpackLoader.get();

/**
 * Preload Sandpack (call when user is likely to need it soon)
 */
export const preloadSandpack = (): void => sandpackLoader.preload();
