const PENDING_REDIRECT_KEY = 'refly-pending-redirect';

/**
 * Store a pending redirect path before OAuth login or Stripe payment.
 * This allows redirecting back to the original page after the callback.
 * Only stores paths that are not workspace or root.
 */
export const storePendingRedirect = (path?: string) => {
  const targetPath = path ?? window.location.pathname + window.location.search;

  // Only store non-workspace, non-root paths (e.g., /app/wfa-xxx, /workflow-template/xxx)
  if (
    targetPath &&
    !targetPath.startsWith('/workspace') &&
    !targetPath.startsWith('/login') &&
    targetPath !== '/'
  ) {
    try {
      localStorage.setItem(PENDING_REDIRECT_KEY, targetPath);
    } catch {
      // Ignore storage errors
    }
  }
};

/**
 * Get the stored pending redirect path.
 */
export const getPendingRedirect = (): string | null => {
  try {
    return localStorage.getItem(PENDING_REDIRECT_KEY);
  } catch {
    return null;
  }
};

/**
 * Clear the pending redirect after it's been used.
 */
export const clearPendingRedirect = () => {
  try {
    localStorage.removeItem(PENDING_REDIRECT_KEY);
  } catch {
    // Ignore storage errors
  }
};

/**
 * Check if current path is the workspace page (redirect target for OAuth/payment).
 */
export const isOnWorkspacePage = (): boolean => {
  return window.location.pathname === '/workspace' || window.location.pathname === '/';
};
