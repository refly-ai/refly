import { Button, Input, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';

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

  // Invitation code activation state
  const [activationCode, setActivationCode] = useState('');
  const [activatingCode, setActivatingCode] = useState(false);

  // Activate invitation code
  const handleActivateInvitationCode = async () => {
    if (activatingCode || !activationCode.trim()) return;

    setActivatingCode(true);
    try {
      const { error } = await getClient().activateInvitationCode({
        body: { code: activationCode.trim() },
      });

      if (error) {
        message.error(t('settings.account.activateInvitationCodeFailed'));
        return;
      }

      message.success(t('settings.account.activateInvitationCodeSuccess'));
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
      <div className="flex justify-center">
        <Button
          type="primary"
          onClick={handleActivateInvitationCode}
          loading={activatingCode}
          disabled={activatingCode || (activationCode ?? '').trim().length < INVITATION_CODE_LENGTH}
          style={{ width: 308, height: 36 }}
        >
          <div className="flex items-center gap-1">
            <IconLightning01 className="w-4 h-4" />
            {activatingCode ? t('common.activating') : t('settings.account.activateInvitationCode')}
          </div>
        </Button>
      </div>

      {showDiscordButton && (
        <div className="flex flex-col gap-1 mt-4">
          <div className="flex justify-center">
            <span className="text-refly-text-3 text-sm">
              {t('invitationCode.dontHaveInvitationCode')}
            </span>
          </div>
          <div className="flex justify-center">
            <Button
              type="text"
              size="middle"
              className="text-sm text-refly-primary-default font-semibold bg-refly-tertiary-default hover:bg-refly-tertiary-hover"
              onClick={handleJoinDiscord}
              style={{ width: 220, height: 36 }}
            >
              {t('common.joinDiscord')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
