import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useAuthStoreShallow } from '@refly/stores';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LoginContent } from './login-content';

interface LoginCardProps {
  from?: string;
  onSuccess?: () => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ from, onSuccess }) => {
  const { isSignUpMode } = useAuthStoreShallow((state) => ({
    isSignUpMode: state.isSignUpMode,
  }));
  const { t } = useTranslation();

  return (
    <div
      className="relative flex flex-col w-full max-w-[520px] rounded-[20px] shadow-[0_8px_40px_0_rgba(0,0,0,0.08)] p-6 sm:p-8 lg:p-[60px]"
      style={{
        backgroundColor: 'var(--refly-bg-body-z0)',
        gap: '32px',
        margin: 'auto',
      }}
    >
      {/* Logo - absolute positioned */}
      <div
        className="absolute"
        style={{
          left: '24px',
          top: '24px',
          width: '118px',
          height: '32px',
        }}
      >
        <Logo className="w-full h-full" />
      </div>

      {/* Title section */}
      <div
        className="w-full flex flex-col items-center"
        style={{
          marginTop: '72px',
          gap: '4px',
          height: '72px',
        }}
      >
        <div
          className="text-refly-text-0 text-center"
          style={{
            fontSize: '32px',
            fontWeight: 600,
            lineHeight: '1.5em',
          }}
        >
          {isSignUpMode
            ? t('landingPage.loginModal.greeting.signup')
            : t('landingPage.loginModal.greeting.signin')}
        </div>

        <div
          className="text-refly-text-0 text-center"
          style={{
            fontSize: '14px',
            fontWeight: 400,
            lineHeight: '1.4285714285714286em',
          }}
        >
          {isSignUpMode
            ? t('landingPage.loginModal.signupSubtitle')
            : t('landingPage.loginModal.signinSubtitle')}
        </div>
      </div>

      <div
        className="flex flex-col items-stretch w-full"
        style={{
          gap: '40px',
        }}
      >
        <LoginContent from={from} onSuccess={onSuccess} isStandalone />
      </div>
    </div>
  );
};
