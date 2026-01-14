import { Button, Input, Form } from 'antd';
import { Link } from '@refly-packages/ai-workspace-common/utils/router';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';

import { OAuthButton } from '../../components/login-modal/oauth-button';
import { VerificationModal } from '../../components/verification-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal';

import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useAuthStoreShallow } from '@refly/stores';
import { serverOrigin } from '@refly/ui-kit';
import { useGetAuthConfig } from '@refly-packages/ai-workspace-common/queries';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { logEvent } from '@refly/telemetry-web';
import { useCookie } from 'react-use';
import { UID_COOKIE } from '@refly/utils';
import loginImage from '../../assets/login.png';
import loginDarkImage from '../../assets/login-dark.png';
import './index.css';
import { useUserStoreShallow } from '@refly/stores';
import {
  storePendingVoucherCode,
  getAndClearSignupEntryPoint,
} from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';
import { storePendingRedirect } from '@refly-packages/ai-workspace-common/hooks/use-pending-redirect';

interface FormValues {
  email: string;
  password: string;
}

const LoginPage = () => {
  const [form] = Form.useForm<FormValues>();
  const [searchParams] = useSearchParams();
  const [isEmailFormExpanded, setIsEmailFormExpanded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { getLoginStatus } = useIsLogin();
  const { isLogin, isCheckingLoginStatus } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  // Store invite code from URL parameter for claiming after login
  // This must run synchronously before any redirect checks
  const inviteCode = searchParams.get('invite');
  if (inviteCode) {
    storePendingVoucherCode(inviteCode);
  }

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkDarkMode();

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const authStore = useAuthStoreShallow((state) => ({
    loginInProgress: state.loginInProgress,
    loginProvider: state.loginProvider,
    isSignUpMode: state.isSignUpMode,
    setLoginInProgress: state.setLoginInProgress,
    setLoginProvider: state.setLoginProvider,
    setIsSignUpMode: state.setIsSignUpMode,
    setVerificationModalOpen: state.setVerificationModalOpen,
    setResetPasswordModalOpen: state.setResetPasswordModalOpen,
    setSessionId: state.setSessionId,
    setEmail: state.setEmail,
    reset: state.reset,
  }));

  const isPublicAccessPage = usePublicAccessPage();

  const { t } = useTranslation();

  const { data: authConfig, isLoading: isAuthConfigLoading } = useGetAuthConfig();

  // If already logged in, redirect to /workspace
  const [uid] = useCookie(UID_COOKIE);
  const hasLoginCredentials = !!uid;
  const isLoggedIn = useMemo(() => {
    return getLoginStatus() || isLogin;
  }, [getLoginStatus, isLogin]);

  // Wait only when explicitly checking to avoid flicker; do not block on undefined
  if (isCheckingLoginStatus === true) {
    return null;
  }

  // Avoid redirect loop: only use cookie-based fast path when there is no returnUrl
  const hasReturnUrl = !!searchParams.get('returnUrl');
  if (isLoggedIn || (hasLoginCredentials && !hasReturnUrl)) {
    return <Navigate to="/workspace" replace />;
  }

  // Provide default values if config is not loaded
  const { isGithubEnabled, isGoogleEnabled, isEmailEnabled } = useMemo(() => {
    // Default to showing email login if config is not available
    if (!authConfig?.data || isAuthConfigLoading) {
      return {
        isGithubEnabled: false,
        isGoogleEnabled: false,
        isEmailEnabled: true,
      };
    }

    return {
      isGithubEnabled: authConfig.data.some((item) => item.provider === 'github'),
      isGoogleEnabled: authConfig.data.some((item) => item.provider === 'google'),
      isEmailEnabled: authConfig.data.some((item) => item.provider === 'email') || true, // Always enable email as fallback
    };
  }, [authConfig?.data, isAuthConfigLoading]);

  const handleLogin = useCallback(
    (provider: 'github' | 'google') => {
      logEvent('auth::oauth_login_click', provider);
      authStore.setLoginInProgress(true);
      authStore.setLoginProvider(provider);
      // Store returnUrl for redirect after OAuth callback
      const returnUrl = searchParams.get('returnUrl');
      if (returnUrl) {
        storePendingRedirect(decodeURIComponent(returnUrl));
      }
      window.location.href = `${serverOrigin}/v1/auth/${provider}`;
    },
    [authStore, searchParams],
  );

  const handleEmailAuth = useCallback(async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch (error) {
      console.error('Error validating form fields', error);
      return;
    }

    authStore.setLoginProvider('email');
    authStore.setLoginInProgress(true);

    // Get source from URL parameter
    const source = searchParams.get('from') ?? undefined;

    if (authStore.isSignUpMode) {
      logEvent('auth::signup_click', 'email');
      const { data } = await getClient().emailSignup({
        body: {
          email: values.email,
          password: values.password,
        },
      });
      authStore.setLoginInProgress(false);

      if (data?.success) {
        // Note: No need to close modal as this is a standalone login page
        if (data.data?.skipVerification) {
          // Get entry_point from localStorage and clear it
          const entryPoint = getAndClearSignupEntryPoint();
          // Log signup success event with source and entry_point
          logEvent('signup_success', null, {
            ...(source ? { source } : {}),
            ...(entryPoint ? { entry_point: entryPoint } : {}),
            user_type: 'free',
          });
          authStore.reset();
          const returnUrl = searchParams.get('returnUrl');
          const redirectUrl = returnUrl
            ? decodeURIComponent(returnUrl)
            : isPublicAccessPage
              ? window.location.href
              : '/workspace';
          window.location.replace(redirectUrl);
        } else {
          authStore.setEmail(values.email);
          authStore.setSessionId(data.data?.sessionId ?? null);
          authStore.setVerificationModalOpen(true);
        }
      }
    } else {
      logEvent('auth::login_click', 'email');
      const { data } = await getClient().emailLogin({
        body: {
          email: values.email,
          password: values.password,
        },
      });
      authStore.setLoginInProgress(false);

      if (data?.success) {
        // Log login success event with source
        logEvent('login_success', null, source ? { source } : undefined);
        // Note: No need to close modal as this is a standalone login page
        authStore.reset();
        const returnUrl = searchParams.get('returnUrl');
        const redirectUrl = returnUrl ? decodeURIComponent(returnUrl) : '/workspace';
        window.location.replace(redirectUrl);
      }
    }
  }, [authStore, form, isPublicAccessPage, searchParams]);

  const handleResetPassword = useCallback(() => {
    authStore.setResetPasswordModalOpen(true);
  }, [authStore]);

  const handleModeSwitch = useCallback(
    (signUp: boolean) => {
      authStore.setIsSignUpMode(signUp);
      form.resetFields();
    },
    [form, authStore],
  );

  const handleToggleEmailForm = useCallback(() => {
    setIsEmailFormExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className="h-screen w-full flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: 'var(--refly-bg-login-page)' }}
    >
      {/* Desktop: Left side - Introduction section */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center px-16 py-12 overflow-y-auto">
        <div className="flex items-center justify-center">
          {/* Introduction image */}
          <div
            className="rounded-xl overflow-hidden flex-shrink-0"
            style={{
              width: '646px',
              height: '644px',
              aspectRatio: '323/322',
              backgroundColor: 'var(--refly-bg-content-z2)',
            }}
          >
            <img
              src={isDarkMode ? loginDarkImage : loginImage}
              alt="Welcome to Refly"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-[60px] lg:py-8 overflow-y-auto">
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
              {authStore.isSignUpMode
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
              {authStore.isSignUpMode
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
            {(isGithubEnabled || isGoogleEnabled) && (
              <div className="flex flex-col items-stretch w-full" style={{ gap: '12px' }}>
                {isGoogleEnabled && (
                  <OAuthButton
                    provider="google"
                    onClick={() => handleLogin('google')}
                    loading={authStore.loginInProgress && authStore.loginProvider === 'google'}
                    disabled={authStore.loginInProgress && authStore.loginProvider !== 'google'}
                    loadingText={t('landingPage.loginModal.loggingStatus')}
                    buttonText={t('landingPage.loginModal.oauthBtn.google')}
                  />
                )}
                {isGithubEnabled && (
                  <OAuthButton
                    provider="github"
                    onClick={() => handleLogin('github')}
                    loading={authStore.loginInProgress && authStore.loginProvider === 'github'}
                    disabled={authStore.loginInProgress && authStore.loginProvider !== 'github'}
                    loadingText={t('landingPage.loginModal.loggingStatus')}
                    buttonText={t('landingPage.loginModal.oauthBtn.github')}
                  />
                )}
              </div>
            )}

            {(isGithubEnabled || isGoogleEnabled) && isEmailEnabled && (
              <div
                className="flex flex-row items-center w-full"
                style={{
                  gap: '20px',
                }}
              >
                <div className="login-divider-line" />
                <Button
                  type="link"
                  className="px-0 py-0 border-0 bg-transparent h-auto flex-shrink-0"
                  onClick={handleToggleEmailForm}
                  data-cy="email-form-toggle"
                  style={{
                    fontSize: '12px',
                    fontWeight: 400,
                    lineHeight: '1.3333333333333333em',
                    color: 'var(--refly-text-3, rgba(28, 31, 35, 0.6))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{t('landingPage.loginModal.or')}</span>
                  <span
                    className={`inline-block transition-transform duration-200 ${isEmailFormExpanded ? 'rotate-180' : ''}`}
                    style={{
                      width: '12px',
                      height: '12px',
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M9.1858 8.12983C9.3835 8.32753 9.70397 8.32753 9.90167 8.12983C10.0994 7.93212 10.0994 7.61166 9.90167 7.41395L6.35789 3.87017C6.16018 3.67246 5.83972 3.67246 5.64201 3.87017L2.09823 7.41395C1.90052 7.61166 1.90052 7.93212 2.09823 8.12983C2.29593 8.32753 2.6164 8.32753 2.81411 8.12983L5.99995 4.94398L9.1858 8.12983Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                </Button>
                <div className="login-divider-line" />
              </div>
            )}

            {isEmailEnabled && isEmailFormExpanded && (
              <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                  <div className="flex flex-col w-full" style={{ gap: '20px' }}>
                    <Form form={form} layout="vertical" className="w-full" requiredMark={false}>
                      <div className="flex flex-col w-full" style={{ gap: '12px' }}>
                        <Form.Item
                          className="mb-0"
                          name="email"
                          label={
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                lineHeight: '1.4285714285714286em',
                                color: 'var(--refly-text-0)',
                              }}
                            >
                              {t('landingPage.loginModal.emailLabel')}
                            </span>
                          }
                          validateTrigger={['onBlur']}
                          hasFeedback
                          rules={[
                            {
                              required: true,
                              message: t('verifyRules.emailRequired'),
                            },
                            {
                              type: 'email',
                              message: t('verifyRules.emailInvalid'),
                            },
                          ]}
                        >
                          <Input
                            type="email"
                            placeholder={t('landingPage.loginModal.emailPlaceholder')}
                            className="login-input"
                            data-cy="email-input"
                          />
                        </Form.Item>

                        <Form.Item
                          className="mb-0"
                          name="password"
                          label={
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                lineHeight: '1.4285714285714286em',
                                color: 'var(--refly-text-0)',
                              }}
                            >
                              {t('landingPage.loginModal.passwordLabel')}
                            </span>
                          }
                          validateTrigger={['onBlur']}
                          hasFeedback
                          rules={[
                            {
                              required: true,
                              message: t('verifyRules.passwordRequired'),
                            },
                            ...(authStore.isSignUpMode
                              ? [
                                  {
                                    min: 8,
                                    message: t('verifyRules.passwordMin'),
                                  },
                                ]
                              : []),
                          ]}
                        >
                          <Input.Password
                            placeholder={t('landingPage.loginModal.passwordPlaceholder')}
                            className="login-input"
                            data-cy="password-input"
                          />
                        </Form.Item>

                        {!authStore.isSignUpMode && (
                          <div className="flex justify-start">
                            <Button
                              type="link"
                              className="p-0 h-auto"
                              onClick={handleResetPassword}
                              style={{
                                fontSize: '14px',
                                fontWeight: 400,
                                lineHeight: '1.4285714285714286em',
                                color: 'var(--refly-text-0)',
                              }}
                            >
                              <span className="hover:text-refly-primary-default">
                                {t('landingPage.loginModal.passwordForget')}
                              </span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </Form>
                  </div>
                  <div
                    className="flex flex-row justify-center items-center"
                    style={{
                      gap: '8px',
                      width: '394px',
                      maxWidth: '100%',
                      margin: '0 auto',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 400,
                        lineHeight: '1.7142857142857142em',
                        color: 'var(--refly-text-0)',
                      }}
                    >
                      {t(
                        authStore.isSignUpMode
                          ? 'landingPage.loginModal.signinHint'
                          : 'landingPage.loginModal.signupHint',
                      )}
                    </span>
                    <Button
                      type="link"
                      className="p-0 h-auto"
                      data-cy={
                        authStore.isSignUpMode
                          ? 'switch-to-signin-button'
                          : 'switch-to-signup-button'
                      }
                      onClick={() => handleModeSwitch(!authStore.isSignUpMode)}
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        lineHeight: '1.7142857142857142em',
                        color: 'var(--refly-text-0)',
                        padding: 0,
                      }}
                    >
                      <span className="hover:text-refly-primary-default">
                        {t(
                          authStore.isSignUpMode
                            ? 'landingPage.loginModal.signin'
                            : 'landingPage.loginModal.signup',
                        )}
                      </span>
                    </Button>
                  </div>
                </div>
                <Button
                  type="primary"
                  onClick={handleEmailAuth}
                  loading={authStore.loginInProgress && authStore.loginProvider === 'email'}
                  className="w-full text-base font-semibold rounded-lg"
                  style={{
                    height: '40px',
                    backgroundColor: 'var(--refly-primary-default)',
                    borderColor: 'var(--refly-primary-default)',
                    boxShadow: '0px 2px 4px 0px rgba(16, 24, 40, 0.05)',
                    fontSize: '14px',
                    fontWeight: 600,
                    lineHeight: '1.4285714285714286em',
                  }}
                  data-cy="continue-button"
                >
                  {t('landingPage.loginModal.continue')}
                </Button>
              </div>
            )}

            {!isEmailFormExpanded && isEmailEnabled && !(isGithubEnabled || isGoogleEnabled) && (
              <Button
                type="link"
                className="p-0 !text-refly-text-2 mt-2"
                onClick={handleToggleEmailForm}
              >
                <span className="hover:text-refly-primary-default">
                  {t('landingPage.loginModal.or')}
                </span>
              </Button>
            )}

            <div
              className="text-center w-full"
              style={{
                fontSize: '12px',
                fontWeight: 400,
                lineHeight: '1.3333333333333333em',
                color: 'var(--refly-text-3, rgba(28, 31, 35, 0.6))',
              }}
            >
              {t('landingPage.loginModal.utilText')}{' '}
              <Link
                to="https://docs.refly.ai/about/terms-of-service"
                target="_blank"
                className="underline hover:text-refly-primary-hover break-words"
                style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  lineHeight: '1.3333333333333333em',
                  color: 'var(--refly-text-3, rgba(28, 31, 35, 0.6))',
                }}
              >
                {t('landingPage.loginModal.terms')}
              </Link>{' '}
              {t('landingPage.loginModal.and')}{' '}
              <Link
                to="https://docs.refly.ai/about/privacy-policy"
                target="_blank"
                className="underline hover:text-refly-primary-hover break-words"
                style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  lineHeight: '1.3333333333333333em',
                  color: 'var(--refly-text-3, rgba(28, 31, 35, 0.6))',
                }}
              >
                {t('landingPage.loginModal.privacyPolicy')}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <VerificationModal />
      <ResetPasswordModal />
    </div>
  );
};

export default LoginPage;
