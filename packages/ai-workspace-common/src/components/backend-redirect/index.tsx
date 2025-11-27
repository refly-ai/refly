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

    // Avoid infinite loop: don't redirect if already on the target path
    if (targetUrl.pathname === currentUrl.pathname) {
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
