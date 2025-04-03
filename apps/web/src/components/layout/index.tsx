import { Layout } from '@arco-design/web-react';
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

import './index.scss';

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

  const isPublicAccessPage = usePublicAccessPage();
  const matchPricing = useMatch('/pricing');
  const matchLogin = useMatch('/login');

  useBindCommands();

  const hasBetaAccess = userStore.isLogin ? userStore.userProfile?.hasBetaAccess || false : true;

  const showSider = isPublicAccessPage || (!!userStore.userProfile && !matchPricing && !matchLogin);

  return (
    <ErrorBoundary>
      <Layout className="app-layout main">
        {showSider && hasBetaAccess ? <SiderLayout source="sider" /> : null}
        <Layout
          className="content-layout"
          style={{
            height: 'calc(100vh)',
            flexGrow: 1,
            overflowY: 'auto',
            width: showSider ? 'calc(100% - 200px - 16px)' : 'calc(100% - 16px)',
          }}
        >
          <Content>{props.children}</Content>
        </Layout>
        <LoginModal />
        <VerificationModal />
        <ResetPasswordModal />
        <SubscribeModal />
      </Layout>
    </ErrorBoundary>
  );
};
