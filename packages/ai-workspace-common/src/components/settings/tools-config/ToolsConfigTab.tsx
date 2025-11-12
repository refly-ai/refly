import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow, useToolStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { McpServerList } from './McpServerList';
import { ContentHeader } from '../contentHeader';
import { Button, Modal, Segmented } from 'antd';
import { HiMiniBuildingStorefront } from 'react-icons/hi2';
import { Close } from 'refly-icons';
import { McpServerBatchImport } from './McpServerBatchImport';
import '../model-providers/index.scss';
import { ToolList } from './tools/tool-list';
import { ToolStore } from './tools/tool-store';
import { useListToolsets, useListTools } from '@refly-packages/ai-workspace-common/queries';

export const ToolsConfigTab = ({ visible }: { visible: boolean }) => {
  const { t } = useTranslation();
  const {
    selectedTab,
    setSelectedTab,
    toolStoreModalOpen,
    setToolStoreModalOpen,
    setMcpFormModalOpen,
    setCurrentMcpServer,
    setMcpFormMode,
  } = useToolStoreShallow((state) => ({
    selectedTab: state.selectedTab,
    setSelectedTab: state.setSelectedTab,
    toolStoreModalOpen: state.toolStoreModalOpen,
    setToolStoreModalOpen: state.setToolStoreModalOpen,
    setMcpFormModalOpen: state.setMcpFormModalOpen,
    setMcpFormMode: state.setMcpFormMode,
    setCurrentMcpServer: state.setCurrentMcpServer,
  }));
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  // Fetch MCP servers for the community tab to check installed status
  const { data: _mcpServersData, refetch } = useListMcpServers({}, [], {
    enabled: visible && isLogin,
    refetchOnWindowFocus: false,
  });

  const { refetch: refetchEnabledTools } = useListTools({ query: { enabled: true } }, [], {
    enabled: false,
  });

  const {
    data: toolsets,
    refetch: refetchToolsets,
    isLoading: isLoadingToolsets,
  } = useListToolsets({}, [], {
    enabled: true,
  });
  const toolInstances = toolsets?.data || [];

  const refetchToolsOnUpdate = useCallback(() => {
    refetchToolsets();
    refetchEnabledTools();
  }, [refetchToolsets, refetchEnabledTools]);

  // const mcpServers = mcpServersData?.data || [];
  const renderCustomActions = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        {selectedTab === 'mcp' ? (
          <>
            <McpServerBatchImport onSuccess={() => refetch()} />
            <Button
              type="primary"
              className="font-semibold"
              onClick={() => {
                setMcpFormMode('create');
                setMcpFormModalOpen(true);
                setCurrentMcpServer(null);
              }}
            >
              {t('settings.mcpServer.addServer')}
            </Button>
          </>
        ) : (
          <Button
            type="text"
            className="font-semibold border-solid border-[1px] border-refly-Card-Border rounded-lg"
            icon={<HiMiniBuildingStorefront />}
            onClick={() => setToolStoreModalOpen(true)}
          >
            {t('settings.mcpServer.toolStore')}
          </Button>
        )}
      </div>
    );
  }, [t, refetch, setMcpFormModalOpen, setCurrentMcpServer, setToolStoreModalOpen, selectedTab]);

  if (!visible) return null;

  return (
    <div className="h-full flex flex-col">
      <ContentHeader title={t('settings.tabs.tools')} customActions={renderCustomActions} />
      <div className="px-5 pt-5">
        <Segmented
          shape="round"
          options={[
            { label: t('settings.mcpServer.tools'), value: 'tools' },
            { label: t('settings.mcpServer.mcp'), value: 'mcp' },
          ]}
          value={selectedTab}
          onChange={(value) => setSelectedTab(value as 'tools' | 'mcp')}
          className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
        />
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'tools' ? (
          <ToolList
            toolInstances={toolInstances}
            refetchToolsets={refetchToolsOnUpdate}
            isLoadingToolsets={isLoadingToolsets}
          />
        ) : (
          <McpServerList visible={visible} />
        )}
      </div>

      <Modal
        open={toolStoreModalOpen}
        onCancel={() => setToolStoreModalOpen(false)}
        title={null}
        footer={null}
        className="provider-store-modal"
        width="calc(100vw - 80px)"
        style={{ height: 'calc(var(--screen-height) - 80px)' }}
        centered
        closable={false}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-solid border-[1px] border-x-0 border-t-0 border-refly-Card-Border">
            <div className="text-lg font-semibold text-refly-text-0 leading-7">
              {t('settings.toolStore.title')}
            </div>
            <Button
              type="text"
              icon={<Close size={24} />}
              onClick={() => setToolStoreModalOpen(false)}
            />
          </div>

          <ToolStore />
        </div>
      </Modal>
    </div>
  );
};
