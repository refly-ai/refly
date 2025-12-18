interface PreloadImageOptions {
  withLink?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
}

/**
 * Preload an image by creating an img element and optional link preload tag.
 * Returns a cleanup function to remove injected elements.
 */
export const preloadImage = (
  src: string,
  options?: PreloadImageOptions,
): (() => void) | undefined => {
  if (!src) {
    return undefined;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }

  const withLink = options?.withLink ?? true;
  const crossOrigin = options?.crossOrigin ?? 'anonymous';

  const img = document.createElement('img');
  img.src = src;
  img.style.display = 'none';
  if (crossOrigin) {
    img.crossOrigin = crossOrigin;
  }
  document.body.appendChild(img);

  let link: HTMLLinkElement | null = null;
  if (withLink) {
    link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    if (crossOrigin) {
      link.crossOrigin = crossOrigin;
    }
    document.head.appendChild(link);
  }

  return () => {
    link?.parentNode?.removeChild(link);
    img.parentNode?.removeChild(img);
  };
};
