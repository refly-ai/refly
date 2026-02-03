import { Button, Input, message, Popover } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';
import { logEvent } from '@refly/telemetry-web';
import { useUserStoreShallow } from '@refly/stores';

const INVITATION_CODE_LENGTH = 6;

interface ActivationCodeInputProps {
  onSuccess?: () => void;
  showDiscordButton?: boolean;
  className?: string;
}

export const ActivationCodeInput: React.FC<ActivationCodeInputProps> = ({
  onSuccess,
  showDiscordButton = true,
  className = '',
}) => {
  const { t } = useTranslation();

  const userStore = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    showInvitationCodeModal: state.showInvitationCodeModal,
    setShowInvitationCodeModal: state.setShowInvitationCodeModal,
    setShowOnboardingFormModal: state.setShowOnboardingFormModal,
  }));

  // Invitation code activation state
  const [activationCode, setActivationCode] = useState('');
  const [activatingCode, setActivatingCode] = useState(false);

  // Activate invitation code
  const handleActivateInvitationCode = async () => {
    if (activatingCode || !activationCode.trim()) return;

    setActivatingCode(true);
    try {
      const response = await getClient().activateInvitationCode({
        body: { code: activationCode.trim() },
      });

      if (!response.data.success) {
        const errorMessage = response.data.errMsg
          ? t(response.data.errMsg)
          : t('settings.account.activateInvitationCodeFailed');
        message.error(errorMessage);
        return;
      }

      message.success(t('settings.account.activateInvitationCodeSuccess'));
      logEvent('invite_success');
      setActivationCode(''); // Clear input after success
      onSuccess?.(); // Call success callback
    } catch (error) {
      console.error('Error activating invitation code:', error);
      message.error(t('settings.account.activateInvitationCodeFailed'));
    } finally {
      setActivatingCode(false);
    }
  };

  // Join Discord community
  const handleJoinDiscord = () => {
    window.open('https://discord.gg/YVuYFjFvRC', '_blank');
  };

  const handleSkip = async () => {
    try {
      const response = await getClient().skipInvitationCode();
      if (response.data?.success) {
        // Close invitation code modal
        userStore.setShowInvitationCodeModal(false);
        // Open onboarding form modal immediately
        userStore.setShowOnboardingFormModal(true);
      }
    } catch (error) {
      console.error('Error skipping invitation code:', error);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Activate Invitation Code */}
      <div className="flex justify-center">
        <div style={{ width: 308, height: 68 }}>
          <Input.OTP
            length={INVITATION_CODE_LENGTH}
            value={activationCode}
            onChange={(value) => setActivationCode(value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleActivateInvitationCode();
              }
            }}
          />
        </div>
      </div>
      <div className="flex flex-row items-center gap-3" style={{ width: 308 }}>
        <Button
          type="primary"
          onClick={handleActivateInvitationCode}
          loading={activatingCode}
          disabled={activatingCode || (activationCode ?? '').trim().length < INVITATION_CODE_LENGTH}
          className="!flex-1 !h-9 !rounded-lg !border-0 !bg-[#0E9F77] hover:!bg-[#0B8A66] focus:!bg-[#0E9F77]"
          style={{ padding: '6px 12px' }}
        >
          <div className="flex items-center gap-1">
            <IconLightning01 className="w-4 h-4 text-white" />
            <span className="font-semibold text-base text-white">
              {activatingCode
                ? t('common.activating')
                : t('settings.account.activateInvitationCode')}
            </span>
          </div>
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          className="flex justify-center items-center cursor-pointer h-9 rounded-lg border border-[rgba(28,31,35,0.1)] bg-white px-3 text-base text-[#1C1F23] hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
          style={{ width: 75 }}
        >
          {t('invitationCode.skip')}
        </button>
      </div>

      {showDiscordButton && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex justify-center">
            <span className="text-refly-text-3 text-sm">
              {t('invitationCode.dontHaveInvitationCode')}
            </span>
          </div>
          <Button
            type="text"
            size="middle"
            className="text-sm !text-refly-primary-default font-semibold rounded-lg border border-solid border-refly-primary-default hover:bg-refly-tertiary-hover"
            onClick={handleJoinDiscord}
            style={{ width: 220, height: 36 }}
          >
            {t('common.joinDiscord')}
          </Button>
          <Popover
            content={
              <div className="flex flex-col items-center p-3">
                <div className="w-[180px] h-[180px] rounded-xl overflow-hidden bg-white p-2">
                  <img
                    src="https://static.refly.ai/landing/wechat-qrcode.webp"
                    alt="WeChat Group QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-sm text-refly-text-0 mt-3 font-medium">
                  {t('landingPage.footer.contactUs.scanToJoinWechatGroup')}
                </div>
              </div>
            }
            trigger="hover"
            placement="bottom"
            arrow={true}
            overlayInnerStyle={{
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className="flex items-center gap-1 cursor-pointer group hover:bg-refly-tertiary-hover rounded-lg p-1">
              <span className="text-refly-text-3 text-sm">
                {t('landingPage.footer.contactUs.orWeChat')}
              </span>
            </div>
          </Popover>
        </div>
      )}
    </div>
  );
};
