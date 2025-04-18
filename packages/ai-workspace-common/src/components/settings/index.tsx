import { Tabs, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useSiderStoreShallow,
  type SettingsModalActiveTab,
} from '@refly-packages/ai-workspace-common/stores/sider';

// components
import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';
import { ModelProviders } from '@refly-packages/ai-workspace-common/components/settings/model-providers';
import { ModelConfig } from '@refly-packages/ai-workspace-common/components/settings/model-config';
import { SearchConfig } from '@refly-packages/ai-workspace-common/components/settings/search-config';

import { RiAccountBoxLine } from 'react-icons/ri';
import { HiOutlineLanguage } from 'react-icons/hi2';

import './index.scss';
import {
  IconSettings,
  IconSubscription,
  IconModel,
  IconWorldConfig,
  IconCloud,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { useEffect } from 'react';

const iconStyle = { fontSize: 16, transform: 'translateY(3px)' };

interface SettingModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const SettingModal = (props: SettingModalProps) => {
  const { visible, setVisible } = props;
  const { t } = useTranslation();
  const { settingsModalActiveTab, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    settingsModalActiveTab: state.settingsModalActiveTab,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const tabs = [
    {
      key: 'modelProviders',
      label: t('settings.tabs.modelProviders'),
      icon: <IconCloud style={iconStyle} />,
      children: <ModelProviders />,
    },
    {
      key: 'modelConfig',
      label: t('settings.tabs.modelConfig'),
      icon: <IconModel style={iconStyle} />,
      children: <ModelConfig />,
    },
    {
      key: 'searchConfig',
      label: t('settings.tabs.searchConfig'),
      icon: <IconWorldConfig style={iconStyle} />,
      children: <SearchConfig />,
    },
    ...(subscriptionEnabled
      ? [
          {
            key: 'subscription',
            label: t('settings.tabs.subscription'),
            icon: <IconSubscription style={iconStyle} />,
            children: <Subscription />,
          },
        ]
      : []),
    {
      key: 'account',
      label: t('settings.tabs.account'),
      icon: <RiAccountBoxLine style={iconStyle} />,
      children: <AccountSetting />,
    },
    {
      key: 'language',
      label: t('settings.tabs.language'),
      icon: <HiOutlineLanguage style={iconStyle} />,
      children: <LanguageSetting />,
    },
  ];

  useEffect(() => {
    if (!settingsModalActiveTab) {
      setSettingsModalActiveTab(tabs[0].key as SettingsModalActiveTab);
    }
  }, [subscriptionEnabled]);

  return (
    <Modal
      className="settings-modal"
      centered
      title={
        <span className="flex items-center gap-2 text-xl font-medium ml-5">
          <IconSettings /> {t('tabMeta.settings.title')}
        </span>
      }
      width={'100vw'}
      height={'100vh'}
      style={{
        top: 0,
        paddingBottom: 0,
        maxWidth: '100vw',
      }}
      footer={null}
      open={visible}
      onCancel={() => setVisible(false)}
    >
      <Tabs
        tabPosition="left"
        items={tabs}
        activeKey={settingsModalActiveTab}
        onChange={(key) => setSettingsModalActiveTab(key as SettingsModalActiveTab)}
      />
    </Modal>
  );
};
