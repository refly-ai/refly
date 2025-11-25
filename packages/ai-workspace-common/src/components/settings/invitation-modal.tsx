import { Modal, message } from 'antd';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { InvitationCode } from '@refly/openapi-schema';
import { useUserStoreShallow } from '@refly/stores';
import InviteIcon from '@refly-packages/ai-workspace-common/assets/invite.svg';
import { IconCheck } from '@refly-packages/ai-workspace-common/components/common/icon';

const INVITATION_LIMIT = 5;

interface InvitationModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // Invitation codes state
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);

  // Fetch invitation codes
  const fetchInvitationCodes = async () => {
    if (loadingCodes) return;
    setLoadingCodes(true);
    try {
      const { data, error } = await getClient().listInvitationCodes();
      if (error) {
        console.error('Error fetching invitation codes:', error);
        return;
      }
      if (data?.data) {
        setInvitationCodes(data.data);
      }
    } catch (error) {
      console.error('Error fetching invitation codes:', error);
    } finally {
      setLoadingCodes(false);
    }
  };

  // Copy invitation code to clipboard
  const handleCopyInvitationCode = async (invitationCode: string) => {
    try {
      const invitationText = `- Unlock Refly.ai's vibe-workflow and supercharge your automation with Banana, Gemini, and other top-tier AI models — plus 3,000 free credits to get you started!\n\nInvitation code: ${invitationCode}\n\nJoin here → https://refly.ai`;
      await navigator.clipboard.writeText(invitationText);
      message.success(t('settings.account.invitationCodeCopied'));
    } catch (error) {
      console.error('Failed to copy invitation code:', error);
      message.error(t('settings.account.invitationCodeCopyFailed'));
    }
  };

  // Load invitation codes when modal opens
  useEffect(() => {
    if (visible && userProfile?.uid) {
      fetchInvitationCodes();
    }
  }, [visible, userProfile?.uid]);

  // Calculate invitation overview
  const invitationOverview = useMemo(() => {
    const pendingCodes: InvitationCode[] = [];
    const acceptedCodes: InvitationCode[] = [];
    const otherCodes: InvitationCode[] = [];

    for (const code of invitationCodes) {
      const status = code?.status ?? '';
      if (status === 'pending') {
        pendingCodes.push(code);
      } else if (status === 'accepted') {
        acceptedCodes.push(code);
      } else {
        otherCodes.push(code);
      }
    }

    return {
      pendingCodes,
      acceptedCodes,
      sortedCodes: [...pendingCodes, ...acceptedCodes, ...otherCodes],
    };
  }, [invitationCodes]);

  const usageText = t('settings.account.invitationLimitText', {
    used: invitationOverview.acceptedCodes.length,
    limit: INVITATION_LIMIT,
  });

  return (
    <Modal open={visible} onCancel={() => setVisible(false)} footer={null} width={440} centered>
      <div className="p-6 space-y-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <img src={InviteIcon} alt="Invite" className="w-16 h-16" />
          <h3 className="text-lg font-semibold text-refly-text-0">
            {t('settings.account.inviteFriendsTitle')}
          </h3>
          <p className="text-xs text-refly-text-2">{t('settings.account.inviteFriendsSubtitle')}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-lg p-4">
          <p className="text-sm text-refly-text-0 text-center font-semibold">{usageText}</p>
          {invitationOverview.sortedCodes.length > 0 ? (
            <div className="space-y-3">
              {invitationOverview.sortedCodes.map((code, index) => (
                <div
                  key={code.code || index}
                  className={`p-3 rounded-lg ${
                    code.status === 'pending'
                      ? 'bg-refly-bg-control-z0 cursor-pointer transition-colors border-[1px] border-solid border-refly-primary-default hover:bg-refly-primary-light'
                      : code.status === 'accepted'
                        ? 'bg-refly-bg-control-z0'
                        : 'bg-refly-bg-control-z1'
                  }`}
                  onClick={() =>
                    code.status === 'pending' && handleCopyInvitationCode(code.code || '')
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center justify-center text-base gap-1 bg-refly-bg-content-z2 h-7 rounded-lg min-w-[76px] px-2">
                        <div className="font-mono font-semibold text-refly-primary">
                          {code.code}
                        </div>
                      </div>
                      {code.status === 'accepted' && code.updatedAt ? (
                        <div className="flex items-center justify-center gap-1 text-refly-text-3">
                          <div className="w-3 h-3 rounded-full flex items-center justify-center border-[1.5px] border-solid border-refly-primary">
                            <IconCheck className="w-2 h-2 text-refly-primary" strokeWidth={3} />
                          </div>
                          <span className="text-[12px] font-medium leading-[16px]">
                            {t('invitationCode.reward')}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`text-base font-medium px-2 py-2 rounded-full text-center min-w-[60px] ${
                        code.status === 'pending'
                          ? 'text-refly-primary hover:text-refly-primary-hover'
                          : code.status === 'accepted'
                            ? 'text-refly-text-3 text-xs'
                            : 'text-refly-text-1'
                      }`}
                    >
                      {code.status === 'pending' ? (
                        t('settings.account.copy')
                      ) : code.status === 'accepted' ? (
                        code.updatedAt ? (
                          <span className="text-[12px] font-medium leading-[16px]">
                            {new Date(code.updatedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          t('settings.account.statusUsed')
                        )
                      ) : (
                        code.status || 'Unknown'
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-refly-border-primary px-4 py-8 text-center text-sm text-refly-text-1">
              {t('settings.account.noInvitationCodes')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
