import React, { useEffect, useState } from 'react';
import { Modal, Typography, Radio, Button, Steps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { UILocaleList } from '../ui-locale-list';
import { OutputLocaleList } from '../output-locale-list';
import { DownOutlined } from '@ant-design/icons';
import { localeToLanguageName } from '@refly-packages/ai-workspace-common/utils/i18n';
import {
  IconMouse,
  IconTouchpad,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuShipWheel } from 'react-icons/lu';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { LOCALE } from '@refly/common-types';

export const SettingsGuideModal = React.memo(() => {
  const { t, i18n } = useTranslation();

  const {
    userProfile,
    setUserProfile,
    showSettingsGuideModal,
    setShowSettingsGuideModal,
    localSettings,
    setLocalSettings,
    setShowTourModal,
  } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
    showSettingsGuideModal: state.showSettingsGuideModal,
    setShowSettingsGuideModal: state.setShowSettingsGuideModal,
    localSettings: state.localSettings,
    setLocalSettings: state.setLocalSettings,
    setShowTourModal: state.setShowTourModal,
  }));
  const uiLocale = i18n?.languages?.[0] as LOCALE;
  const outputLocale = localSettings?.outputLocale;

  const [step, setStep] = useState<number>(0);

  const setStepTo = (newStep: number) => {
    if (newStep >= step) {
      setStep(newStep);
    }
  };

  const [canvasMode, setCanvasMode] = useState<'mouse' | 'touchpad'>(
    localSettings?.canvasMode || 'mouse',
  );
  const [finishedOnboardingSettings, setFinishedOnboardingSettings] = useState<boolean>(false);
  const [shouldShowTourModal, setShouldShowTourModal] = useState<boolean>(false);

  const { mutate: updateUserSettings } = useUpdateSettings();

  const handleSetOnboardingSettingStatus = (
    status: 'skipped' | 'completed',
    operationMode?: 'mouse' | 'touchpad',
  ) => {
    const settings = finishedOnboardingSettings ? userProfile?.onboarding?.settings : status;
    const preferences =
      status === 'skipped'
        ? userProfile?.preferences
        : {
            ...userProfile?.preferences,
            operationMode: operationMode || userProfile?.preferences?.operationMode,
          };

    setUserProfile({
      ...userProfile,
      onboarding: {
        ...userProfile?.onboarding,
        settings,
      },
      preferences,
    });

    updateUserSettings({
      body: {
        onboarding: {
          ...userProfile?.onboarding,
          settings,
        },
        preferences,
      },
    });
  };

  const handleCancel = () => {
    handleSetOnboardingSettingStatus('skipped');
    setShowSettingsGuideModal(false);
    if (shouldShowTourModal) {
      setShowTourModal(true);
    }
  };

  const handleSave = () => {
    setLocalSettings({
      ...localSettings,
      canvasMode,
    });

    handleSetOnboardingSettingStatus('completed', canvasMode);
    setShowSettingsGuideModal(false);
    if (shouldShowTourModal) {
      setShowTourModal(true);
    }
  };

  useEffect(() => {
    setFinishedOnboardingSettings(
      ['skipped', 'completed'].includes(userProfile?.onboarding?.settings),
    );
  }, [userProfile?.onboarding?.settings]);

  useEffect(() => {
    setCanvasMode(localSettings.canvasMode);
  }, [localSettings.canvasMode]);

  useEffect(() => {
    setShouldShowTourModal(
      !finishedOnboardingSettings &&
        !['skipped', 'completed'].includes(userProfile?.onboarding?.tour),
    );
  }, [finishedOnboardingSettings, userProfile?.onboarding?.tour]);

  const steps = [
    {
      title: t('settings.language.uiLocale.title'),
      description: (
        <div>
          <Typography.Paragraph type="secondary" className="mb-2">
            {t('settings.language.uiLocale.description')}
          </Typography.Paragraph>
          <UILocaleList width={200} onChange={() => setStepTo(1)}>
            <Button>
              {t('language')} <DownOutlined />
            </Button>
          </UILocaleList>
        </div>
      ),
    },
    {
      title: t('settings.language.outputLocale.title'),
      description: (
        <div>
          <Typography.Paragraph type="secondary" className="mb-2">
            {t('settings.language.outputLocale.description')}
          </Typography.Paragraph>
          <OutputLocaleList width={200} onChange={() => setStepTo(2)}>
            <Button>
              {localeToLanguageName?.[uiLocale]?.[outputLocale]} <DownOutlined />
            </Button>
          </OutputLocaleList>
        </div>
      ),
    },
    {
      title: t('canvas.operationMode.title'),
      description: (
        <div className="mt-2">
          <Radio.Group
            value={canvasMode}
            onChange={(e) => setCanvasMode(e.target.value)}
            className="w-full flex gap-4"
          >
            <Radio.Button
              value="mouse"
              onClick={() => setStepTo(3)}
              className="flex-1 h-auto p-4 border border-gray-200 rounded-lg hover:border-green-400 before:hidden [&.ant-radio-button-wrapper-checked]:border-green-500 [&.ant-radio-button-wrapper-checked]:text-green-500"
            >
              <div className="flex items-start gap-3">
                <IconMouse className="text-2xl pt-1" />
                <div className="flex-1">
                  <div className="text-base font-medium mb-1">
                    {t('canvas.operationMode.mouse')}
                  </div>
                  <div className="text-sm text-gray-500 leading-5">
                    {t('canvas.operationMode.mouseDesc')}
                  </div>
                </div>
              </div>
            </Radio.Button>
            <Radio.Button
              value="touchpad"
              onClick={() => setStepTo(3)}
              className="flex-1 h-auto p-4 border border-gray-200 rounded-lg hover:border-green-400 before:!hidden [&.ant-radio-button-wrapper-checked]:border-green-500 [&.ant-radio-button-wrapper-checked]:text-green-500"
            >
              <div className="flex items-start gap-3">
                <IconTouchpad className="text-2xl pt-1" />
                <div className="flex-1">
                  <div className="text-base font-medium mb-1">
                    {t('canvas.operationMode.touchpad')}
                  </div>
                  <div className="text-sm text-gray-500 leading-5">
                    {t('canvas.operationMode.touchpadDesc')}
                  </div>
                </div>
              </div>
            </Radio.Button>
          </Radio.Group>
        </div>
      ),
    },
  ];

  return (
    <Modal
      centered
      title={
        <div className="flex items-center gap-2">
          <LuShipWheel className="text-2xl" />
          <span className="text-lg font-medium">{t('settings.guide.title')}</span>
        </div>
      }
      open={showSettingsGuideModal}
      okText={t('common.finish')}
      cancelText={t('common.skip')}
      onOk={handleSave}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t('common.skip')}
        </Button>,
        <Button key="primary" type="primary" onClick={handleSave}>
          {t('common.finish')}
        </Button>,
      ]}
      className="settings-guide-modal"
    >
      <div className="text-base text-gray-500 my-4">{t('settings.guide.description')}</div>
      <Steps direction="vertical" current={step} items={steps} />
    </Modal>
  );
});

SettingsGuideModal.displayName = 'SettingsGuideModal';
