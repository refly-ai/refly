/**
 * Mermaid diagram renderer lazy loader
 */

import type MermaidAPI from 'mermaid';
import { createLazyLoader } from '../core';

export interface MermaidConfig {
  startOnLoad?: boolean;
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  securityLevel?: 'strict' | 'loose' | 'antiscript' | 'sandbox';
  fontFamily?: string;
}

let mermaidConfig: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  fontFamily: 'inherit',
};

/**
 * Configure Mermaid (can be called after load to reconfigure)
 */
export function configureMermaid(config: Partial<MermaidConfig>): void {
  mermaidConfig = { ...mermaidConfig, ...config };
  // If already loaded, apply config immediately
  if (mermaidLoader.getStatus() === 'loaded') {
    mermaidLoader.get().then((m) => m.initialize(mermaidConfig));
  }
}

/**
 * Mermaid lazy loader
 */
export const mermaidLoader = createLazyLoader<typeof MermaidAPI, typeof MermaidAPI>({
  name: 'mermaid',
  loader: () => import('mermaid'),
  initializer: (mermaid) => {
    mermaid.initialize(mermaidConfig);
    return mermaid;
  },
  retries: 1,
});

/**
 * Get the Mermaid instance
 */
export const getMermaid = (): Promise<typeof MermaidAPI> => mermaidLoader.get();

/**
 * Initialize Mermaid with dark mode
 */
export async function initializeMermaid(isDarkMode: boolean): Promise<void> {
  configureMermaid({ theme: isDarkMode ? 'dark' : 'default' });
}

/**
 * Render a Mermaid diagram
 */
export async function renderMermaid(
  id: string,
  code: string,
): Promise<{ svg: string; bindFunctions?: (element: Element) => void }> {
  const mermaid = await getMermaid();
  // Validate syntax first
  await mermaid.parse(code);
  return mermaid.render(id, code);
}

/**
 * Parse Mermaid code (validate syntax)
 */
export async function parseMermaid(code: string): Promise<void> {
  const mermaid = await getMermaid();
  await mermaid.parse(code);
}

/**
 * Get current Mermaid config
 */
export function getMermaidConfig(): MermaidConfig {
  return { ...mermaidConfig };
}
