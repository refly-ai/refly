/**
 * copy-to-clipboard lazy loader
 */

import { createLazyLoader } from '../core';

type CopyFn = (text: string, options?: { debug?: boolean; format?: string }) => boolean;

/**
 * copy-to-clipboard lazy loader
 */
export const copyToClipboardLoader = createLazyLoader<CopyFn>({
  name: 'copy-to-clipboard',
  loader: () => import('copy-to-clipboard'),
});

/**
 * Get the copy function
 */
export const getCopyToClipboard = (): Promise<CopyFn> => copyToClipboardLoader.get();

/**
 * Copy text to clipboard
 */
export async function copyText(
  text: string,
  options?: { debug?: boolean; format?: string },
): Promise<boolean> {
  const copy = await getCopyToClipboard();
  return copy(text, options);
}

/**
 * Copy HTML to clipboard
 */
export async function copyHtml(html: string): Promise<boolean> {
  const copy = await getCopyToClipboard();
  return copy(html, { format: 'text/html' });
}
