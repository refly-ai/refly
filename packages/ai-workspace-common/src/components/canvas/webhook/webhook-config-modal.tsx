import { memo, useState } from 'react';
import { Modal, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { WebhookConfigTab } from './webhook-config-tab';
import { ApiKeyManagementTab } from './api-key-management-tab';

interface WebhookConfigModalProps {
  canvasId: string;
  open: boolean;
  onClose: () => void;
}

export const WebhookConfigModal = memo(({ canvasId, open, onClose }: WebhookConfigModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('config');

  const tabs = [
    {
      key: 'config',
      label: t('webhook.tabs.config'),
      children: <WebhookConfigTab canvasId={canvasId} />,
    },
    {
      key: 'apiKeys',
      label: t('webhook.tabs.apiKeys'),
      children: <ApiKeyManagementTab />,
    },
  ];

  return (
    <Modal
      title={t('webhook.configTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
    </Modal>
  );
});

WebhookConfigModal.displayName = 'WebhookConfigModal';
