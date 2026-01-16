/**
 * html2canvas lazy loader
 */

import type Html2Canvas from 'html2canvas';
import type { Options as Html2CanvasOptions } from 'html2canvas';
import { createLazyLoader } from '../core';

/**
 * html2canvas lazy loader
 */
export const html2canvasLoader = createLazyLoader<typeof Html2Canvas>({
  name: 'html2canvas',
  loader: () => import('html2canvas'),
});

/**
 * Get html2canvas function
 */
export const getHtml2Canvas = (): Promise<typeof Html2Canvas> => html2canvasLoader.get();

/**
 * Capture an element as a canvas
 */
export async function captureElement(
  element: HTMLElement,
  options?: Partial<Html2CanvasOptions>,
): Promise<HTMLCanvasElement> {
  const html2canvas = await getHtml2Canvas();
  return html2canvas(element, options);
}

/**
 * Capture an element and convert to data URL
 */
export async function captureElementAsDataUrl(
  element: HTMLElement,
  options?: Partial<Html2CanvasOptions>,
  type?: string,
  quality?: number,
): Promise<string> {
  const canvas = await captureElement(element, options);
  return canvas.toDataURL(type || 'image/png', quality);
}

/**
 * Capture an element and convert to Blob
 */
export async function captureElementAsBlob(
  element: HTMLElement,
  options?: Partial<Html2CanvasOptions>,
  type?: string,
  quality?: number,
): Promise<Blob | null> {
  const canvas = await captureElement(element, options);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type || 'image/png', quality);
  });
}

// Re-export types for convenience
export type { Html2CanvasOptions };
