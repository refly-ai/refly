import { memo, useState } from 'react';
import { Modal, Button, Input, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApiKeys } from '../hooks/use-api-keys';
import './api-key-modal.scss';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export const ApiKeyModal = memo(({ open, onClose }: ApiKeyModalProps) => {
  const { t } = useTranslation();
  const { apiKeys, loading, createApiKey, deleteApiKey } = useApiKeys();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ keyId: string; name: string } | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
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

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success(t('common.copied'));
  };

  const handleDeleteClick = (keyId: string, name: string) => {
    setKeyToDelete({ keyId, name });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;

    try {
      await deleteApiKey(keyToDelete.keyId);
      message.success(t('webhook.apiKey.deleteSuccess'));
      setDeleteModalOpen(false);
      setKeyToDelete(null);
    } catch (_error) {
      message.error(t('webhook.apiKey.deleteFailed'));
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setKeyToDelete(null);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    setNewKeyName('');
    setCreatedKey(null);
  };

  return (
    <>
      {/* Main API Key Management Modal */}
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        title={t('webhook.apiKey.title')}
        width={550}
        destroyOnClose
        className="api-key-management-modal"
      >
        <div className="api-key-modal-content">
          <p className="api-key-modal-description">{t('webhook.apiKey.description')}</p>

          {/* API Keys List */}
          {apiKeys.length > 0 && (
            <div className="api-key-list">
              {/* List Header */}
              <div className="api-key-list-header">
                <span className="api-key-header-name">{t('webhook.apiKey.name')}</span>
                <span className="api-key-header-key">{t('webhook.apiKey.listHeader')}</span>
              </div>

              {/* List Items */}
              {apiKeys.map((apiKey, index) => (
                <div
                  key={apiKey.keyId}
                  className={`api-key-list-item ${index < apiKeys.length - 1 ? 'has-border' : ''}`}
                >
                  <div className="api-key-info">
                    <span className="api-key-name">{apiKey.name}</span>
                    <span className="api-key-value">{apiKey.keyPrefix}...</span>
                  </div>
                  <div className="api-key-actions">
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopyKey(apiKey.keyPrefix)}
                      className="api-key-action-btn"
                    />
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteClick(apiKey.keyId, apiKey.name)}
                      className="api-key-action-btn"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Button */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            loading={loading}
            className="api-key-create-btn"
          >
            {t('webhook.apiKey.create')}
          </Button>
        </div>
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        open={createModalOpen}
        onCancel={handleCloseCreateModal}
        footer={null}
        title={createdKey ? t('webhook.apiKey.keyCreated') : t('webhook.apiKey.create')}
        width={480}
        destroyOnClose
        className="api-key-create-modal"
      >
        <div className="api-key-modal-content">
          {createdKey ? (
            <>
              <div className="api-key-display">
                <span className="api-key-display-value">{createdKey}</span>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyKey(createdKey)}
                  className="api-key-display-copy"
                />
              </div>
              <div className="api-key-modal-footer">
                <Button type="primary" onClick={handleCloseCreateModal}>
                  {t('common.close')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="api-key-form-field">
                <label className="api-key-form-label">{t('webhook.apiKey.name')}</label>
                <Input
                  placeholder={t('webhook.apiKey.namePlaceholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onPressEnter={handleCreate}
                  className="api-key-input"
                />
              </div>
              <div className="api-key-modal-footer">
                <Button onClick={handleCloseCreateModal}>{t('common.cancel')}</Button>
                <Button type="primary" onClick={handleCreate} loading={loading}>
                  {t('common.create')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onCancel={handleDeleteCancel}
        footer={null}
        title={t('webhook.apiKey.deleteTitle')}
        width={480}
        destroyOnClose
        className="api-key-delete-modal"
      >
        <div className="api-key-delete-content">
          <p className="api-key-delete-description">{t('webhook.apiKey.deleteDescription')}</p>
        </div>

        <div className="api-key-delete-footer">
          <Button onClick={handleDeleteCancel} className="api-key-delete-cancel-btn">
            {t('common.cancel')}
          </Button>
          <Button
            danger
            type="primary"
            onClick={handleDeleteConfirm}
            loading={loading}
            className="api-key-delete-confirm-btn"
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </>
  );
});

ApiKeyModal.displayName = 'ApiKeyModal';
