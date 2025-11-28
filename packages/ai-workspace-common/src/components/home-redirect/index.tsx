import { useEffect } from 'react';
import { useState } from 'react';
import { LightLoading } from '@refly/ui-kit';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStoreShallow } from '@refly/stores';

export const HomeRedirect = ({ defaultNode }: { defaultNode: ReactNode }) => {
  const [element, setElement] = useState<ReactNode | null>(null);
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const handleHomeRedirect = async () => {
    if (isLogin) {
      return <Navigate to={'/workspace'} replace />;
    }

    // In local development, redirect to /login directly to avoid infinite loading
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      return <Navigate to="/login" replace />;
    }

    // Return defaultNode to allow server-side handling (e.g., Cloudflare Worker)
    // BackendRedirect will handle the redirect and avoid infinite loop
    return defaultNode;
  };

  useEffect(() => {
    handleHomeRedirect().then(setElement);
  }, [isLogin, defaultNode]);

  return element ?? <LightLoading />;
};
