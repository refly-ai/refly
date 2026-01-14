import { Navigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import type { ReactElement } from 'react';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useUserStoreShallow } from '@refly/stores';
import { storePendingVoucherCode } from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';

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
 * Redirect component for /app/:shareId
 * Redirects to /workflow-template/:shareId
 * Preserves query parameters
 */
export const WorkflowTemplateRedirect = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();

  if (shareId) {
    const queryString = searchParams.toString();
    const target = queryString
      ? `/workflow-template/${shareId}?${queryString}`
      : `/workflow-template/${shareId}`;
    return <Navigate to={target} replace />;
  }

  // Fallback to workspace if no shareId
  return <Navigate to="/workspace" replace />;
};

/**
 * Protected route wrapper. Redirects unauthenticated users to /login with returnUrl.
 * This component does not render any loading UI to avoid UI changes on protected pages.
 * Preserves all query parameters including invite code for voucher claiming.
 */
export const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { getLoginStatus } = useIsLogin();
  const { isLogin, isCheckingLoginStatus } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const isLoggedIn = useMemo(() => {
    return getLoginStatus() || isLogin;
  }, [getLoginStatus, isLogin]);

  // Store invite code before redirecting to login (for voucher claiming after login)
  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode && !isLoggedIn && isCheckingLoginStatus === false) {
      storePendingVoucherCode(inviteCode);
    }
  }, [searchParams, isLoggedIn, isCheckingLoginStatus]);

  // Wait for checking to avoid flicker
  if (isCheckingLoginStatus === true || isCheckingLoginStatus === undefined) {
    return null;
  }

  if (!isLoggedIn) {
    // Build returnUrl with current path and all query params preserved
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${location.pathname}?${queryString}` : location.pathname;
    const returnUrl = encodeURIComponent(fullPath);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  return children;
};
