import { PureCopilot } from '@refly-packages/ai-workspace-common/components/pure-copilot';
import { Home } from 'refly-icons';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import { useCallback } from 'react';

export const PureCopilotModal = () => {
  const { t } = useTranslation();

  const { hidePureCopilotModal, setHidePureCopilotModal, userProfile } = useUserStoreShallow(
    (state) => ({
      hidePureCopilotModal: state.hidePureCopilotModal,
      setHidePureCopilotModal: state.setHidePureCopilotModal,
      userProfile: state.userProfile,
    }),
  );

  const needOnboarding = userProfile?.preferences?.needOnboarding;

  const handleClose = useCallback(() => {
    setHidePureCopilotModal(true);
  }, [setHidePureCopilotModal]);

  if (hidePureCopilotModal || !needOnboarding) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 bg-refly-bg-canvas flex flex-col items-center justify-center">
      <Tooltip title={t('common.goBack')} arrow={false}>
        <Button
          type="text"
          className="absolute top-[calc(var(--banner-height)+1rem)] left-4 !w-8 !h-8"
          icon={<Home size={24} />}
          onClick={handleClose}
        />
      </Tooltip>
      <div className="py-10 my-auto w-full overflow-y-auto">
        <PureCopilot source="onboarding" />
      </div>
    </div>
  );
};
