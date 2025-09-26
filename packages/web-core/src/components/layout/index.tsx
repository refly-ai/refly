import { useEffect } from 'react';
import { Layout } from 'antd';
import { useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@sentry/react';
import { SiderLayout } from '@refly-packages/ai-workspace-common/components/sider/layout';
import { useBindCommands } from '@refly-packages/ai-workspace-common/hooks/use-bind-commands';
import { useUserStoreShallow } from '@refly/stores';
import { LOCALE } from '@refly/common-types';

import { LoginModal } from '../../components/login-modal';
import { SubscribeModal } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal';
import { VerificationModal } from '../../components/verification-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { ImportResourceModal } from '@refly-packages/ai-workspace-common/components/import-resource';
import './index.scss';
import { useSiderStoreShallow } from '@refly/stores';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';
import { CanvasRenameModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename';
import { CanvasDeleteModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete';
import { DuplicateCanvasModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/duplicate-canvas-modal';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

import { LightLoading } from '@refly/ui-kit';
import { isDesktop } from '@refly/ui-kit';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { useGetMediaModel } from '@refly-packages/ai-workspace-common/hooks/use-get-media-model';
import { useHandleUrlParamsCallback } from '@refly-packages/ai-workspace-common/hooks/use-handle-url-params-callback';

const Content = Layout.Content;

interface AppLayoutProps {
  children?: any;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { showCanvasListModal, setShowCanvasListModal, showLibraryModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

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
  const { i18n } = useTranslation();
  useEffect(() => {
    if (locale && i18n.isInitialized && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  // Handle payment callback
  useHandleUrlParamsCallback();

  const routeLogin = useMatch('/');
  const isPricing = useMatch('/pricing');

  if (!isPublicAccessPage && !isPricing && !isDesktop()) {
    if (!userStore.isCheckingLoginStatus === undefined || userStore.isCheckingLoginStatus) {
      return <LightLoading />;
    }

    if (!notShowLoginBtn && !routeLogin) {
      return <LightLoading />;
    }
  }

  return (
    <ErrorBoundary>
      <Layout
        className="app-layout main h-screen w-screen"
        style={{
          background:
            'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),var(--refly-bg-body-z0, #FFFFFF)',
        }}
      >
        {showSider ? <SiderLayout source="sider" /> : null}
        <Layout className="content-layout bg-transparent h-[calc(100vh-16px)] flex-grow overflow-y-auto m-2 rounded-xl shadow-refly-m">
          <Content>{props.children}</Content>
        </Layout>
        <BigSearchModal />
        <LoginModal />
        <VerificationModal />
        <ResetPasswordModal />
        <SubscribeModal />
        <CanvasListModal visible={showCanvasListModal} setVisible={setShowCanvasListModal} />
        <LibraryModal visible={showLibraryModal} setVisible={setShowLibraryModal} />
        <ImportResourceModal />
        <CanvasRenameModal />
        <CanvasDeleteModal />
        <DuplicateCanvasModal />
      </Layout>
    </ErrorBoundary>
  );
};
