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
import { CanvasRenameModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename';
import { CanvasDeleteModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete';
import { DuplicateCanvasModal } from '@refly-packages/ai-workspace-common/components/canvas/modals/duplicate-canvas-modal';

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
      <Layout
        className="app-layout main"
        style={{
          background:
            'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),#f3f3f3',
        }}
      >
        {showSider ? <SiderLayout source="sider" /> : null}
        <Layout
          className="content-layout"
          style={{
            height: '100vh',
            flexGrow: 1,
            overflowY: 'auto',
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
        <CanvasRenameModal />
        <CanvasDeleteModal />
        <DuplicateCanvasModal />
      </Layout>
    </ErrorBoundary>
  );
};
