import { useEffect } from 'react';
import { useState } from 'react';
import { LightLoading } from '@refly/ui-kit';
import { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useUserStoreShallow } from '@refly/stores';

export const HomeRedirect = ({ defaultNode }: { defaultNode: ReactNode }) => {
  const [element, setElement] = useState<ReactNode | null>(null);
  const [searchParams] = useSearchParams();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const handleHomeRedirect = async () => {
    if (isLogin) {
      // Preserve invite parameter when redirecting to workspace
      const inviteCode = searchParams.get('invite');
      const targetPath = inviteCode ? `/workspace?invite=${inviteCode}` : '/workspace';
      return <Navigate to={targetPath} replace />;
    }
    // Return defaultNode to allow server-side handling (e.g., Cloudflare Worker)
    // BackendRedirect will handle the redirect and avoid infinite loop
    return defaultNode;
  };

  useEffect(() => {
    handleHomeRedirect().then(setElement);
  }, [isLogin, defaultNode, searchParams]);

  return element ?? <LightLoading />;
};
