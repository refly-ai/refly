import { Modal, message, Skeleton } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { InvitationCode } from '@refly/openapi-schema';
import { useUserStoreShallow } from '@refly/stores';
import InviteIcon from '@refly-packages/ai-workspace-common/assets/invite.svg';
import { IconCopy } from '@refly-packages/ai-workspace-common/components/common/icon';

const INVITATION_LIMIT = 20;

interface InvitationCodeCardProps {
  code: InvitationCode;
  onCopy: (code: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const InvitationCodeCard = memo<InvitationCodeCardProps>(({ code, onCopy, t }) => {
  const isPending = code.status === 'pending';
  const isAccepted = code.status === 'accepted';

  const cardClassName = isPending
    ? 'group flex min-h-[54px] h-[54px] cursor-pointer items-center justify-between rounded-[10px] border border-solid border-refly-primary-default px-2.5 transition-colors hover:bg-black/[0.08]'
    : isAccepted
      ? 'flex min-h-[54px] h-[54px] items-center justify-between gap-1 rounded-[10px] border border-solid border-[rgba(28,31,35,0.1)] px-2.5'
      : 'flex min-h-[54px] h-[54px] items-center justify-between rounded-[10px] border border-solid border-refly-border-primary px-2.5';

  const handleClick = useCallback(() => {
    if (isPending) {
      onCopy(code.code ?? '');
    }
  }, [isPending, code.code, onCopy]);

  return (
    <div className={cardClassName} onClick={handleClick} role={isPending ? 'button' : undefined}>
      <span
        className={`font-mono text-sm font-medium leading-[20px] ${
          isPending ? '!text-refly-text-0' : '!text-[rgba(28,31,35,0.35)]'
        }`}
      >
        {code.code}
      </span>
      {isPending ? (
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <IconCopy className="h-[14px] w-[14px] text-refly-text-2" strokeWidth={1.5} />
        </div>
      ) : isAccepted ? (
        <span className="flex-shrink-0 text-xs font-normal leading-[18px] text-[rgba(28,31,35,0.35)]">
          {t('settings.account.invitationReward', { amount: 500 })}
        </span>
      ) : null}
    </div>
  );
});

InvitationCodeCard.displayName = 'InvitationCodeCard';

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
      const invitationText = `✨ Unlock Refly.ai's vibe-workflow: one minute to generate production-ready workflow

 ⚡ Supercharge your automation with Banana Pro, Gemini 3.0, and other top-tier AI models

 🎁 Plus 500 free credits to help you get started!

🔑 Invitation Code: ${invitationCode}

 🚀 Join here → ${window.location.origin}`;
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

  const availableText = t('settings.account.availableInvitationCodesText', {
    available: invitationOverview.pendingCodes.length,
    total: INVITATION_LIMIT,
  });

  return (
    <Modal
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      width={440}
      centered
      styles={{ content: { paddingBottom: 0 }, body: { paddingBottom: 0 } }}
    >
      <div className="px-6 pt-6 space-y-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <img src={InviteIcon} alt="Invite" className="w-16 h-16" />
          <h3 className="text-lg font-semibold text-refly-text-0">
            {t('settings.account.inviteFriendsTitle')}
          </h3>
          <p className="text-xs text-refly-text-2">{t('settings.account.inviteFriendsSubtitle')}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-lg">
          {loadingCodes ? (
            <Skeleton
              active
              paragraph={{ rows: 0 }}
              title={{ width: 120, style: { margin: '0 auto' } }}
            />
          ) : (
            <p className="text-sm text-refly-text-0 text-center font-semibold">{availableText}</p>
          )}
          {loadingCodes ? (
            <div className="-mx-4 max-h-[360px] overflow-y-auto px-4">
              <div className="grid grid-cols-2 gap-2 pb-8">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex min-h-[54px] h-[54px] items-center rounded-[10px] border border-solid border-refly-primary-default px-2.5"
                  >
                    <Skeleton.Input
                      active
                      size="small"
                      style={{
                        width: 70,
                        minWidth: 70,
                        height: 20,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : invitationOverview.sortedCodes.length > 0 ? (
            <div className="-mx-4 max-h-[360px] overflow-y-auto px-4">
              <div className="grid grid-cols-2 gap-2 pb-8">
                {invitationOverview.sortedCodes.map((code, index) => (
                  <InvitationCodeCard
                    key={code.code ?? index}
                    code={code}
                    onCopy={handleCopyInvitationCode}
                    t={t}
                  />
                ))}
              </div>
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
