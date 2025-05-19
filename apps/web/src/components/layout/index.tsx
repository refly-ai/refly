import { Layout } from 'antd';
import { useMatch } from 'react-router-dom';
import { SiderLayout } from '@refly-packages/ai-workspace-common/components/sider/layout';
import { useBindCommands } from '@refly-packages/ai-workspace-common/hooks/use-bind-commands';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

import { LoginModal } from '@/components/login-modal';
import { SubscribeModal } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal';
import { ErrorBoundary } from '@sentry/react';
import { VerificationModal } from '@/components/verification-modal';
import { ResetPasswordModal } from '@/components/reset-password-modal';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { ImportResourceModal } from '@refly-packages/ai-workspace-common/components/import-resource';
import './index.scss';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';

const Content = Layout.Content;

interface AppLayoutProps {
  children?: any;
}

export const AppLayout = (props: AppLayoutProps) => {
  // stores
  const userStore = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    isLogin: state.isLogin,
  }));

  const { showCanvasListModal, setShowCanvasListModal, showLibraryModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

  const isPublicAccessPage = usePublicAccessPage();
  const matchPricing = useMatch('/pricing');
  const matchLogin = useMatch('/login');

  useBindCommands();

  const showSider = isPublicAccessPage || (!!userStore.userProfile && !matchPricing && !matchLogin);

  return (
    <ErrorBoundary>
      <Layout className="app-layout main">
        {showSider ? <SiderLayout source="sider" /> : null}
        <Layout
          className="content-layout dark:bg-green-900"
          style={{
            height: 'calc(100vh)',
            flexGrow: 1,
            overflowY: 'auto',
            width: showSider ? 'calc(100% - 200px - 16px)' : 'calc(100% - 16px)',
          }}
        >
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
      </Layout>
    </ErrorBoundary>
  );
};
