import { useCallback } from 'react';
import { McpServerDTO } from '@refly/openapi-schema';
import { SettingsModalActiveTab, useSiderStoreShallow, useToolStoreShallow } from '@refly/stores';

export const useOpenInstallMcp = () => {
  const siderStore = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));
  const toolStore = useToolStoreShallow((state) => ({
    setSelectedTab: state.setSelectedTab,
    setMcpFormModalOpen: state.setMcpFormModalOpen,
    setCurrentMcpServer: state.setCurrentMcpServer,
    setMcpFormMode: state.setMcpFormMode,
  }));

  const openInstallMcp = useCallback(
    (mcp: McpServerDTO) => {
      if (!mcp) return;

      siderStore.setSettingsModalActiveTab(SettingsModalActiveTab.ToolsConfig);
      siderStore.setShowSettingModal(true);
      toolStore.setSelectedTab('mcp');
      toolStore.setMcpFormMode('create');
      toolStore.setMcpFormModalOpen(true);
      toolStore.setCurrentMcpServer(mcp);
    },
    [siderStore, toolStore],
  );

  return { openInstallMcp };
};
