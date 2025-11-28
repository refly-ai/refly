import { memo, useEffect } from 'react';
import { LightLoading } from '@refly/ui-kit';

interface BackendRedirectProps {
  /** Optional absolute URL; if provided, it will be used directly */
  absoluteUrl?: string;
  /** Optional path to append to current origin, defaults to '/' */
  targetPath?: string;
}

/**
 * Redirects user to a backend-served page. Useful for forcing server-side routing.
 * Uses current page origin instead of API endpoint to avoid redirecting to API server.
 * Handles same-path (e.g. '/') case by forcing a one-time hard reload using sessionStorage marker,
 * so that edge worker (e.g. Cloudflare Worker) can serve the configured page without query params.
 */
const BackendRedirect = ({ absoluteUrl, targetPath = '/' }: BackendRedirectProps) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Use current page origin instead of serverOrigin (API endpoint) to avoid redirecting to API server
    const base = window.location.origin;
    const url = absoluteUrl ?? `${base}${targetPath ?? '/'}`;
    const targetUrl = new URL(url);
    const currentUrl = new URL(window.location.href);
    const storageKey = '__backend_redirect_once';

    // If path is the same (e.g., '/'), force a one-time hard reload with a session flag.
    // The flag prevents infinite loops in environments where the SPA still serves the same route.
    if (targetUrl.pathname === currentUrl.pathname) {
      let alreadyRedirected = false;
      try {
        alreadyRedirected = window.sessionStorage?.getItem(storageKey) === '1';
      } catch {
        // Ignore storage errors and fallback to reload-once behavior
      }
      if (!alreadyRedirected) {
        try {
          window.sessionStorage?.setItem(storageKey, '1');
        } catch {
          // Ignore storage errors
        }
        // Force a full reload so edge worker can handle '/'
        window.location.reload();
      } else {
        try {
          window.sessionStorage?.removeItem(storageKey);
        } catch {
          // Ignore storage errors
        }
      }
      return;
    }

    // Use replace to avoid creating a back history entry
    window.location.replace(url);
  }, [absoluteUrl, targetPath]);

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <LightLoading />
    </div>
  );
};

export default memo(BackendRedirect);
