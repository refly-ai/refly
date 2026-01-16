/**
 * modern-screenshot lazy loader
 */

import type * as ModernScreenshot from 'modern-screenshot';
import { createLazyLoader } from '../core';

/**
 * modern-screenshot lazy loader
 */
export const modernScreenshotLoader = createLazyLoader<typeof ModernScreenshot>({
  name: 'modern-screenshot',
  loader: () => import('modern-screenshot'),
  extractor: (m) => m as typeof ModernScreenshot, // Get the whole module
  cache: true,
});

/**
 * Get the modern-screenshot module
 */
export const getModernScreenshot = (): Promise<typeof ModernScreenshot> =>
  modernScreenshotLoader.get();

/**
 * Convert a DOM node to PNG data URL
 */
export async function domToPng(node: Node, options?: ModernScreenshot.Options): Promise<string> {
  const ms = await getModernScreenshot();
  return ms.domToPng(node, options);
}

/**
 * Convert a DOM node to JPEG data URL
 */
export async function domToJpeg(node: Node, options?: ModernScreenshot.Options): Promise<string> {
  const ms = await getModernScreenshot();
  return ms.domToJpeg(node, options);
}

/**
 * Convert a DOM node to Blob
 */
export async function domToBlob(node: Node, options?: ModernScreenshot.Options): Promise<Blob> {
  const ms = await getModernScreenshot();
  return ms.domToBlob(node, options);
}

/**
 * Convert a DOM node to Canvas
 */
export async function domToCanvas(
  node: Node,
  options?: ModernScreenshot.Options,
): Promise<HTMLCanvasElement> {
  const ms = await getModernScreenshot();
  return ms.domToCanvas(node, options);
}

/**
 * Convert a DOM node to SVG data URL
 */
export async function domToSvg(node: Node, options?: ModernScreenshot.Options): Promise<string> {
  const ms = await getModernScreenshot();
  return ms.domToSvg(node, options);
}

// Re-export types for convenience
export type { ModernScreenshot };
export type ScreenshotOptions = ModernScreenshot.Options;
