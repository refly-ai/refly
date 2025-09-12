import { useCallback } from 'react';
import { SettingsModalActiveTab, useSiderStoreShallow, useToolStoreShallow } from '@refly/stores';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

export const useOpenInstallTool = () => {
  const { data: toolsetInventory } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const toolStore = useToolStoreShallow((state) => ({
    setToolStoreModalOpen: state.setToolStoreModalOpen,
    setToolInstallModalOpen: state.setToolInstallModalOpen,
    setCurrentToolDefinition: state.setCurrentToolDefinition,
  }));
  const siderStore = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const openInstallToolByKey = useCallback(
    (toolsetKey: string) => {
      const definition = toolsetInventory?.data?.find((t) => t.key === toolsetKey);

      if (definition) {
        toolStore.setCurrentToolDefinition(definition);
        siderStore.setSettingsModalActiveTab(SettingsModalActiveTab.ToolsConfig);
        siderStore.setShowSettingModal(true);
        toolStore.setToolStoreModalOpen(true);
        toolStore.setToolInstallModalOpen(true);
      }
    },
    [toolsetInventory, toolStore, siderStore],
  );

  return { openInstallToolByKey };
};
