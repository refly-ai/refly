import { Button, Divider, Input, Form } from 'antd';
import { Link } from '@refly-packages/ai-workspace-common/utils/router';
import { useCallback, useMemo, useState } from 'react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { OAuthButton } from './oauth-button';

import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useAuthStoreShallow } from '@refly/stores';
import { serverOrigin } from '@refly/ui-kit';
import { useGetAuthConfig } from '@refly-packages/ai-workspace-common/queries';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { logEvent, updateUserProperties } from '@refly/telemetry-web';
import { getAndClearSignupEntryPoint } from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';
import { storePendingRedirect } from '@refly-packages/ai-workspace-common/hooks/use-pending-redirect';

interface FormValues {
  email: string;
  password: string;
}

interface LoginContentProps {
  from?: string;
  onSuccess?: () => void;
  isStandalone?: boolean;
}

export const LoginContent: React.FC<LoginContentProps> = ({
  from,
  onSuccess,
  isStandalone = false,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [searchParams] = useSearchParams();
  const [isEmailFormExpanded, setIsEmailFormExpanded] = useState(false);

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
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const isPublicAccessPage = usePublicAccessPage();
  const { t } = useTranslation();
  const { data: authConfig, isLoading: isAuthConfigLoading } = useGetAuthConfig();

  const source = useMemo(() => {
    return searchParams.get('from') ?? from ?? undefined;
  }, [searchParams, from]);

  const { isGithubEnabled, isGoogleEnabled, isEmailEnabled } = useMemo(() => {
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
      isEmailEnabled: authConfig.data.some((item) => item.provider === 'email') || true,
    };
  }, [authConfig?.data, isAuthConfigLoading]);

  const handleLogin = useCallback(
    (provider: 'github' | 'google') => {
      logEvent('auth::oauth_login_click', provider);
      authStore.setLoginInProgress(true);
      authStore.setLoginProvider(provider);
      storePendingRedirect();
      window.location.href = `${serverOrigin}/v1/auth/${provider}`;
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
        onSuccess?.();

        if (data.data?.skipVerification) {
          const entryPoint = getAndClearSignupEntryPoint();
          const signupSource = from === 'cli_auth' ? 'refly_cli' : source;
          logEvent('signup_success', null, {
            ...(signupSource ? { source: signupSource } : {}),
            ...(entryPoint ? { entry_point: entryPoint } : {}),
            user_type: 'free',
          });
          if (from === 'cli_auth') {
            updateUserProperties({ is_cli_signup: 'true' });
          }
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
        const loginSource = from === 'cli_auth' ? 'refly_cli' : source;
        logEvent('login_success', null, loginSource ? { source: loginSource } : undefined);
        onSuccess?.();
        authStore.reset();
        const returnUrl = searchParams.get('returnUrl');
        const redirectUrl = returnUrl
          ? decodeURIComponent(returnUrl)
          : isPublicAccessPage
            ? window.location.href
            : '/workspace';
        window.location.replace(redirectUrl);
      }
    }
  }, [authStore, form, isPublicAccessPage, searchParams, source, onSuccess]);

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

  return (
    <div className={`flex flex-col items-center justify-center ${isStandalone ? '' : 'p-10'}`}>
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
            className="px-3 py-1 text-xs font-normal border-0 bg-transparent flex items-center gap-1 h-auto"
            onClick={handleToggleEmailForm}
            data-cy="email-form-toggle"
          >
            <span className="text-refly-text-3">{t('landingPage.loginModal.or')}</span>
            <span
              className={`inline-block transition-transform duration-200 text-refly-text-3 ${
                isEmailFormExpanded ? 'rotate-180' : ''
              }`}
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
        </Divider>
      )}

      {isEmailEnabled && (isEmailFormExpanded || !(isGithubEnabled || isGoogleEnabled)) && (
        <>
          <Form form={form} layout="vertical" className="w-full" requiredMark={false}>
            <Form.Item
              className="mb-3"
              name="email"
              label={
                <span className="font-medium text-refly-text-0">
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
                className="h-8"
                data-cy="email-input"
              />
            </Form.Item>

            <Form.Item
              className="mb-3"
              name="password"
              label={
                <span className="font-medium text-refly-text-0">
                  {t('landingPage.loginModal.passwordLabel')}
                </span>
              }
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
            <span className="text-refly-text-0">
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

      <div className="mt-3 text-center text-xs text-refly-text-2">
        {t('landingPage.loginModal.utilText')}
        <Link
          to="https://docs.refly.ai/about/terms-of-service"
          target="_blank"
          className="mx-1 text-xs text-refly-primary-default underline"
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
          className="mx-1 text-xs text-refly-primary-default underline"
          onClick={() => {
            authStore.setLoginModalOpen(false);
          }}
        >
          {t('landingPage.loginModal.privacyPolicy')}
        </Link>
      </div>
    </div>
  );
};
