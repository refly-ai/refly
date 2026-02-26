import { memo, useId, useState } from 'react';
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
  const [isMutating, setIsMutating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ keyId: string; name: string } | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const apiKeyNameInputId = useId();

  const handleCreate = async () => {
    if (isMutating) return;
    if (!newKeyName.trim()) {
      message.error(t('webhook.apiKey.nameRequired'));
      return;
    }

    setIsMutating(true);
    try {
      const result = await createApiKey(newKeyName.trim());
      setCreatedKey(result.apiKey);
      setNewKeyName('');
      message.success(t('webhook.apiKey.createSuccess'));
    } catch (_error) {
      message.error(t('webhook.apiKey.createFailed'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      message.success(t('common.copied'));
    } catch (_error) {
      message.error(t('common.copy.failed'));
    }
  };

  const handleDeleteClick = (keyId: string, name: string) => {
    setKeyToDelete({ keyId, name });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete || isMutating) return;

    setIsMutating(true);
    try {
      await deleteApiKey(keyToDelete.keyId);
      message.success(t('webhook.apiKey.deleteSuccess'));
      setDeleteModalOpen(false);
      setKeyToDelete(null);
    } catch (_error) {
      message.error(t('webhook.apiKey.deleteFailed'));
    } finally {
      setIsMutating(false);
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
        centered
        className="api-key-management-modal"
      >
        <div className="p-6">
          <p className="text-sm text-[var(--refly-text-2)] mb-4 leading-normal">
            {t('webhook.apiKey.description')}
          </p>

          {/* API Keys List */}
          {apiKeys.length > 0 && (
            <div className="mb-4 rounded-lg bg-[var(--refly-bg-control-z0)] overflow-hidden">
              {/* List Header */}
              <div className="api-key-list-header">
                <span className="flex-1 text-sm text-[var(--refly-text-2)]">
                  {t('webhook.apiKey.name')}
                </span>
                <span className="flex-1 text-sm text-[var(--refly-text-2)]">
                  {t('webhook.apiKey.listHeader')}
                </span>
              </div>

              {/* List Items */}
              {apiKeys.map((apiKey, index) => (
                <div
                  key={apiKey.keyId}
                  className={`api-key-list-item ${index < apiKeys.length - 1 ? 'has-border' : ''}`}
                >
                  <div className="flex items-center gap-6 flex-1">
                    <span className="flex-1 text-sm font-medium text-[var(--refly-text-0)]">
                      {apiKey.name}
                    </span>
                    <span className="flex-1 text-sm font-medium text-[var(--refly-text-0)] font-mono">
                      {apiKey.keyPrefix}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
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
            disabled={isMutating}
            className="inline-flex items-center gap-2"
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
        centered
        className="api-key-create-modal"
      >
        <div className="p-6">
          {createdKey ? (
            <>
              <div className="text-xs text-[var(--refly-func-error-default,var(--ant-color-error,#ff4d4f))] -mt-2 mb-4 leading-normal">
                {t('webhook.apiKey.copyWarning')}
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--refly-bg-control-z1)] border border-[var(--refly-line)] mb-4">
                <span className="flex-1 font-mono text-[13px] text-[var(--refly-text-0)] break-all leading-relaxed">
                  {createdKey}
                </span>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyKey(createdKey)}
                  className="api-key-display-copy"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  className="api-key-create-confirm-btn-black"
                  onClick={handleCloseCreateModal}
                >
                  {t('common.close')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label
                  className="block text-sm font-medium text-[var(--refly-text-0)] mb-2"
                  htmlFor={apiKeyNameInputId}
                >
                  {t('webhook.apiKey.name')}
                </label>
                <Input
                  id={apiKeyNameInputId}
                  placeholder={t('webhook.apiKey.namePlaceholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onPressEnter={handleCreate}
                  className="api-key-input"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button onClick={handleCloseCreateModal}>{t('common.cancel')}</Button>
                <Button
                  onClick={handleCreate}
                  loading={loading}
                  disabled={isMutating}
                  className="api-key-create-confirm-btn-black"
                >
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
        centered
        className="api-key-delete-modal"
      >
        <div className="p-6">
          <div className="mb-6">
            <p className="text-sm text-refly-text-0 leading-relaxed m-0">
              {t('webhook.apiKey.deleteDescription')}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button onClick={handleDeleteCancel} className="api-key-delete-cancel-btn">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              loading={loading}
              disabled={isMutating}
              className="api-key-delete-confirm-btn"
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
});

ApiKeyModal.displayName = 'ApiKeyModal';
