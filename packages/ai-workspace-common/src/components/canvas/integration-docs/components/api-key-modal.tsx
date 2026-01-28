import { memo, useState } from 'react';
import { Modal, Button, Input, Table, Popconfirm, message, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApiKeys } from '../hooks/use-api-keys';
import dayjs from 'dayjs';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export const ApiKeyModal = memo(({ open, onClose }: ApiKeyModalProps) => {
  const { t } = useTranslation();
  const { apiKeys, loading, createApiKey, renameApiKey, deleteApiKey } = useApiKeys();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [renamingKey, setRenamingKey] = useState<{ keyId: string; name: string } | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      message.error(t('webhook.apiKey.nameRequired'));
      return;
    }

    try {
      const result = await createApiKey(newKeyName.trim());
      setCreatedKey(result.apiKey);
      setNewKeyName('');
      message.success(t('webhook.apiKey.createSuccess'));
    } catch (_error) {
      message.error(t('webhook.apiKey.createFailed'));
    }
  };

  const handleRename = async () => {
    if (!renamingKey || !renamingKey.name.trim()) {
      message.error(t('webhook.apiKey.nameRequired'));
      return;
    }

    try {
      await renameApiKey(renamingKey.keyId, renamingKey.name.trim());
      setRenameModalOpen(false);
      setRenamingKey(null);
      message.success(t('webhook.apiKey.renameSuccess'));
    } catch (_error) {
      message.error(t('webhook.apiKey.renameFailed'));
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await deleteApiKey(keyId);
      message.success(t('webhook.apiKey.deleteSuccess'));
    } catch (_error) {
      message.error(t('webhook.apiKey.deleteFailed'));
    }
  };

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
      render: (prefix: string) => <code>{prefix}...</code>,
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
      render: (date: string | null) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setRenamingKey({ keyId: record.keyId, name: record.name });
              setRenameModalOpen(true);
            }}
          >
            {t('webhook.apiKey.rename')}
          </Button>
          <Popconfirm
            title={t('webhook.apiKey.deleteConfirm')}
            onConfirm={() => handleDelete(record.keyId)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={t('webhook.apiKey.title')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            {t('webhook.apiKey.create')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={apiKeys}
          loading={loading}
          rowKey="keyId"
          pagination={{ pageSize: 10 }}
        />
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        title={t('webhook.apiKey.create')}
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewKeyName('');
          setCreatedKey(null);
        }}
        okText={createdKey ? t('common.close') : t('common.create')}
        cancelButtonProps={{ style: { display: createdKey ? 'none' : 'inline-block' } }}
      >
        {createdKey ? (
          <div>
            <p style={{ color: 'var(--refly-func-warning-default)', marginBottom: 12 }}>
              {t('webhook.apiKey.copyWarning')}
            </p>
            <Input.TextArea
              value={createdKey}
              readOnly
              autoSize={{ minRows: 3, maxRows: 3 }}
              style={{ fontFamily: 'monospace' }}
            />
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

      {/* Rename API Key Modal */}
      <Modal
        title={t('webhook.apiKey.rename')}
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => {
          setRenameModalOpen(false);
          setRenamingKey(null);
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
      >
        <Input
          placeholder={t('webhook.apiKey.namePlaceholder')}
          value={renamingKey?.name || ''}
          onChange={(e) =>
            setRenamingKey(renamingKey ? { ...renamingKey, name: e.target.value } : null)
          }
          onPressEnter={handleRename}
        />
      </Modal>
    </>
  );
});

ApiKeyModal.displayName = 'ApiKeyModal';
