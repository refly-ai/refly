import { Button, Modal, Divider, Input, Form } from 'antd';
import { Link } from '@refly-packages/ai-workspace-common/utils/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { OAuthButton } from './oauth-button';

import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useAuthStoreShallow } from '@refly/stores';
import { serverOrigin } from '@refly/ui-kit';
import { useGetAuthConfig } from '@refly-packages/ai-workspace-common/queries';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { logEvent } from '@refly/telemetry-web';

interface FormValues {
  email: string;
  password: string;
}

const LoginModal = (props: { visible?: boolean; from?: string }) => {
  const [form] = Form.useForm<FormValues>();
  const [searchParams] = useSearchParams();
  const [isEmailFormExpanded, setIsEmailFormExpanded] = useState(false);

  const authStore = useAuthStoreShallow((state) => ({
    loginInProgress: state.loginInProgress,
    loginProvider: state.loginProvider,
    loginModalOpen: state.loginModalOpen,
    isSignUpMode: state.isSignUpMode,
    setLoginInProgress: state.setLoginInProgress,
    setLoginProvider: state.setLoginProvider,
    setLoginModalOpen: state.setLoginModalOpen,
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

  /**
   * 0. Get the login status from the main site. If not logged in, visit the Login page; after logging in, display the home page
   * 1. Open a modal to access the Refly main site for login
   * 2. After logging in, use Chrome's API to send a message to the extension. Upon receiving the message, reload the page to get the login status, then persist it
   * 3. Subsequently, make requests with the cookie or login status
   */
  const handleLogin = useCallback(
    (provider: 'github' | 'google') => {
      logEvent('auth::oauth_login_click', provider);
      authStore.setLoginInProgress(true);
      authStore.setLoginProvider(provider);
      location.href = `${serverOrigin}/v1/auth/${provider}`;
    },
    [authStore],
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
        authStore.setLoginModalOpen(false);

        if (data.data?.skipVerification) {
          authStore.reset();
          const returnUrl = searchParams.get('returnUrl');
          const redirectUrl = returnUrl
            ? decodeURIComponent(returnUrl)
            : isPublicAccessPage
              ? window.location.href
              : '/';
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
        authStore.setLoginModalOpen(false);
        authStore.reset();
        const returnUrl = searchParams.get('returnUrl');
        const redirectUrl = returnUrl
          ? decodeURIComponent(returnUrl)
          : isPublicAccessPage
            ? window.location.href
            : '/';
        window.location.replace(redirectUrl);
      }
    }
  }, [authStore, form, isPublicAccessPage, searchParams]);

  const handleResetPassword = useCallback(() => {
    authStore.setLoginModalOpen(false);
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

  useEffect(() => {
    if (!authStore.loginModalOpen) {
      authStore.setIsSignUpMode(false);
      setIsEmailFormExpanded(false);
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

        <div className="flex flex-col items-center justify-center p-10">
          {(isGithubEnabled || isGoogleEnabled) && (
            <div className="flex flex-col items-center justify-center gap-2 w-full">
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
            <Divider className="!mb-3 !mt-8 !h-4">
              <Button
                type="link"
                className="px-3 py-1 text-xs font-normal border-0 bg-transparent"
                onClick={handleToggleEmailForm}
                data-cy="email-form-toggle"
              >
                <span className="mr-0 text-refly-text-2">{t('landingPage.loginModal.or')}</span>
                <span
                  className={`transition-transform duration-200 text-refly-text-2 ${isEmailFormExpanded ? 'rotate-180' : ''}`}
                >
                  ▼
                </span>
              </Button>
            </Divider>
          )}

          {isEmailEnabled && isEmailFormExpanded && (
            <>
              <Form form={form} layout="vertical" className="w-full" requiredMark={false}>
                <Form.Item
                  className="mb-3"
                  name="email"
                  label={
                    <span className="font-medium">{t('landingPage.loginModal.emailLabel')}</span>
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
                    className="h-8"
                    data-cy="email-input"
                  />
                </Form.Item>

                <Form.Item
                  className="mb-3"
                  name="password"
                  label={t('landingPage.loginModal.passwordLabel')}
                  labelCol={{ style: { fontWeight: 500 } }}
                  extra={
                    !authStore.isSignUpMode && (
                      <div className="flex justify-start mt-1 mb-1">
                        <Button
                          type="link"
                          className="p-0 !text-refly-text-2"
                          onClick={handleResetPassword}
                        >
                          <span className="hover:text-refly-primary-default">
                            {t('landingPage.loginModal.passwordForget')}
                          </span>
                        </Button>
                      </div>
                    )
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
                    className="h-8"
                    data-cy="password-input"
                  />
                </Form.Item>

                <Form.Item className="mb-0">
                  <Button
                    type="primary"
                    onClick={handleEmailAuth}
                    loading={authStore.loginInProgress && authStore.loginProvider === 'email'}
                    className="h-10 w-full text-base shadow-md"
                    data-cy="continue-button"
                  >
                    {t('landingPage.loginModal.continue')}
                  </Button>
                </Form.Item>
              </Form>
              <div className="mt-3 text-sm">
                <span>
                  {t(
                    authStore.isSignUpMode
                      ? 'landingPage.loginModal.signinHint'
                      : 'landingPage.loginModal.signupHint',
                  )}{' '}
                  <Button
                    type="link"
                    className="p-0 !text-refly-text-2"
                    data-cy={
                      authStore.isSignUpMode ? 'switch-to-signin-button' : 'switch-to-signup-button'
                    }
                    onClick={() => handleModeSwitch(!authStore.isSignUpMode)}
                  >
                    <span className="hover:text-refly-primary-default">
                      {t(
                        authStore.isSignUpMode
                          ? 'landingPage.loginModal.signin'
                          : 'landingPage.loginModal.signup',
                      )}
                    </span>
                  </Button>
                </span>
              </div>
            </>
          )}

          <div className="mt-3 text-center text-xs text-gray-500">
            {t('landingPage.loginModal.utilText')}
            <Link
              to="https://docs.refly.ai/about/terms-of-service"
              target="_blank"
              className="mx-1 text-xs text-green-600 underline"
              onClick={() => {
                authStore.setLoginModalOpen(false);
              }}
            >
              {t('landingPage.loginModal.terms')}
            </Link>
            {t('landingPage.loginModal.and')}
            <Link
              to="https://docs.refly.ai/about/privacy-policy"
              target="_blank"
              className="mx-1 text-xs text-green-600 underline"
              onClick={() => {
                authStore.setLoginModalOpen(false);
              }}
            >
              {t('landingPage.loginModal.privacyPolicy')}
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Optimize with memo to prevent unnecessary re-renders
export const MemoizedLoginModal = React.memo(LoginModal);
export { MemoizedLoginModal as LoginModal };
