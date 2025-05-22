import { loader, Monaco } from '@monaco-editor/react';
import { PRIMARY_CDN, FALLBACK_CDN2, FALLBACK_CDN3 } from './constants';

const CDNs = [
  { name: 'PRIMARY_CDN', url: PRIMARY_CDN },
  { name: 'FALLBACK_CDN2', url: FALLBACK_CDN2 },
  { name: 'FALLBACK_CDN3', url: FALLBACK_CDN3 },
];

let preloadingAttempted = false;
let preloadingSucceeded = false;

/**
 * Tries to load Monaco Editor from a list of CDNs sequentially.
 * @param cdnIndex The current index of the CDN to try from the CDNs array.
 */
const tryLoadMonacoRecursive = async (cdnIndex: number): Promise<Monaco | null> => {
  if (cdnIndex >= CDNs.length) {
    console.warn('[MonacoPreloader] All CDN preload attempts failed.');
    return null;
  }

  const currentCdn = CDNs[cdnIndex];
  console.log(
    `[MonacoPreloader] Attempting to preload Monaco Editor from: ${currentCdn.name} (${currentCdn.url})`,
  );

  try {
    loader.config({
      paths: {
        vs: currentCdn.url,
      },
      // Fix for language bundle loading issues
      'vs/nls': {
        availableLanguages: {},
      },
    });

    const monacoInstance = await loader.init();
    console.log(
      `[MonacoPreloader] Monaco Editor preloaded successfully from: ${currentCdn.name} (${currentCdn.url})`,
      monacoInstance,
    );
    preloadingSucceeded = true;
    return monacoInstance;
  } catch (error) {
    console.warn(
      `[MonacoPreloader] Failed to preload Monaco Editor from ${currentCdn.name} (${currentCdn.url}):`,
      error,
    );
    // Try the next CDN
    return tryLoadMonacoRecursive(cdnIndex + 1);
  }
};

/**
 * Initializes and preloads the Monaco Editor, trying multiple CDNs if necessary.
 * Call this function early in your application's lifecycle,
 * e.g., in your main App component or a similar top-level component.
 * This function ensures preloading is attempted only once.
 */
export const preloadMonacoEditor = (): void => {
  if (preloadingAttempted) {
    console.log(
      '[MonacoPreloader] Preloading already attempted. Current status (succeeded):',
      preloadingSucceeded,
    );
    return;
  }
  preloadingAttempted = true;

  tryLoadMonacoRecursive(0)
    .then((monacoInstance) => {
      if (monacoInstance) {
        // Optional: You can perform any global Monaco configurations here if needed.
        // For example, setting global compiler options for TypeScript:
        // if (monacoInstance.languages && monacoInstance.languages.typescript) {
        //   monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
        //     // your global compiler options here
        //   });
        // }
      } else {
        // This case is already handled by the last log in tryLoadMonacoRecursive
      }
    })
    .catch((error) => {
      // This catch is unlikely to be hit due to the recursive try-catch,
      // but included for robustness.
      console.error('[MonacoPreloader] Unexpected error during preload sequence:', error);
    });
};
