import { memo, useEffect } from 'react';
import { LightLoading } from '@refly/ui-kit';
import { serverOrigin } from '@refly/ui-kit';

interface BackendRedirectProps {
  /** Optional absolute URL; if provided, it will be used directly */
  absoluteUrl?: string;
  /** Optional path to append to serverOrigin, defaults to '/' */
  targetPath?: string;
}

/**
 * Redirects user to a backend-served page. Useful for forcing server-side routing.
 */
const BackendRedirect = ({ absoluteUrl, targetPath = '/' }: BackendRedirectProps) => {
  useEffect(() => {
    const base = serverOrigin ?? '';
    const url = absoluteUrl ?? `${base}${targetPath ?? '/'}`;
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
