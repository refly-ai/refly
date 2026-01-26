/**
 * Shiki syntax highlighter lazy loader
 */

import type { Highlighter, BundledLanguage, BundledTheme } from 'shiki';
import { createLazyLoader } from '../core';

export interface ShikiConfig {
  langs: BundledLanguage[];
  themes: BundledTheme[];
}

// Default supported languages
const DEFAULT_LANGS: BundledLanguage[] = [
  'html',
  'css',
  'javascript',
  'typescript',
  'json',
  'jsx',
  'tsx',
  'markdown',
  'python',
  'shell',
  'sql',
  'graphql',
  'yaml',
  'xml',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
];

const DEFAULT_THEMES: BundledTheme[] = ['github-light-default'];

let currentConfig: ShikiConfig = {
  langs: DEFAULT_LANGS,
  themes: DEFAULT_THEMES,
};

/**
 * Configure Shiki (must be called before first load)
 */
export function configureShiki(config: Partial<ShikiConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Shiki highlighter lazy loader
 */
export const shikiLoader = createLazyLoader<
  (config: { langs: BundledLanguage[]; themes: BundledTheme[] }) => Promise<Highlighter>,
  Highlighter
>({
  name: 'shiki-highlighter',
  loader: () => import('shiki/bundle/full'),
  extractor: (m) => (m as any).createHighlighter,
  initializer: (createHighlighter) =>
    createHighlighter({
      langs: currentConfig.langs,
      themes: currentConfig.themes,
    }),
  timeout: 60000, // Shiki is large, allow more time
  retries: 1,
});

/**
 * Get the Shiki highlighter instance
 */
export const getHighlighter = (): Promise<Highlighter> => shikiLoader.get();

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): boolean {
  return currentConfig.langs.includes(lang as BundledLanguage);
}

/**
 * Get supported languages list
 */
export function getSupportedLanguages(): readonly BundledLanguage[] {
  return currentConfig.langs;
}
