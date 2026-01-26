import { useEffect, useRef } from 'react';
import { Layout, Modal } from 'antd';
import { useMatch, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LazyErrorBoundary } from './LazyErrorBoundary';
import { SiderLayout } from '@refly-packages/ai-workspace-common/components/sider/layout';
import { useUserStoreShallow } from '@refly/stores';
import { LOCALE } from '@refly/common-types';
import { authChannel } from '@refly-packages/ai-workspace-common/utils/auth-channel';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

import './index.scss';
import { LightLoading } from '@refly/ui-kit';
import { isDesktop } from '@refly/ui-kit';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { EnvironmentBanner } from './EnvironmentBanner';
import { useGetMediaModel } from '@refly-packages/ai-workspace-common/hooks/use-get-media-model';
import { useHandleUrlParamsCallback } from '@refly-packages/ai-workspace-common/hooks/use-handle-url-params-callback';
import { useRouteCollapse } from '@refly-packages/ai-workspace-common/hooks/use-route-collapse';
import cn from 'classnames';
import { ModalContainer } from './ModalContainer';

const Content = Layout.Content;

interface AppLayoutProps {
  children?: any;
}

export const AppLayout = (props: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);

  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const isPublicAccessPage = usePublicAccessPage();
  const matchPricing = useMatch('/pricing');
  const matchApp = useMatch('/app/:appId');

  const showSider = (isPublicAccessPage || (!!userStore.userProfile && !matchPricing)) && !matchApp;

  // Get storage user profile
  const storageUserProfile = safeParseJSON(localStorage.getItem('refly-user-profile'));
  const notShowLoginBtn = storageUserProfile?.uid || userStore?.userProfile?.uid;

  // Get locale settings
  const storageLocalSettings = safeParseJSON(localStorage.getItem('refly-local-settings'));

  const locale = storageLocalSettings?.uiLocale || userStore?.localSettings?.uiLocale || LOCALE.EN;

  // Check user login status
  useGetUserSettings();

  useGetMediaModel();

  // Change locale if not matched
  const { i18n, t } = useTranslation();
  useEffect(() => {
    if (locale && i18n.isInitialized && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  // Handle root path redirection based on login status
  useEffect(() => {
    if (
      location.pathname === '/' &&
      !userStore.isCheckingLoginStatus &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      if (userStore.isLogin && userStore.userProfile) {
        navigate('/workspace', { replace: true });
      } else {
        // Preserve query parameters (e.g., invite code) when redirecting to login
        const searchParams = new URLSearchParams(location.search);
        const loginPath = searchParams.toString() ? `/login?${searchParams.toString()}` : '/login';
        navigate(loginPath, { replace: true });
      }
    }
  }, [
    location.pathname,
    location.search,
    userStore.isLogin,
    userStore.userProfile,
    userStore.isCheckingLoginStatus,
    navigate,
  ]);

  // Handle payment callback
  useHandleUrlParamsCallback();

  // Handle sidebar collapse based on route changes
  useRouteCollapse();

  // Cross-tab auth state sync
  const hasShownLogoutModalRef = useRef<boolean>(false);
  const hasShownUserChangedModalRef = useRef<boolean>(false);

  useEffect(() => {
    // Debounce to avoid multiple triggers in short time
    let lastEventTime = 0;
    const DEBOUNCE_MS = 500;

    const unsubscribe = authChannel.subscribe((event) => {
      const now = Date.now();
      if (now - lastEventTime < DEBOUNCE_MS) return;
      lastEventTime = now;

      // Don't show modals on read-only public pages like /share/* and /preview/*
      // These pages are view-only and don't require authentication state sync
      const currentPath = window?.location?.pathname ?? '';
      const isReadOnlyPage =
        currentPath?.startsWith('/share/') || currentPath?.startsWith('/preview/');

      if (isReadOnlyPage) {
        console.log('[Auth] Skipping modal on read-only page:', currentPath);
        return;
      }

      // For other public pages (like /app/*), skip modal only if user is not logged in
      if (isPublicAccessPage && !userStore?.isLogin) {
        console.log('[Auth] Skipping modal on public page (not logged in):', currentPath);
        return;
      }

      switch (event.type) {
        case 'logout':
          // Prevent duplicate logout modals
          if (hasShownLogoutModalRef.current) {
            console.log('[Auth] Logout modal already shown, skipping');
            return;
          }
          hasShownLogoutModalRef.current = true;

          // Another tab logged out, show prompt then redirect to login
          Modal.info({
            title: t('common.loggedOut.title'),
            content: t('common.loggedOut.content'),
            okText: t('common.confirm'),
            centered: true,
            icon: null,
            okButtonProps: {
              className:
                '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66] rounded-lg',
            },
            onOk: () => {
              // Use SPA navigation instead of hard redirect
              navigate('/login', { replace: true });
            },
          });
          break;

        case 'user-changed':
          // Prevent duplicate user-changed modals
          if (hasShownUserChangedModalRef.current) {
            console.log('[Auth] User-changed modal already shown, skipping');
            return;
          }
          hasShownUserChangedModalRef.current = true;

          // Another tab switched user, show prompt then refresh
          Modal.info({
            title: t('common.userChanged.title'),
            content: t('common.userChanged.content'),
            okText: t('common.confirm'),
            centered: true,
            icon: null,
            okButtonProps: {
              className:
                '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66] rounded-lg',
            },
            onOk: () => {
              window.location.reload();
            },
          });
          break;

        case 'login':
          // Another tab logged in
          // Don't auto-refresh as it causes infinite loops
          // useGetUserSettings will auto-update userStore and UI will respond reactively
          console.log('[Auth] Login event received from another tab, uid:', event.uid);
          break;
      }
    });

    // Visibility check: validate user identity when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        authChannel.validateUserIdentity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [t, isPublicAccessPage, navigate, userStore.isLogin]);

  const routeLogin = useMatch('/');
  const isPricing = useMatch('/pricing');
  const matchCanvas = useMatch('/canvas/:canvasId');
  const matchWorkflow = useMatch('/workflow/:workflowId');
  const isShareFile = useMatch('/share/file/:shareId');
  const isWorkflowEmpty = matchCanvas?.params?.canvasId === 'empty';
  const isWorkflow = (!!matchCanvas || !!matchWorkflow) && !isWorkflowEmpty;

  if (!isPublicAccessPage && !isPricing && !isDesktop()) {
    if (userStore.isCheckingLoginStatus === undefined || userStore.isCheckingLoginStatus) {
      return <LightLoading />;
    }

    if (!notShowLoginBtn && !routeLogin) {
      return <LightLoading />;
    }
  }

  return (
    <LazyErrorBoundary>
      <EnvironmentBanner />
      <Layout
        className="app-layout main w-full overflow-x-hidden"
        style={{
          height: 'var(--screen-height)',
          background:
            'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),var(--refly-bg-body-z0, #FFFFFF)',
        }}
      >
        {showSider ? <SiderLayout source="sider" /> : null}
        <Layout
          className={cn(
            'content-layout bg-transparent flex-grow overflow-y-auto overflow-x-hidden rounded-xl min-w-0 min-h-0 overscroll-contain',
            !isShareFile && 'm-2',
            isWorkflow ? '' : 'shadow-refly-m',
          )}
          style={isShareFile ? {} : { height: 'calc(var(--screen-height) - 16px)' }}
        >
          <Content>{props.children}</Content>
        </Layout>
        {/* Modal container is isolated to prevent modal state from causing content re-renders */}
        <ModalContainer />
      </Layout>
    </LazyErrorBoundary>
  );
};

// Export LazyErrorBoundary for use in other parts of the app
export { LazyErrorBoundary } from './LazyErrorBoundary';
