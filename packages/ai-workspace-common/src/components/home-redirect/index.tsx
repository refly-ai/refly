import { useEffect } from 'react';
import { useState } from 'react';
import { SuspenseLoading } from '@refly-packages/ai-workspace-common/components/common/loading';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';

export const HomeRedirect = ({ defaultNode }: { defaultNode: ReactNode }) => {
  const [element, setElement] = useState<ReactNode | null>(null);
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const handleHomeRedirect = async () => {
    if (isLogin) {
      const { currentCanvasId } = useCanvasStore.getState();

      if (currentCanvasId) {
        return <Navigate to={`/canvas/${currentCanvasId}`} replace />;
      }

      return <Navigate to={'/canvas/empty'} replace />;
    }
    return defaultNode;
  };

  useEffect(() => {
    handleHomeRedirect().then(setElement);
  }, []);

  return element ?? <SuspenseLoading />;
};
