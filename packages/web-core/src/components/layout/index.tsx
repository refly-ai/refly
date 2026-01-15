import { useEffect, useRef, useState } from 'react';
import { Layout, Modal } from 'antd';
import { useMatch, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@sentry/react';
import { SiderLayout } from '@refly-packages/ai-workspace-common/components/sider/layout';
import { useBindCommands } from '@refly-packages/ai-workspace-common/hooks/use-bind-commands';
import { useUserStoreShallow } from '@refly/stores';
import { LOCALE } from '@refly/common-types';
import { authChannel } from '@refly-packages/ai-workspace-common/utils/auth-channel';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

import './index.scss';
import { useSiderStoreShallow } from '@refly/stores';
import { LightLoading } from '@refly/ui-kit';
import { isDesktop } from '@refly/ui-kit';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { EnvironmentBanner } from './EnvironmentBanner';
import { useGetMediaModel } from '@refly-packages/ai-workspace-common/hooks/use-get-media-model';
import { useHandleUrlParamsCallback } from '@refly-packages/ai-workspace-common/hooks/use-handle-url-params-callback';
import { useRouteCollapse } from '@refly-packages/ai-workspace-common/hooks/use-route-collapse';
import cn from 'classnames';
import { LazyModal } from './LazyModal';

const Content = Layout.Content;

interface AppLayoutProps {
  children?: any;
}

export const AppLayout = (props: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);

  const { showCanvasListModal, setShowCanvasListModal, showLibraryModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

  // 模态框显示状态 - 使用 useState 触发懒加载
  // 当模态框需要显示时，这些状态会变为 true，触发组件加载
  const [shouldLoadBigSearch, setShouldLoadBigSearch] = useState(false);
  const [shouldLoadLogin, _setShouldLoadLogin] = useState(false);
  const [shouldLoadVerification, _setShouldLoadVerification] = useState(false);
  const [shouldLoadFormOnboarding, _setShouldLoadFormOnboarding] = useState(false);
  const [shouldLoadOnboardingSuccess, _setShouldLoadOnboardingSuccess] = useState(false);
  const [shouldLoadInvitationCode, _setShouldLoadInvitationCode] = useState(false);
  const [shouldLoadResetPassword, _setShouldLoadResetPassword] = useState(false);
  const [shouldLoadSubscribe, _setShouldLoadSubscribe] = useState(false);
  const [shouldLoadClaimedVoucher, _setShouldLoadClaimedVoucher] = useState(false);
  const [shouldLoadImportResource, _setShouldLoadImportResource] = useState(false);
  const [shouldLoadCanvasRename, setShouldLoadCanvasRename] = useState(false);
  const [shouldLoadCanvasDelete, setShouldLoadCanvasDelete] = useState(false);
  const [shouldLoadDuplicateCanvas, setShouldLoadDuplicateCanvas] = useState(false);

  // 监听键盘事件，预加载 BigSearchModal (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        setShouldLoadBigSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 监听 CanvasListModal 和 LibraryModal 的状态变化
  useEffect(() => {
    if (showCanvasListModal || showLibraryModal) {
      // 当用户打开这些模态框时，预加载其他可能会用到的模态框
      setShouldLoadCanvasRename(true);
      setShouldLoadCanvasDelete(true);
      setShouldLoadDuplicateCanvas(true);
    }
  }, [showCanvasListModal, showLibraryModal]);

  const isPublicAccessPage = usePublicAccessPage();
  const matchPricing = useMatch('/pricing');
  const matchApp = useMatch('/app/:appId');

  useBindCommands();

  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const showSider = (isPublicAccessPage || (!!userStore.userProfile && !matchPricing)) && !matchApp;

  // Get storage user profile
  const storageUserProfile = safeParseJSON(localStorage.getItem('refly-user-profile'));
  const notShowLoginBtn = storageUserProfile?.uid || userStore?.userProfile?.uid;

  // Get locale settings
  const storageLocalSettings = safeParseJSON(localStorage.getItem('refly-local-settings'));

  const locale = storageLocalSettings?.uiLocale || userStore?.localSettings?.uiLocale || LOCALE.EN;

  // Check user login status
  const { getLoginStatus } = useGetUserSettings();

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
    // Skip redirect during prerendering to avoid prerender failure
    // @ts-ignore - document.prerendering is not yet in TypeScript DOM types
    if (typeof document.prerendering !== 'undefined' && document.prerendering) {
      return;
    }

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
  useEffect(() => {
    // Debounce to avoid multiple triggers in short time
    let lastEventTime = 0;
    const DEBOUNCE_MS = 500;

    const unsubscribe = authChannel.subscribe((event) => {
      const now = Date.now();
      if (now - lastEventTime < DEBOUNCE_MS) return;
      lastEventTime = now;

      switch (event.type) {
        case 'logout':
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
              window.location.href = '/login';
            },
          });
          break;

        case 'user-changed':
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
          // biome-ignore lint/correctness/noSwitchDeclarations: <explanation>
          const isPrerendering =
            // @ts-ignore - document.prerendering is not yet in TypeScript DOM types
            typeof document.prerendering !== 'undefined' && document.prerendering;

          console.log('[Login Event] Received login event', {
            isPrerendering,
            pathname: window.location.pathname,
            uid: event.uid,
          });

          if (isPrerendering) {
            // If we're prerendering, do nothing
            // Wait for prerenderingchange event to handle auth sync
            console.log(
              '[Login Event] Prerendering: ignoring login event, will handle on activation',
            );
          } else if (window.location.pathname === '/login') {
            // If on login page and not prerendering, navigate to workspace
            console.log('[Login Event] On login page, redirecting to workspace');
            window.location.href = '/workspace';
          } else {
            // On workspace or other protected page, sync auth state
            console.log('[Login Event] On workspace, syncing auth state');
            getLoginStatus();
          }
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

    // Prerender activation check: handle prerendered pages that were rendered without auth
    // When a prerendered page is activated, check if user is now logged in
    const handlePrerenderingChange = async () => {
      console.log('[Prerender] Page activated from prerender state');

      // Check if user is logged in now (has uid cookie)
      const hasAuth = authChannel.getUidFromCookie();
      const isProtectedPage =
        window.location.pathname === '/workspace' ||
        window.location.pathname.startsWith('/canvas') ||
        window.location.pathname.startsWith('/workflow');

      // If user is logged in and we're on a protected page,
      // only sync if we don't have userProfile yet
      if (hasAuth && isProtectedPage && !userStore.userProfile) {
        console.log('[Prerender] User logged in but no profile, syncing auth state');
        await getLoginStatus();
      } else if (hasAuth && isProtectedPage && userStore.userProfile) {
        console.log('[Prerender] User already has profile, no need to sync');
      }
    };

    // Listen for prerendering activation (Chrome 108+)
    // @ts-ignore - document.prerendering is not yet in TypeScript DOM types
    if (typeof document.prerendering !== 'undefined') {
      document.addEventListener('prerenderingchange', handlePrerenderingChange);
    }

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // @ts-ignore - document.prerendering is not yet in TypeScript DOM types
      if (typeof document.prerendering !== 'undefined') {
        document.removeEventListener('prerenderingchange', handlePrerenderingChange);
      }
    };
  }, [t, getLoginStatus, userStore.userProfile]);

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
    <ErrorBoundary>
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
        {/* 懒加载模态框 - 只在需要时才加载代码 */}
        <LazyModal
          visible={shouldLoadBigSearch}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/search/modal').then((m) => ({
              default: m.BigSearchModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadLogin}
          loader={() =>
            import('../../components/login-modal').then((m) => ({ default: m.LoginModal }))
          }
        />

        <LazyModal
          visible={shouldLoadVerification}
          loader={() =>
            import('../../components/verification-modal').then((m) => ({
              default: m.VerificationModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadFormOnboarding}
          loader={() =>
            import('../form-onboarding-modal').then((m) => ({
              default: m.FormOnboardingModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadOnboardingSuccess}
          loader={() =>
            import('../onboarding-success-modal').then((m) => ({
              default: m.OnboardingSuccessModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadInvitationCode}
          loader={() =>
            import('../../components/invitation-code-modal').then((m) => ({
              default: m.InvitationCodeModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadResetPassword}
          loader={() =>
            import('../../components/reset-password-modal').then((m) => ({
              default: m.ResetPasswordModal,
            }))
          }
        />

        <LazyModal
          visible={shouldLoadSubscribe}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/settings/subscribe-modal').then(
              (m) => ({ default: m.SubscribeModal }),
            )
          }
        />

        <LazyModal
          visible={shouldLoadClaimedVoucher}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/voucher/claimed-voucher-popup'
            ).then((m) => ({ default: m.ClaimedVoucherPopup }))
          }
        />

        <LazyModal
          visible={shouldLoadImportResource}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/import-resource').then((m) => ({
              default: m.ImportResourceModal,
            }))
          }
        />

        <LazyModal
          visible={showCanvasListModal}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal'
            ).then((m) => ({ default: m.CanvasListModal }))
          }
          setVisible={setShowCanvasListModal}
        />

        <LazyModal
          visible={showLibraryModal}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/workspace/library-modal').then(
              (m) => ({ default: m.LibraryModal }),
            )
          }
          setVisible={setShowLibraryModal}
        />

        <LazyModal
          visible={shouldLoadCanvasRename}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename'
            ).then((m) => ({ default: m.CanvasRenameModal }))
          }
        />

        <LazyModal
          visible={shouldLoadCanvasDelete}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete'
            ).then((m) => ({ default: m.CanvasDeleteModal }))
          }
        />

        <LazyModal
          visible={shouldLoadDuplicateCanvas}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/canvas/modals/duplicate-canvas-modal'
            ).then((m) => ({ default: m.DuplicateCanvasModal }))
          }
        />
      </Layout>
    </ErrorBoundary>
  );
};
