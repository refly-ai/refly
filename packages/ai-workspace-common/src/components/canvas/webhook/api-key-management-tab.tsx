import { memo, useCallback, useState, useEffect } from 'react';
import { Button, Table, Input, Modal, message, Space, Typography, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy } from 'refly-icons';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import dayjs from 'dayjs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import type { CliApiKeyInfo } from '@refly/openapi-schema';

const { Text } = Typography;

type ApiKey = CliApiKeyInfo;

export const ApiKeyManagementTab = memo(() => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await getClient().listCliApiKeys();
      const result = response.data;
      if (result?.success) {
        setKeys(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      message.error(t('webhook.apiKey.nameRequired'));
      return;
    }

    try {
      const response = await getClient().createCliApiKey({
        body: { name: newKeyName },
      });
      const result = response.data;
      if (result?.success) {
        setNewApiKey(result.data?.apiKey || null);
        setNewKeyName('');
        await fetchKeys();
        message.success(t('webhook.apiKey.createSuccess'));
      } else {
        message.error(t('webhook.apiKey.createFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.apiKey.createFailed'));
    }
  };

  const handleRename = async () => {
    if (!selectedKey || !newKeyName.trim()) {
      message.error(t('webhook.apiKey.nameRequired'));
      return;
    }

    try {
      const response = await getClient().updateCliApiKey({
        path: { keyId: selectedKey.keyId },
        body: { name: newKeyName },
      });
      const result = response.data;
      if (result?.success) {
        setRenameModalOpen(false);
        setNewKeyName('');
        setSelectedKey(null);
        await fetchKeys();
        message.success(t('webhook.apiKey.renameSuccess'));
      } else {
        message.error(t('webhook.apiKey.renameFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.apiKey.renameFailed'));
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      const response = await getClient().revokeCliApiKey({
        path: { keyId },
      });
      const result = response.data;
      if (result?.success) {
        await fetchKeys();
        message.success(t('webhook.apiKey.deleteSuccess'));
      } else {
        message.error(t('webhook.apiKey.deleteFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.apiKey.deleteFailed'));
    }
  };

  const copyApiKeyToClipboard = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        message.success(t('common.copy.success'));
      } else {
        message.error(t('common.copy.failed'));
      }
    },
    [t],
  );

  const columns = [
    {
      title: t('webhook.apiKey.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('webhook.apiKey.prefix'),
      dataIndex: 'keyPrefix',
      key: 'keyPrefix',
      render: (prefix: string) => <Text code>{prefix}...</Text>,
    },
    {
      title: t('webhook.apiKey.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('webhook.apiKey.lastUsedAt'),
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date?: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : t('common.never'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: ApiKey) => (
        <Space>
          <Button
            size="small"
            icon={<FiEdit2 size={14} />}
            onClick={() => {
              setSelectedKey(record);
              setNewKeyName(record.name);
              setRenameModalOpen(true);
            }}
          >
            {t('common.rename')}
          </Button>
          <Popconfirm
            title={t('webhook.apiKey.deleteConfirm')}
            onConfirm={() => handleDelete(record.keyId)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger icon={<FiTrash2 size={14} />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Text strong>{t('webhook.apiKey.title')}</Text>
        <Button type="primary" icon={<FiPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          {t('webhook.apiKey.create')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={keys}
        rowKey="keyId"
        loading={loading}
        pagination={false}
      />

      {/* Create Modal */}
      <Modal
        title={t('webhook.apiKey.create')}
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewKeyName('');
          setNewApiKey(null);
        }}
        okText={newApiKey ? t('common.close') : t('common.create')}
        cancelButtonProps={{ style: { display: newApiKey ? 'none' : 'inline-block' } }}
      >
        {newApiKey ? (
          <div className="space-y-4">
            <Text type="warning">{t('webhook.apiKey.copyWarning')}</Text>
            <div className="flex gap-2">
              <Input value={newApiKey || ''} readOnly className="flex-1" />
              <Button
                icon={<Copy size={14} />}
                onClick={() => newApiKey && copyApiKeyToClipboard(newApiKey)}
              >
                {t('common.copy')}
              </Button>
            </div>
          </div>
        ) : (
          <Input
            placeholder={t('webhook.apiKey.namePlaceholder')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onPressEnter={handleCreate}
          />
        )}
      </Modal>

      {/* Rename Modal */}
      <Modal
        title={t('webhook.apiKey.rename')}
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => {
          setRenameModalOpen(false);
          setNewKeyName('');
          setSelectedKey(null);
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
      >
        <Input
          placeholder={t('webhook.apiKey.namePlaceholder')}
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          onPressEnter={handleRename}
        />
      </Modal>
    </div>
  );
});

ApiKeyManagementTab.displayName = 'ApiKeyManagementTab';
