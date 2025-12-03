import { Divider, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSiderStoreShallow, SettingsModalActiveTab, useUserStoreShallow } from '@refly/stores';

// components
import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { AppearanceSetting } from '@refly-packages/ai-workspace-common/components/settings/appearance-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';
// import { ModelProviders } from '@refly-packages/ai-workspace-common/components/settings/model-providers';
// import { ModelConfig } from '@refly-packages/ai-workspace-common/components/settings/model-config';
// import { ParserConfig } from '@refly-packages/ai-workspace-common/components/settings/parser-config';

import './index.scss';
import {
  // AIModel,
  // Provider,
  // Parse,
  Tools,
  Subscription as SubscriptionIcon,
  Account,
  Language,
  InterfaceLight,
} from 'refly-icons';

import { subscriptionEnabled } from '@refly/ui-kit';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ToolsConfigTab } from '@refly-packages/ai-workspace-common/components/settings/tools-config';
import React from 'react';

interface SettingModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

// Custom Tab Item Component
const CustomTabItem = React.memo<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  divider?: boolean;
}>(({ icon, label, isActive, onClick, divider }) => (
  <>
    <div
      onClick={onClick}
      className={`
      relative transition-all duration-200 ease-in-out cursor-pointer font-normal h-[42px] p-2 border-box flex items-center gap-1 rounded-lg hover:bg-refly-tertiary-hover
      ${isActive ? 'bg-refly-tertiary-hover font-semibold' : ''}
    `}
    >
      <div className="tab-icon">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </div>
    {divider && <Divider className="m-0 border-refly-Card-Border" />}
  </>
));

// Custom Tabbar Component
const CustomTabbar = React.memo<{
  t: any;
  tabs: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    divider?: boolean;
  }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}>(({ t, tabs, activeTab, onTabChange }) => (
  <div className="h-full overflow-hidden flex flex-col gap-6 box-border w-52 px-4 py-5 border-solid border-[1px] border-y-0 border-l-0 border-refly-Card-Border">
    <div className="text-lg font-semibold text-refly-text-0 leading-7">
      {t('tabMeta.settings.title')}
    </div>

    <div className="flex-grow flex flex-col gap-2 overflow-y-auto">
      {tabs.map((tab) => (
        <CustomTabItem
          divider={tab.divider}
          key={tab.key}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
        />
      ))}
    </div>
  </div>
));

const Settings: React.FC<SettingModalProps> = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { settingsModalActiveTab, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    settingsModalActiveTab: state.settingsModalActiveTab,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const [localActiveTab, setLocalActiveTab] = useState<SettingsModalActiveTab>(
    settingsModalActiveTab || SettingsModalActiveTab.ModelConfig,
  );

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const providerMode = userProfile?.preferences?.providerMode;

  // Guard against invalid active tab when providers are hidden
  useEffect(() => {
    if (localActiveTab === SettingsModalActiveTab.ModelProviders && providerMode !== 'custom') {
      const fallback = SettingsModalActiveTab.ModelConfig;
      setLocalActiveTab(fallback);
      setSettingsModalActiveTab(fallback);
    }
  }, [providerMode, localActiveTab, setSettingsModalActiveTab]);

  // Update local active tab when prop changes or when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    const fallback =
      providerMode === 'custom'
        ? SettingsModalActiveTab.ModelProviders
        : SettingsModalActiveTab.ModelConfig;
    setLocalActiveTab(settingsModalActiveTab || fallback);
  }, [visible, settingsModalActiveTab, providerMode]);

  // Handle tab change
  const handleTabChange = useCallback(
    (key: string) => {
      setLocalActiveTab(key as SettingsModalActiveTab);
      setSettingsModalActiveTab(key as SettingsModalActiveTab);
    },
    [setLocalActiveTab, setSettingsModalActiveTab],
  );

  const tabs = useMemo(
    () => [
      // {
      //   key: 'modelConfig',
      //   label: t('settings.tabs.modelConfig'),
      //   icon: <AIModel size={18} color="var(--refly-text-0)" />,
      //   children: <ModelConfig visible={localActiveTab === SettingsModalActiveTab.ModelConfig} />,
      // },
      // ...(providerMode === 'custom'
      //   ? [
      //       {
      //         key: 'modelProviders',
      //         label: t('settings.tabs.providers'),
      //         icon: <Provider size={18} color="var(--refly-text-0)" />,
      //         children: (
      //           <ModelProviders
      //             visible={localActiveTab === SettingsModalActiveTab.ModelProviders}
      //           />
      //         ),
      //       },
      //     ]
      //   : []),
      // {
      //   key: 'parserConfig',
      //   label: t('settings.tabs.parserConfig'),
      //   icon: <Parse size={18} color="var(--refly-text-0)" />,
      //   children: <ParserConfig visible={localActiveTab === SettingsModalActiveTab.ParserConfig} />,
      // },

      {
        key: 'account',
        label: t('settings.tabs.account'),
        icon: <Account size={18} color="var(--refly-text-0)" />,
        children: <AccountSetting />,
      },
      ...(subscriptionEnabled
        ? [
            {
              key: 'subscription',
              label: t('settings.tabs.subscription'),
              icon: <SubscriptionIcon size={18} color="var(--refly-text-0)" />,
              children: <Subscription />,
            },
          ]
        : []),
      {
        key: 'toolsConfig',
        label: t('settings.tabs.tools'),
        icon: <Tools size={18} color="var(--refly-text-0)" />,
        children: (
          <ToolsConfigTab visible={localActiveTab === SettingsModalActiveTab.ToolsConfig} />
        ),
      },
      {
        key: 'language',
        label: t('settings.tabs.language'),
        icon: <Language size={18} color="var(--refly-text-0)" />,
        children: <LanguageSetting />,
      },
      {
        key: 'appearance',
        label: t('settings.tabs.appearance'),
        icon: <InterfaceLight size={18} color="var(--refly-text-0)" />,
        children: <AppearanceSetting />,
      },
    ],
    [t, localActiveTab, providerMode, subscriptionEnabled],
  );

  useEffect(() => {
    if (!settingsModalActiveTab) {
      setSettingsModalActiveTab(tabs[0].key as SettingsModalActiveTab);
    }
  }, [subscriptionEnabled]);

  // Find the active tab content
  const activeTabContent = tabs.find((tab) => tab.key === localActiveTab)?.children;

  return (
    <Modal
      className="settings-modal"
      centered
      width={'90vw'}
      height={'80vh'}
      style={{
        maxWidth: '1400px',
      }}
      title={null}
      footer={null}
      open={visible}
      closable={false}
      onCancel={() => setVisible(false)}
      maskClosable={false}
    >
      <div className="flex h-full overflow-hidden">
        <CustomTabbar t={t} tabs={tabs} activeTab={localActiveTab} onTabChange={handleTabChange} />
        <div className="flex-1 h-full overflow-hidden">{activeTabContent}</div>
      </div>
    </Modal>
  );
};

export default Settings;

// Export with both names for compatibility
export { Settings as SettingModal };
