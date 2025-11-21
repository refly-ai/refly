import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ActivationCodeInput } from '@refly-packages/ai-workspace-common/components/settings/activation-code-input';
import reflyUnionSvg from '@refly-packages/ai-workspace-common/assets/refly-union.svg';

export const InvitationCodeModal = () => {
  const { t } = useTranslation();

  const userStore = useUserStoreShallow((state) => ({
    showInvitationCodeModal: state.showInvitationCodeModal,
    setShowInvitationCodeModal: state.setShowInvitationCodeModal,
  }));

  const handleActivationSuccess = async () => {
    // Check if user has been invited now
    try {
      const invitationResp = await getClient().hasBeenInvited();
      const hasBeenInvited = invitationResp.data?.data ?? false;

      if (hasBeenInvited) {
        // Close modal without refreshing the page
        userStore.setShowInvitationCodeModal(false);
      }
    } catch (error) {
      // If check fails, keep modal open
      console.error('Failed to check invitation status after activation:', error);
    }
  };

  if (!userStore.showInvitationCodeModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-refly-bg-canvas flex flex-col items-center justify-center">
      <div className="max-w-[580px] h-[357px] px-6 flex flex-col items-center mb-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-[32px] font-bold text-gray-900 dark:text-white mb-2 max-w-[540px]">
            <div>{t('invitationCode.title1')}</div>
            <div>{t('invitationCode.title2')}</div>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('invitationCode.description')}</p>
        </div>
        <ActivationCodeInput onSuccess={handleActivationSuccess} />
      </div>
      <img
        src={reflyUnionSvg}
        alt="Refly Union"
        className="w-full absolute bottom-0 left-0 -z-10"
      />
    </div>
  );
};
