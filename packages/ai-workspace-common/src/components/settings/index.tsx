import { Tabs, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useSiderStoreShallow,
  SettingsModalActiveTab,
} from '@refly-packages/ai-workspace-common/stores/sider';

// components
import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { AppearanceSetting } from '@refly-packages/ai-workspace-common/components/settings/appearance-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';
import { ModelProviders } from '@refly-packages/ai-workspace-common/components/settings/model-providers';
import { ModelConfig } from '@refly-packages/ai-workspace-common/components/settings/model-config';
import { ParserConfig } from '@refly-packages/ai-workspace-common/components/settings/parser-config';
import { DefaultModel } from '@refly-packages/ai-workspace-common/components/settings/default-model';
import {
  McpServerList,
  CommunityMcpList,
} from '@refly-packages/ai-workspace-common/components/settings/mcp-server';

import { RiAccountBoxLine } from 'react-icons/ri';
import { HiOutlineLanguage } from 'react-icons/hi2';
import { LuPalette } from 'react-icons/lu';

import './index.scss';
import {
  IconSettings,
  IconSubscription,
  IconModel,
  IconWorldConfig,
  IconCloud,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { GrCube } from 'react-icons/gr';

import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { useEffect, useState } from 'react';
import { ToolOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

const iconStyle = { fontSize: 16, transform: 'translateY(3px)' };

interface SettingModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

// MCP Server Tab Component
const McpServerTab = ({ visible }: { visible: boolean }) => {
  const [mcpActiveTab, setMcpActiveTab] = useState('my-servers');
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const { settingsModalActiveTab } = useSiderStoreShallow((state) => ({
    settingsModalActiveTab: state.settingsModalActiveTab,
  }));

  // Auto-switch to MCP Store when modal is opened via MCP selector
  useEffect(() => {
    if (visible && settingsModalActiveTab === SettingsModalActiveTab.McpServer) {
      setMcpActiveTab('community');
    }
  }, [visible, settingsModalActiveTab]);

  // Fetch MCP servers for the community tab to check installed status
  const { data: mcpServersData, refetch } = useListMcpServers({}, [], {
    enabled: visible && isLogin,
    refetchOnWindowFocus: false,
  });

  const mcpServers = mcpServersData?.data || [];

  // Custom tab items
  const tabItems = [
    {
      key: 'my-servers',
      label: 'My Servers',
      icon: <UnorderedListOutlined />,
    },
    {
      key: 'community',
      label: 'MCP Store',
      icon: <AppstoreOutlined />,
    },
  ];

  if (!visible) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Custom Tab Header */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {tabItems.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setMcpActiveTab(tab.key)}
            className={`
              cursor-pointer relative px-4 py-2.5 flex items-center gap-1.5 text-sm font-medium transition-all duration-200 ease-in-out
              ${
                mcpActiveTab === tab.key
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {mcpActiveTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-sm" />
            )}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {mcpActiveTab === 'my-servers' && (
          <McpServerList visible={visible && mcpActiveTab === 'my-servers'} />
        )}
        {mcpActiveTab === 'community' && (
          <CommunityMcpList
            visible={visible && mcpActiveTab === 'community'}
            installedServers={mcpServers}
            onInstallSuccess={() => refetch()}
          />
        )}
      </div>
    </div>
  );
};

const Settings: React.FC<SettingModalProps> = ({ visible, setVisible }) => {
  const { t } = useTranslation();
  const { settingsModalActiveTab, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    settingsModalActiveTab: state.settingsModalActiveTab,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const [localActiveTab, setLocalActiveTab] = useState<SettingsModalActiveTab>(
    settingsModalActiveTab || SettingsModalActiveTab.Appearance,
  );

  // Update local active tab when prop changes
  useEffect(() => {
    setLocalActiveTab(settingsModalActiveTab || SettingsModalActiveTab.Appearance);
  }, [settingsModalActiveTab]);

  // Handle tab change
  const handleTabChange = (key: string) => {
    setLocalActiveTab(key as SettingsModalActiveTab);
  };

  const tabs = [
    {
      key: 'modelProviders',
      label: t('settings.tabs.providers'),
      icon: <IconCloud style={iconStyle} />,
      children: (
        <ModelProviders visible={localActiveTab === SettingsModalActiveTab.ModelProviders} />
      ),
    },
    {
      key: 'modelConfig',
      label: t('settings.tabs.modelConfig'),
      icon: <IconModel style={iconStyle} />,
      children: <ModelConfig visible={localActiveTab === SettingsModalActiveTab.ModelConfig} />,
    },
    {
      key: 'parserConfig',
      label: t('settings.tabs.parserConfig'),
      icon: <IconWorldConfig style={iconStyle} />,
      children: <ParserConfig visible={localActiveTab === SettingsModalActiveTab.ParserConfig} />,
    },
    {
      key: 'mcpServer',
      label: t('settings.tabs.mcpServer'),
      icon: <ToolOutlined style={iconStyle} />,
      children: <McpServerTab visible={localActiveTab === SettingsModalActiveTab.McpServer} />,
    },
    {
      key: 'defaultModel',
      label: t('settings.tabs.defaultModel'),
      icon: <GrCube style={iconStyle} />,
      children: <DefaultModel visible={localActiveTab === SettingsModalActiveTab.DefaultModel} />,
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
    {
      key: 'appearance',
      label: t('settings.tabs.appearance'),
      icon: <LuPalette style={iconStyle} />,
      children: <AppearanceSetting />,
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
      <Tabs tabPosition="left" items={tabs} activeKey={localActiveTab} onChange={handleTabChange} />
    </Modal>
  );
};

export default Settings;

// Export with both names for compatibility
export { Settings as SettingModal };
