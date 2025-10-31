import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow, useToolStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { McpServerList } from './McpServerList';
import { ContentHeader } from '../contentHeader';
import { Button, Modal, Segmented, message } from 'antd';
import { HiMiniBuildingStorefront } from 'react-icons/hi2';
import { Close } from 'refly-icons';
import { McpServerBatchImport } from './McpServerBatchImport';
import '../model-providers/index.scss';
import { ToolList } from './tools/tool-list';
import { ToolStore } from './tools/tool-store';
import { useListToolsets, useListTools } from '@refly-packages/ai-workspace-common/queries';
import { checkComposioOAuthStatus } from '@refly-packages/ai-workspace-common/hooks/use-composio-oauth';

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

  // OAuth callback polling logic
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxPollingAttempts = 10; // 10 attempts * 2 seconds = 20 seconds max
  const pollingAttemptsRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    // Check if there's a pending OAuth authorization
    const pendingOAuthStr = localStorage.getItem('composio_pending_oauth');
    if (!pendingOAuthStr) return;

    try {
      const pendingOAuth = JSON.parse(pendingOAuthStr);
      const { app, timestamp } = pendingOAuth;

      // Check if the pending OAuth is not too old (max 10 minutes)
      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - timestamp > tenMinutes) {
        localStorage.removeItem('composio_pending_oauth');
        return;
      }

      // Show loading message
      const loadingKey = 'oauth-polling';
      message.loading({
        content: t('settings.toolStore.oauth.checking') || 'Checking authorization status...',
        key: loadingKey,
        duration: 0,
      });

      pollingAttemptsRef.current = 0;

      // Start polling
      const checkStatus = async () => {
        try {
          pollingAttemptsRef.current++;
          console.log(`OAuth polling attempt ${pollingAttemptsRef.current} for app ${app}`);
          const status = await checkComposioOAuthStatus(app);
          if (status?.status === 'active') {
            message.success({
              content: t('settings.toolStore.oauth.authorized') || 'Authorization successful!',
              key: loadingKey,
            });
            localStorage.removeItem('composio_pending_oauth');

            if (pollingTimerRef.current) {
              clearTimeout(pollingTimerRef.current);
              pollingTimerRef.current = null;
            }
            refetchToolsOnUpdate();
            return;
          }

          // Continue polling if not reached max attempts
          if (pollingAttemptsRef.current < maxPollingAttempts) {
            pollingTimerRef.current = setTimeout(checkStatus, 2000);
          } else {
            // Max attempts reached
            message.warning({
              content:
                t('settings.toolStore.oauth.timeout') ||
                'Authorization check timeout. Please refresh the page.',
              key: loadingKey,
            });
            localStorage.removeItem('composio_pending_oauth');
          }
        } catch (error) {
          console.error('Failed to check OAuth status:', error);
          // Continue polling on error (might be temporary network issue)
          if (pollingAttemptsRef.current < maxPollingAttempts) {
            pollingTimerRef.current = setTimeout(checkStatus, 2000);
          } else {
            message.error({
              content: t('settings.toolStore.oauth.failed') || 'Authorization check failed',
              key: loadingKey,
            });
            localStorage.removeItem('composio_pending_oauth');
          }
        }
      };

      // Start the first check
      checkStatus();
    } catch (error) {
      console.error('Failed to parse pending OAuth data:', error);
      localStorage.removeItem('composio_pending_oauth');
    }

    // Cleanup function
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [visible, t, refetchToolsOnUpdate]);

  // Listen for OAuth completion signal from popup window via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check if the OAuth completion signal was triggered
      if (e.key === 'composio_oauth_completed' && e.newValue) {
        try {
          const completionData = JSON.parse(e.newValue);
          console.log('OAuth completion detected from popup window:', completionData);

          // Stop any ongoing polling
          if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }

          // Clear the pending OAuth record
          localStorage.removeItem('composio_pending_oauth');

          // Show success message
          message.success({
            content: t('settings.toolStore.oauth.authorized') || 'Authorization successful!',
            key: 'oauth-polling',
          });

          // Refetch tools to update UI
          refetchToolsOnUpdate();

          // Clean up the completion signal
          localStorage.removeItem('composio_oauth_completed');
        } catch (error) {
          console.error('Failed to parse OAuth completion data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [t, refetchToolsOnUpdate]);

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
        height="calc(100vh - 80px)"
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
