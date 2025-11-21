import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Button,
  Tag,
  Tooltip,
  Modal,
  message,
  Switch,
  Empty,
  Dropdown,
  DropdownProps,
  MenuProps,
  Skeleton,
} from 'antd';
import { useTranslation } from 'react-i18next';

import { McpServerDTO } from '@refly/openapi-schema';

import {
  useDeleteMcpServer,
  useListTools,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';
import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { McpServerForm } from './McpServerForm';
import { preloadMonacoEditor } from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/monaco-editor/monacoPreloader';
import { useToolStoreShallow, useUserStoreShallow } from '@refly/stores';
import { Edit, Delete, More, Mcp } from 'refly-icons';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';

interface McpServerListProps {
  visible: boolean;
}

// Action dropdown component
const ActionDropdown = React.memo(
  ({
    server,
    handleEdit,
    handleDelete,
  }: {
    server: McpServerDTO;
    handleEdit: (server: McpServerDTO) => void;
    handleDelete: (server: McpServerDTO) => void;
  }) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteConfirm = async () => {
      setIsDeleting(true);
      try {
        await handleDelete(server);
        setModalVisible(false);
      } finally {
        setIsDeleting(false);
      }
    };

    const items: MenuProps['items'] = [
      {
        label: (
          <div className="flex items-center flex-grow">
            <Edit size={18} className="mr-2" />
            {t('common.edit')}
          </div>
        ),
        key: 'edit',
        onClick: () => {
          handleEdit(server);
          setVisible(false);
        },
      },
      {
        label: (
          <div
            className="flex items-center text-red-600 flex-grow cursor-pointer"
            onClick={() => {
              setVisible(false);
              setModalVisible(true);
            }}
          >
            <Delete size={18} className="mr-2" />
            {t('common.delete')}
          </div>
        ),
        key: 'delete',
      },
    ];

    const handleOpenChange: DropdownProps['onOpenChange'] = useCallback(
      (open: boolean, info: any) => {
        if (info.source === 'trigger') {
          setVisible(open);
        }
      },
      [],
    );

    return (
      <>
        <Dropdown
          trigger={['click']}
          open={visible}
          onOpenChange={handleOpenChange}
          menu={{ items }}
        >
          <Button type="text" icon={<More size={18} />} size="small" />
        </Dropdown>
        <Modal
          title={t('common.deleteConfirmMessage')}
          centered
          width={416}
          open={modalVisible}
          onOk={handleDeleteConfirm}
          onCancel={() => setModalVisible(false)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          okButtonProps={{ loading: isDeleting }}
          destroyOnHidden
          closeIcon={null}
          confirmLoading={isDeleting}
        >
          <div>
            <div className="mb-2">
              {t('settings.mcpServer.deleteConfirmMessage', { name: server.name })}
            </div>
          </div>
        </Modal>
      </>
    );
  },
);
ActionDropdown.displayName = 'ActionDropdown';

// Server item component
const ServerItem = React.memo(
  ({
    server,
    serverTools,
    onEdit,
    onDelete,
    onToggleEnabled,
    isSubmitting,
  }: {
    server: McpServerDTO;
    serverTools: any[];
    onEdit: (server: McpServerDTO) => void;
    onDelete: (server: McpServerDTO) => void;
    onToggleEnabled: (server: McpServerDTO, enabled: boolean) => void;
    isSubmitting: boolean;
  }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const handleToggleChange = useCallback(
      (checked: boolean) => {
        onToggleEnabled(server, checked);
      },
      [server, onToggleEnabled],
    );

    const handleSwitchWrapperClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    return (
      <div className="mb-2 px-2 py-3 rounded-lg cursor-pointer hover:bg-refly-tertiary-hover">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 flex">
            <div className="flex-shrink-0 h-10 w-10 rounded-[8px] bg-refly-tertiary-default flex items-center justify-center mr-3">
              <Mcp size={24} />
            </div>

            <div className="min-h-10 flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{server.name}</div>
                <Tag className="bg-refly-tertiary-default border-solid border-[1px] border-refly-Card-Border font-semibold text-refly-text-1 h-[18px] flex items-center justify-center rounded-[4px] text-[10px] leading-[14px]">
                  {server.isGlobal ? 'Global' : server.type.toUpperCase()}
                </Tag>
              </div>
              {serverTools.length > 0 && (
                <span className="text-xs text-refly-text-2">
                  {t('settings.mcpServer.availableToolsPrefix')} ({serverTools.length})
                </span>
              )}
              {/* Expandable tools section */}
              {serverTools.length > 0 && (
                <div className="mt-2">
                  <div className="bg-refly-bg-control-z0 rounded-md p-2">
                    <div className="flex flex-wrap gap-2">
                      {serverTools.map((tool, index) => {
                        const toolName = tool?.name?.split('__')?.[2] || '';
                        const isVisible = expanded || index < 6; // Show first 6 tags by default

                        return (
                          <Tag
                            key={index}
                            className={`bg-refly-tertiary-default border-solid border-[1px] border-refly-Card-Border font-semibold text-refly-text-1 h-[18px] flex items-center justify-center rounded-[4px] text-[10px] leading-[14px] ${
                              isVisible ? 'block' : 'hidden'
                            }`}
                          >
                            {toolName}
                          </Tag>
                        );
                      })}
                    </div>

                    {serverTools.length > 6 && (
                      <div className="mt-2">
                        <Button
                          type="text"
                          size="small"
                          onClick={() => setExpanded(!expanded)}
                          className="text-xs text-refly-text-2 hover:text-refly-text-0 p-0 h-auto"
                        >
                          {expanded
                            ? t('settings.mcpServer.collapse')
                            : t('settings.mcpServer.viewMore')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 h-10">
            <Tooltip
              title={
                server.isGlobal ? '' : server.enabled ? t('common.enabled') : t('common.disabled')
              }
            >
              <div onClick={handleSwitchWrapperClick} className="flex items-center">
                <Switch
                  size="small"
                  checked={server.enabled ?? false}
                  onChange={handleToggleChange}
                  loading={isSubmitting}
                  disabled={server.isGlobal}
                />
              </div>
            </Tooltip>

            {!server.isGlobal && (
              <ActionDropdown server={server} handleEdit={onEdit} handleDelete={onDelete} />
            )}
          </div>
        </div>
      </div>
    );
  },
);

ServerItem.displayName = 'ServerItem';

export const McpServerList: React.FC<McpServerListProps> = ({ visible }) => {
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const {
    currentMcpServer,
    mcpFormModalOpen,
    mcpFormMode,
    setMcpFormModalOpen,
    setCurrentMcpServer,
    setMcpFormMode,
  } = useToolStoreShallow((state) => ({
    currentMcpServer: state.currentMcpServer,
    mcpFormModalOpen: state.mcpFormModalOpen,
    mcpFormMode: state.mcpFormMode,
    setMcpFormModalOpen: state.setMcpFormModalOpen,
    setCurrentMcpServer: state.setCurrentMcpServer,
    setMcpFormMode: state.setMcpFormMode,
  }));
  const { t } = useTranslation();

  const [serverTools, setServerTools] = useState<Record<string, any[]>>({});

  useEffect(() => {
    preloadMonacoEditor();
  }, []);

  // Fetch MCP servers
  const { data, refetch, isLoading, isRefetching } = useListMcpServers({}, [], {
    enabled: visible && isLogin,
    refetchOnWindowFocus: false,
  });

  const { refetch: refetchEnabledTools } = useListTools({ query: { enabled: true } }, [], {
    enabled: false,
  });

  const refetchToolsOnUpdate = useCallback(() => {
    refetch();
    refetchEnabledTools();
  }, [refetch, refetchEnabledTools]);

  const mcpServers = useMemo(() => data?.data || [], [data]);

  // Load tool data from localStorage
  useEffect(() => {
    const loadedTools: Record<string, any[]> = {};

    for (const server of mcpServers) {
      const toolsKey = `mcp_server_tools_${server.name}`;
      const toolsData = localStorage.getItem(toolsKey);

      if (toolsData) {
        try {
          loadedTools[server.name] = JSON.parse(toolsData);
        } catch (e) {
          console.error(`Failed to parse tools data for ${server.name}:`, e);
        }
      }
    }

    setServerTools(loadedTools);
  }, [mcpServers]);

  // Delete MCP server mutation
  const deleteMutation = useDeleteMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.deleteSuccess'));
      // Refresh list data
      refetchToolsOnUpdate();
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.deleteError'));
      console.error('Failed to delete MCP server:', error);
    },
  });

  // Update MCP server mutation
  const updateMutation = useUpdateMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.updateSuccess'));
      // Refresh list data
      refetchToolsOnUpdate();
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.updateError'));
      console.error('Failed to update MCP server:', error);
    },
  });

  // Validate MCP server mutation
  const validateMutation = useValidateMcpServer([], {
    onSuccess: (response, ctx) => {
      if (!response?.data?.success) {
        throw response.data.errMsg;
      }

      // Save tools data to localStorage
      if (response?.data?.data && response.data.data.length > 0) {
        const serverTools = response.data.data;
        const serverName = ctx.body.name || '';

        // Save to localStorage
        if (serverName) {
          const toolsKey = `mcp_server_tools_${serverName}`;
          localStorage.setItem(toolsKey, JSON.stringify(serverTools));
        }
      }

      // Returns true when server-side validation is successful
      message.success(t('settings.mcpServer.validateSuccess'));
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.validateError'));
      console.error('Failed to validate MCP server:', error);
    },
  });

  // Handle form submission
  const handleFormSubmit = () => {
    // Form submission is handled in the form component
    setMcpFormModalOpen(false);
    setCurrentMcpServer(null);
    // Refresh list data
    refetchToolsOnUpdate();
  };

  // Handle edit button click
  const handleEdit = useCallback(
    (server: McpServerDTO) => {
      setCurrentMcpServer(server);
      setMcpFormMode('edit');
      setMcpFormModalOpen(true);
    },
    [setCurrentMcpServer, setMcpFormMode, setMcpFormModalOpen],
  );

  // Handle delete button click
  const handleDelete = useCallback(
    (server: McpServerDTO) => {
      deleteMutation.mutate({
        body: { name: server.name },
      });
    },
    [deleteMutation],
  );

  // Handle enable/disable switch
  const handleEnableSwitch = useCallback(
    async (checked: boolean, server: McpServerDTO) => {
      try {
        // If enabling, validate first
        if (checked) {
          await validateMutation.mutateAsync({
            body: {
              name: server.name,
              type: server.type,
              url: server.url,
              command: server.command,
              args: server.args,
              env: server.env,
              headers: server.headers,
              reconnect: server.reconnect,
              config: server.config,
              enabled: true,
            },
          });
        }

        // If validation passes or it's a disable operation, update server status
        updateMutation.mutate({
          body: {
            name: server.name,
            type: server.type,
            url: server.url,
            command: server.command,
            args: server.args,
            env: server.env,
            headers: server.headers,
            reconnect: server.reconnect,
            config: server.config,
            enabled: checked,
          },
        });
      } catch (error) {
        // Validation failed, do nothing
        console.error('Server validation failed:', error);
      }
    },
    [validateMutation, updateMutation],
  );

  if (!visible) return null;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Servers List */}
      <div
        className={cn(
          'flex-1 overflow-auto p-5',
          !isLoading && mcpServers.length === 0 ? 'flex items-center justify-center' : '',
        )}
      >
        {isLoading || isRefetching ? (
          <Skeleton active title={false} paragraph={{ rows: 10 }} />
        ) : mcpServers.length === 0 ? (
          <Empty description={<p>{t('settings.mcpServer.noServers')}</p>}>
            <Button type="primary" onClick={() => setMcpFormModalOpen(true)}>
              {t('settings.mcpServer.addServer')}
            </Button>
          </Empty>
        ) : (
          <div>
            {mcpServers?.map((server) => (
              <ServerItem
                key={server.name}
                server={server}
                serverTools={serverTools[server.name] || []}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleEnabled={(server, enabled) => handleEnableSwitch(enabled, server)}
                isSubmitting={
                  (updateMutation.isPending &&
                    (updateMutation.variables as { body: { name?: string } })?.body?.name ===
                      server.name) ||
                  (validateMutation.isPending &&
                    (validateMutation.variables as { body: { name?: string } })?.body?.name ===
                      server.name)
                }
              />
            ))}
            <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        centered
        title={
          mcpFormMode === 'edit'
            ? t('settings.mcpServer.editServer')
            : t('settings.mcpServer.addServer')
        }
        open={mcpFormModalOpen}
        onCancel={() => setMcpFormModalOpen(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <McpServerForm
          formMode={mcpFormMode}
          initialData={currentMcpServer || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setMcpFormModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
