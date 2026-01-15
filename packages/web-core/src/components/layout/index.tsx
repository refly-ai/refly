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
import {
  useAuthStoreShallow,
  useSearchStoreShallow,
  useSubscriptionStoreShallow,
  useImportResourceStoreShallow,
  useCanvasOperationStoreShallow,
} from '@refly/stores';
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

  // Get global modal visibility states for lazy loading
  const { isSearchOpen } = useSearchStoreShallow((state) => ({ isSearchOpen: state.isSearchOpen }));
  const { loginModalOpen, verificationModalOpen, resetPasswordModalOpen } = useAuthStoreShallow(
    (state) => ({
      loginModalOpen: state.loginModalOpen,
      verificationModalOpen: state.verificationModalOpen,
      resetPasswordModalOpen: state.resetPasswordModalOpen,
    }),
  );
  const { subscribeModalVisible, claimedVoucherPopupVisible, earnedVoucherPopupVisible } =
    useSubscriptionStoreShallow((state) => ({
      subscribeModalVisible: state.subscribeModalVisible,
      claimedVoucherPopupVisible: state.claimedVoucherPopupVisible,
      earnedVoucherPopupVisible: state.earnedVoucherPopupVisible,
    }));
  const { importResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    importResourceModalVisible: state.importResourceModalVisible,
  }));
  const { modalVisible, modalType } = useCanvasOperationStoreShallow((state) => ({
    modalVisible: state.modalVisible,
    modalType: state.modalType,
  }));

  const {
    showOnboardingFormModal,
    showOnboardingSuccessAnimation,
    showInvitationCodeModal,
    hidePureCopilotModal,
    userProfile: profileForOnboarding,
  } = useUserStoreShallow((state) => ({
    showOnboardingFormModal: state.showOnboardingFormModal,
    showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
    showInvitationCodeModal: state.showInvitationCodeModal,
    hidePureCopilotModal: state.hidePureCopilotModal,
    userProfile: state.userProfile,
  }));

  const needOnboarding = profileForOnboarding?.preferences?.needOnboarding;
  const isPureCopilotVisible = !hidePureCopilotModal && !!needOnboarding;

  // 模态框预加载状态 (键盘快捷键或特定交互触发)
  const [shouldLoadBigSearch, setShouldLoadBigSearch] = useState(false);
  const [shouldLoadCanvasRename, setShouldLoadCanvasRename] = useState(false);
  const [shouldLoadCanvasDelete, setShouldLoadCanvasDelete] = useState(false);
  const [shouldLoadDuplicateCanvas, setShouldLoadDuplicateCanvas] = useState(false);

  // Combine store visibility and preloading for each modal
  const isBigSearchShown = isSearchOpen || shouldLoadBigSearch;
  const isCanvasRenameShown = (modalVisible && modalType === 'rename') || shouldLoadCanvasRename;
  const isCanvasDeleteShown = (modalVisible && modalType === 'delete') || shouldLoadCanvasDelete;
  const isDuplicateCanvasShown =
    (modalVisible && modalType === 'duplicate') || shouldLoadDuplicateCanvas;

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
          // Another tab logged in, reload page
          window.location.reload();
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
  }, [t]);

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
          visible={isBigSearchShown}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/search/modal').then((m) => ({
              default: m.BigSearchModal,
            }))
          }
        />

        <LazyModal
          visible={loginModalOpen}
          loader={() =>
            import('../../components/login-modal').then((m) => ({ default: m.LoginModal }))
          }
        />

        <LazyModal
          visible={verificationModalOpen}
          loader={() =>
            import('../../components/verification-modal').then((m) => ({
              default: m.VerificationModal,
            }))
          }
        />

        <LazyModal
          visible={showOnboardingFormModal}
          loader={() =>
            import('../form-onboarding-modal').then((m) => ({
              default: m.FormOnboardingModal,
            }))
          }
        />

        <LazyModal
          visible={showOnboardingSuccessAnimation}
          loader={() =>
            import('../onboarding-success-modal').then((m) => ({
              default: m.OnboardingSuccessModal,
            }))
          }
        />

        <LazyModal
          visible={showInvitationCodeModal}
          loader={() =>
            import('../../components/invitation-code-modal').then((m) => ({
              default: m.InvitationCodeModal,
            }))
          }
        />

        <LazyModal
          visible={isPureCopilotVisible}
          loader={() =>
            import('../pure-copilot-modal').then((m) => ({
              default: m.PureCopilotModal,
            }))
          }
        />

        <LazyModal
          visible={resetPasswordModalOpen}
          loader={() =>
            import('../../components/reset-password-modal').then((m) => ({
              default: m.ResetPasswordModal,
            }))
          }
        />

        <LazyModal
          visible={subscribeModalVisible}
          loader={() =>
            import('@refly-packages/ai-workspace-common/components/settings/subscribe-modal').then(
              (m) => ({ default: m.SubscribeModal }),
            )
          }
        />

        <LazyModal
          visible={claimedVoucherPopupVisible}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/voucher/claimed-voucher-popup'
            ).then((m) => ({ default: m.ClaimedVoucherPopup }))
          }
        />

        <LazyModal
          visible={earnedVoucherPopupVisible}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/voucher/earned-voucher-popup'
            ).then((m) => ({ default: m.EarnedVoucherPopup }))
          }
        />

        <LazyModal
          visible={importResourceModalVisible}
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
          visible={isCanvasRenameShown}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename'
            ).then((m) => ({ default: m.CanvasRenameModal }))
          }
        />

        <LazyModal
          visible={isCanvasDeleteShown}
          loader={() =>
            import(
              '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete'
            ).then((m) => ({ default: m.CanvasDeleteModal }))
          }
        />

        <LazyModal
          visible={isDuplicateCanvasShown}
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
