import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useUserStoreShallow } from '@refly/stores';

/**
 * Redirect component for /canvas/:canvasId
 * Redirects to /workspace if canvasId is 'empty', otherwise to /workflow/:canvasId
 *
 * Why we need a component instead of direct Navigate:
 * - Navigate's 'to' prop is a string, it doesn't support dynamic parameter substitution
 * - :canvasId in a string would be treated as literal text, not a route parameter
 * - We need useParams() hook to get the actual parameter value at runtime
 */
export const CanvasRedirect = () => {
  const { canvasId } = useParams<{ canvasId: string }>();
  const [searchParams] = useSearchParams();

  if (canvasId === 'empty') {
    const queryString = searchParams.toString();
    const target = queryString ? `/workspace?${queryString}` : '/workspace';
    return <Navigate to={target} replace />;
  }

  if (canvasId) {
    const queryString = searchParams.toString();
    const target = queryString ? `/workflow/${canvasId}?${queryString}` : `/workflow/${canvasId}`;
    return <Navigate to={target} replace />;
  }

  // Fallback to workspace if no canvasId
  return <Navigate to="/workspace" replace />;
};

/**
 * Redirect component for routes that should redirect to /workspace
 * Preserves query parameters
 */
export const WorkspaceRedirect = () => {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const target = queryString ? `/workspace?${queryString}` : '/workspace';
  return <Navigate to={target} replace />;
};

/**
 * Protected route wrapper. Redirects unauthenticated users to /login with returnUrl.
 * This component does not render any loading UI to avoid UI changes on protected pages.
 */
export const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { getLoginStatus } = useIsLogin();
  const { isLogin, isCheckingLoginStatus } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const isLoggedIn = useMemo(() => {
    return getLoginStatus() || isLogin;
  }, [getLoginStatus, isLogin]);

  // Wait for checking to avoid flicker
  if (isCheckingLoginStatus === true || isCheckingLoginStatus === undefined) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to={'/'} replace />;
  }

  return children;
};
