import md5 from 'md5';
import { v4 as UUIDV4 } from 'uuid';
export * from './content';
export * from './parse';
export * from './credit';

export const genUniqueId = () => {
  const uuid = UUIDV4();
  const timestamp = new Date().getTime();
  const randomString =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const id = `${uuid}${timestamp}${randomString}`;
  return md5(id);
};

/**
 * Attempt to restore window/document focus before clipboard operations.
 * This improves success rate when the page may have lost focus.
 */
function tryRestoreFocus(): void {
  try {
    // Only attempt focus restoration if document doesn't have focus
    if (typeof document !== 'undefined' && !document.hasFocus()) {
      // Try to regain window focus
      window?.focus?.();
    }
  } catch {
    // Ignore focus restoration errors
  }
}

/**
 * Copy plain text to system clipboard with best-effort fallbacks.
 * Includes focus restoration attempts to improve success rate after async operations.
 *
 * Returns true when the copy operation is believed to have succeeded,
 * otherwise returns false.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Attempt to restore focus before clipboard operations
  tryRestoreFocus();

  // Prefer modern async clipboard API when available
  try {
    const hasNavigator = typeof navigator !== 'undefined';
    const hasClipboard = hasNavigator && !!navigator?.clipboard?.writeText;

    if (hasClipboard) {
      // Try requesting permission info if supported (Chromium). Ignore errors silently.
      try {
        // PermissionName cast is safe across browsers that support Permissions API
        const permissions: any = (navigator as any)?.permissions;
        if (permissions?.query) {
          await permissions
            .query({ name: 'clipboard-write' as PermissionName })
            .catch(() => undefined);
        }
      } catch {
        // No-op: continue to writeText attempt
      }

      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy fallback
  }

  // Legacy fallback using execCommand('copy')
  try {
    const hasDocument = typeof document !== 'undefined';
    if (!hasDocument) return false;

    // Try focus restoration again before legacy approach
    tryRestoreFocus();

    // Fallback: use a temporary textarea selection (most reliable legacy approach)
    const textarea = document.createElement('textarea');
    textarea.value = text ?? '';
    textarea.setAttribute('readonly', '');
    // Position off-screen but still selectable
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    // Prevent zoom on iOS
    textarea.style.fontSize = '16px';

    document.body.appendChild(textarea);

    // Force focus and selection
    textarea.focus({ preventScroll: true });
    textarea.select();
    // Ensure full selection on iOS
    textarea.setSelectionRange(0, textarea.value.length);

    const successful = document.execCommand ? document.execCommand('copy') : false;
    document.body.removeChild(textarea);

    if (successful) {
      return true;
    }

    // Last resort: try 'copy' event approach (works in some Safari cases)
    let copySucceeded = false;
    const onCopy = (e: ClipboardEvent) => {
      try {
        e.clipboardData?.setData('text/plain', text ?? '');
        e.preventDefault();
        copySucceeded = true;
      } catch {
        // Ignore
      }
    };
    document.addEventListener('copy', onCopy);
    document.execCommand?.('copy');
    document.removeEventListener('copy', onCopy);

    return copySucceeded;
  } catch {
    // As a last resort, report failure
    return false;
  }
}

export const downloadPlugin = async () => {
  window.open('http://localhost:5173/');
};

export const openGetStartDocument = async () => {
  window.open('https://refly.ai/docs');
};
