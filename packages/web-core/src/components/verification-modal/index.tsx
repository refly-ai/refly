import { Modal, Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useAuthStore, useAuthStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { InvalidVerificationSession } from '@refly/errors';

const RESEND_INTERVAL = 30;

export const VerificationModal = () => {
  const { t } = useTranslation();
  const authStore = useAuthStoreShallow((state) => ({
    email: state.email,
    verificationModalOpen: state.verificationModalOpen,
    setVerificationModalOpen: state.setVerificationModalOpen,
    reset: state.reset,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (authStore.verificationModalOpen) {
      setCountdown(RESEND_INTERVAL);
    }
  }, [authStore.verificationModalOpen]);

  const handleSubmit = async () => {
    if (!otp) return;

    const { sessionId } = useAuthStore.getState();
    if (!sessionId) {
      message.error(t('emailVerification.sessionNotFound'));
      return;
    }

    setIsLoading(true);
    const { data } = await getClient().checkVerification({
      body: {
        code: otp,
        sessionId: sessionId,
      },
    });
    setIsLoading(false);

    if (data?.errCode === new InvalidVerificationSession().code) {
      authStore.reset();
      return;
    }

    if (data?.success) {
      authStore.reset();
      window.location.replace('/workspace');
    }
  };

  const handleResend = async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return;

    setResendLoading(true);
    await getClient().resendVerification({ body: { sessionId } });
    setResendLoading(false);

    setCountdown(RESEND_INTERVAL);

    message.success(t('emailVerification.resendSuccess'));
  };

  return (
    <Modal
      centered
      open={authStore.verificationModalOpen}
      onCancel={() => authStore.setVerificationModalOpen(false)}
      footer={null}
      destroyOnHidden
      title={t('emailVerification.title')}
    >
      <div className="flex flex-col gap-4 py-1">
        <p className="text-sm text-gray-700">
          {t('emailVerification.description', { email: authStore.email })}
        </p>
        <div className="flex items-center justify-center">
          <Input.OTP size="large" autoFocus value={otp} onChange={(code) => setOtp(code)} />
        </div>
        <div className="flex items-center text-sm">
          <div className="text-gray-500">{t('emailVerification.resendHint')} </div>

          <Button
            type="link"
            size="small"
            className="text-sm"
            loading={resendLoading}
            disabled={countdown > 0}
            onClick={handleResend}
          >
            {t('emailVerification.resend') + (countdown > 0 ? ` (${countdown})` : '')}
          </Button>
        </div>

        <Button
          type="primary"
          onClick={handleSubmit}
          loading={isLoading}
          disabled={otp?.length !== 6}
          className="w-full"
        >
          {t('emailVerification.submit')}
        </Button>
      </div>
    </Modal>
  );
};
