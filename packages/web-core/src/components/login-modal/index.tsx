import { Modal } from 'antd';
import { useMemo, useEffect } from 'react';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { LoginContent } from './login-content';

import { useTranslation } from 'react-i18next';
import { useAuthStoreShallow } from '@refly/stores';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

const LoginModal = (props: { visible?: boolean; from?: string }) => {
  const location = useLocation();

  const authStore = useAuthStoreShallow((state) => ({
    loginModalOpen: state.loginModalOpen,
    isSignUpMode: state.isSignUpMode,
    setLoginModalOpen: state.setLoginModalOpen,
    setIsSignUpMode: state.setIsSignUpMode,
  }));

  const { t } = useTranslation();

  // Determine source based on route or URL parameter
  const source = useMemo(() => {
    const currentPath = location.pathname;
    // Check if current route matches template page patterns
    if (currentPath?.startsWith('/app/') || currentPath?.startsWith('/workflow-template/')) {
      return 'template_detail';
    }
    // Fallback to URL parameter or props
    return props.from ?? undefined;
  }, [location.pathname, props.from]);

  useEffect(() => {
    if (!authStore.loginModalOpen) {
      authStore.setIsSignUpMode(false);
    }
  }, [authStore]);

  return (
    <Modal
      open={props.visible || authStore.loginModalOpen}
      centered
      footer={null}
      width={560}
      onCancel={() => authStore.setLoginModalOpen(false)}
    >
      <div className="relative h-full w-full">
        <Logo className="w-[100px] mb-6" />

        <div className="p-10 pb-0">
          <div className="text-3xl font-bold">
            {authStore.isSignUpMode
              ? t('landingPage.loginModal.greeting.signup')
              : t('landingPage.loginModal.greeting.signin')}
          </div>

          <div className="text-sm">
            {authStore.isSignUpMode
              ? t('landingPage.loginModal.signupSubtitle')
              : t('landingPage.loginModal.signinSubtitle')}
          </div>
        </div>

        <LoginContent from={source} onSuccess={() => authStore.setLoginModalOpen(false)} />
      </div>
    </Modal>
  );
};

// Optimize with memo to prevent unnecessary re-renders
const MemoizedLoginModal = React.memo(LoginModal);
export { MemoizedLoginModal as LoginModal };
