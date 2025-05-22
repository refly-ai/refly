import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Tooltip,
  Modal,
  message,
  Switch,
  Typography,
  Card,
  List,
  Badge,
  Empty,
  theme,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ToolOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { McpServerDTO, McpServerType } from '@refly/openapi-schema';

import {
  useDeleteMcpServer,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';
import { useListMcpServersSuspense } from '@refly-packages/ai-workspace-common/queries/suspense';
import { McpServerForm } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/McpServerForm';
import { McpServerBatchImport } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/McpServerBatchImport';
import { preloadMonacoEditor } from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/monaco-editor/monacoPreloader';

interface McpServerListProps {
  visible: boolean;
}

export const McpServerList: React.FC<McpServerListProps> = ({ visible }) => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const [editingServer, setEditingServer] = useState<McpServerDTO | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<McpServerDTO | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, any[]>>({});

  useEffect(() => {
    preloadMonacoEditor();
  }, []);

  // Fetch MCP servers
  const { data, refetch } = useListMcpServersSuspense({}, [], {
    enabled: visible,
    refetchOnWindowFocus: false,
  });

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
      setDeleteModalVisible(false);
      // Refresh list data
      refetch();
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
      refetch();
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
    setIsFormVisible(false);
    setEditingServer(null);
    // Refresh list data
    refetch();
  };

  // Handle edit button click
  const handleEdit = (server: McpServerDTO) => {
    setEditingServer(server);
    setIsFormVisible(true);
  };

  // Handle delete button click
  const handleDelete = (server: McpServerDTO) => {
    setServerToDelete(server);
    setDeleteModalVisible(true);
  };

  // Handle enable/disable switch
  const handleEnableSwitch = async (checked: boolean, server: McpServerDTO) => {
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
  };

  // Confirm delete
  const confirmDelete = () => {
    if (serverToDelete) {
      deleteMutation.mutate({
        body: { name: serverToDelete.name },
      });
    }
  };

  // Get type tag color
  const getTypeColor = (type: McpServerType) => {
    switch (type) {
      case 'sse':
        return 'blue';
      case 'streamable':
        return 'green';
      case 'stdio':
        return 'purple';
      default:
        return 'default';
    }
  };

  // Custom styles
  const tableStyles = {
    header: {
      fontSize: '14px',
      fontWeight: 500,
      padding: '12px 16px',
    },
    cell: {
      padding: '12px 16px',
    },
    row: {
      cursor: 'default',
      transition: 'background-color 0.3s',
      ':hover': {
        background: '#2A2A2A',
      },
    },
    toolCard: {
      borderRadius: '6px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      border: '1px solid #424242',
      transition: 'all 0.3s',
      ':hover': {
        boxShadow: '0 3px 6px rgba(0,0,0,0.05)',
        borderColor: '#5E5E5E',
      },
    },
  };

  // Table columns
  const columns = [
    {
      title: t('settings.mcpServer.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: '20%',
      onHeaderCell: () => ({
        style: tableStyles.header,
        className:
          'bg-neutral-50 dark:bg-zinc-800 border-b border-neutral-300 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 border-t-0 border-x-0',
      }),
      onCell: () => ({
        style: tableStyles.cell,
      }),
    },
    {
      title: t('settings.mcpServer.type'),
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      onHeaderCell: () => ({
        style: tableStyles.header,
        className:
          'bg-neutral-50 dark:bg-zinc-800 border-b border-neutral-300 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 border-t-0 border-x-0',
      }),
      onCell: () => ({
        style: tableStyles.cell,
      }),
      render: (type: McpServerType) => <Tag color={getTypeColor(type)}>{type.toUpperCase()}</Tag>,
    },
    {
      title: t('settings.mcpServer.url'),
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      width: '40%',
      onHeaderCell: () => ({
        style: tableStyles.header,
        className:
          'bg-neutral-50 dark:bg-zinc-800 border-b border-neutral-300 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 border-t-0 border-x-0',
      }),
      onCell: () => ({
        style: tableStyles.cell,
      }),
      render: (url: string, record: McpServerDTO) => {
        if (record.type === 'stdio') {
          const command = record.command || '';
          const args = record.args
            ? Array.isArray(record.args)
              ? record.args.join(' ')
              : record.args
            : '';
          return command ? `${command} ${args}`.trim() : '-';
        }
        return url || '-';
      },
    },
    {
      title: t('settings.mcpServer.status'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: '10%',
      align: 'center' as const,
      onHeaderCell: () => ({
        style: tableStyles.header,
        className:
          'bg-neutral-50 dark:bg-zinc-800 border-b border-neutral-300 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 border-t-0 border-x-0',
      }),
      onCell: () => ({
        style: tableStyles.cell,
      }),
      render: (enabled: boolean, record: McpServerDTO) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleEnableSwitch(checked, record)}
          loading={
            (updateMutation.isPending &&
              (updateMutation.variables as { body: { name?: string } })?.body?.name ===
                record.name) ||
            (validateMutation.isPending &&
              (validateMutation.variables as { body: { name?: string } })?.body?.name ===
                record.name)
          }
          disabled={record.isGlobal}
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: '15%',
      align: 'center' as const,
      onHeaderCell: () => ({
        style: tableStyles.header,
        className:
          'bg-neutral-50 dark:bg-zinc-800 border-b border-neutral-300 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 border-t-0 border-x-0',
      }),
      onCell: () => ({
        style: tableStyles.cell,
      }),
      render: (_: any, record: McpServerDTO) => (
        <Space size="middle">
          <Tooltip title={t('common.edit')}>
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              disabled={record.isGlobal}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!visible) return null;

  return (
    <div
      className="mcp-server-list"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 1px' }}
    >
      <div className="flex justify-between items-center mb-5" style={{ padding: '0 4px' }}>
        <h2
          style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}
          className="text-gray-900 dark:text-gray-100"
        >
          {t('settings.mcpServer.title')}
        </h2>
        <Space>
          {/* Batch import button */}
          <McpServerBatchImport onSuccess={refetch} />
          {/* Add single server button */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingServer(null);
              setIsFormVisible(true);
            }}
          >
            {t('settings.mcpServer.addServer')}
          </Button>
        </Space>
      </div>
      <div
        className="table-container"
        style={{
          flex: 1,
          overflow: 'auto',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Table
          dataSource={mcpServers}
          columns={columns}
          rowKey="name"
          pagination={false}
          className="mcp-server-table"
          style={{ borderRadius: '8px' }}
          scroll={{ y: 'calc(100vh - 300px)' }}
          rowClassName={() => 'mcp-server-row'}
          onRow={() => ({
            style: tableStyles.row,
          })}
          expandable={{
            expandedRowRender: (record) => {
              const tools = serverTools[record.name] || [];

              if (tools.length === 0) {
                return (
                  <div className="py-6 px-6 text-center">
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Typography.Text type="secondary">
                          {t('settings.mcpServer.noToolsAvailable')}
                        </Typography.Text>
                      }
                    />
                  </div>
                );
              }

              return (
                <div className="mcp-server-tools py-4 px-5">
                  <div className="mb-3">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <ToolOutlined
                        style={{ marginRight: '8px', color: '#1677ff', fontSize: '16px' }}
                      />
                      <Typography.Text
                        strong
                        style={{ fontSize: '14px' }}
                        className="text-gray-800 dark:text-gray-200"
                      >
                        {tools.length > 0
                          ? t('settings.mcpServer.availableToolsPrefix')
                          : t('settings.mcpServer.noToolsAvailable')}
                      </Typography.Text>
                      <Badge
                        count={tools.length}
                        style={{
                          backgroundColor: '#1677ff',
                          marginLeft: '8px',
                          fontSize: '12px',
                          boxShadow: 'none',
                        }}
                      />
                    </div>
                  </div>
                  <List
                    grid={{ gutter: 12, column: 3 }}
                    dataSource={tools}
                    renderItem={(tool, index) => (
                      <List.Item key={index}>
                        <Card
                          hoverable
                          size="small"
                          className="mcp-server-tool-card"
                          style={{
                            background: token.colorBgContainer,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            boxShadow: 'none',
                          }}
                        >
                          <Typography.Title
                            level={5}
                            style={{
                              margin: '0 0 6px 0',
                              fontSize: '14px',
                              color: '#1677ff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={tool?.name?.split('__')?.[2] || ''}
                          >
                            {tool?.name?.split('__')?.[2] || ''}
                          </Typography.Title>
                          <Typography.Paragraph
                            type="secondary"
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              height: '34px',
                            }}
                            title={tool.description}
                          >
                            {tool.description}
                          </Typography.Paragraph>
                        </Card>
                      </List.Item>
                    )}
                  />
                </div>
              );
            },
            expandRowByClick: false,
            expandIcon: ({ expanded, onExpand, record }) => {
              const tools = serverTools[record.name] || [];
              const hasTools = tools.length > 0;
              return (
                <Tooltip
                  title={
                    expanded
                      ? t('settings.mcpServer.collapse')
                      : hasTools
                        ? t('settings.mcpServer.viewToolsWithCount', { count: tools.length })
                        : t('settings.mcpServer.noToolsAvailable')
                  }
                >
                  <Button
                    type="text"
                    onClick={(e) => onExpand(record, e)}
                    style={{
                      color: expanded ? '#1677ff' : hasTools ? '#1677ff' : '#bfbfbf',
                      opacity: hasTools ? 1 : 0.6,
                      transition: 'all 0.3s ease-in-out',
                      padding: '4px 8px',
                    }}
                    disabled={!hasTools}
                    icon={
                      <span
                        style={{
                          display: 'inline-block',
                          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease-in-out',
                        }}
                      >
                        <RightOutlined />
                      </span>
                    }
                  />
                </Tooltip>
              );
            },
          }}
        />
      </div>

      {/* Form Modal */}
      <Modal
        title={
          editingServer ? t('settings.mcpServer.editServer') : t('settings.mcpServer.addServer')
        }
        open={isFormVisible}
        onCancel={() => setIsFormVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <McpServerForm
          initialData={editingServer || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsFormVisible(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={t('settings.mcpServer.deleteConfirmTitle')}
        open={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onOk={confirmDelete}
        okText={t('common.delete')}
        okButtonProps={{
          danger: true,
          loading: deleteMutation.isPending,
        }}
        cancelText={t('common.cancel')}
      >
        <p>
          {t('settings.mcpServer.deleteConfirmMessage', {
            name: serverToDelete?.name,
          })}
        </p>
      </Modal>
    </div>
  );
};
