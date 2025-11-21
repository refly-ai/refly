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
 * Copy plain text to system clipboard with best-effort fallbacks.
 *
 * Returns true when the copy operation is believed to have succeeded,
 * otherwise returns false.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
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

    // Attempt 'copy' event approach first (works in some Safari cases)
    let copySucceeded = false;
    const onCopy = (e: ClipboardEvent) => {
      try {
        e.clipboardData?.setData('text/plain', text ?? '');
        e.preventDefault();
        copySucceeded = true;
      } catch {
        // Ignore and continue to textarea approach
      }
    };
    document.addEventListener('copy', onCopy);
    // execCommand returns boolean in some browsers
    const execCopySupported = document.execCommand?.('copy');
    document.removeEventListener('copy', onCopy);
    if (execCopySupported && copySucceeded) {
      return true;
    }

    // Fallback: use a temporary textarea selection
    const textarea = document.createElement('textarea');
    textarea.value = text ?? '';
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const successful = document.execCommand ? document.execCommand('copy') : false;
    document.body.removeChild(textarea);
    return !!successful;
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
