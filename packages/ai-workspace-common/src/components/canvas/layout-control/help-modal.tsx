import { memo, useEffect, useState } from 'react';
import { Modal, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { RiFullscreenFill, RiFullscreenExitFill } from 'react-icons/ri';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpModal = memo(({ visible, onClose }: HelpModalProps) => {
  const { i18n, t } = useTranslation();
  const displayLanguage = i18n.language === 'en' ? 'en' : 'zh';
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));

  const { mutate: updateSettings } = useUpdateSettings();

  const enVersion =
    'https://app.tango.us/app/embed/c73a9215-4556-481d-9232-5852c34c6477?skipCover=false&defaultListView=false&skipBranding=false&makeViewOnly=true&hideAuthorAndDetails=false';
  const zhVersion =
    'https://app.tango.us/app/embed/765107d0-5edc-4f8c-8621-0676601587d2?skipCover=false&defaultListView=false&skipBranding=false&makeViewOnly=true&hideAuthorAndDetails=false';

  const handleComplete = () => {
    setUserProfile({
      ...userProfile,
      onboarding: {
        ...userProfile?.onboarding,
        tour: 'completed',
      },
    });

    updateSettings({
      body: {
        onboarding: {
          ...userProfile?.onboarding,
          tour: 'completed',
        },
      },
    });

    onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 3000);
  }, []);

  return (
    <Modal
      centered={!isFullscreen}
      width={isFullscreen ? '100vw' : 800}
      open={visible}
      onCancel={onClose}
      footer={null}
      title={t('canvas.toolbar.interativeTutorial')}
      className={`help-modal ${isFullscreen ? 'fullscreen' : ''}`}
      style={isFullscreen ? { top: 0, padding: 0, maxWidth: '100vw', margin: 0 } : undefined}
    >
      <div className={`mb-6 ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
        <div
          className="relative"
          style={{
            height: isFullscreen ? 'calc(100vh - 140px)' : '450px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '20px',
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 z-50 rounded-[20px]">
              <Spin className="w-6 h-6" />
              <div className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                {t('canvas.toolbar.interativeTutorialLoading')}
              </div>
            </div>
          )}
          <div
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              position: 'relative',
              borderRadius: '20px',
            }}
          >
            <iframe
              src={displayLanguage === 'en' ? enVersion : zhVersion}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '20px',
                opacity: isLoading ? 0 : 1,
                transition: 'opacity 0.3s ease-in-out',
              }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
              allow="fullscreen"
              title={t('canvas.toolbar.interativeTutorial')}
              referrerPolicy="origin"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-auto">
        <Button
          icon={isFullscreen ? <RiFullscreenExitFill /> : <RiFullscreenFill />}
          onClick={toggleFullscreen}
        >
          {t(isFullscreen ? 'canvas.toolbar.exitFullscreen' : 'canvas.toolbar.enterFullscreen')}
        </Button>
        <Button type="primary" onClick={handleComplete}>
          {t('canvas.toolbar.completeTutorial')}
        </Button>
      </div>
    </Modal>
  );
});

HelpModal.displayName = 'HelpModal';
