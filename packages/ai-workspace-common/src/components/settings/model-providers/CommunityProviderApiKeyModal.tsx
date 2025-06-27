import React, { memo } from 'react';
import { Modal, Form, Input, Button, Alert, Space, Typography } from 'antd';
import { KeyOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';

import { CommunityProviderConfig } from './provider-store-types';
import { useTranslation } from 'react-i18next';

const { Text, Link } = Typography;

interface ApiKeyConfiguration {
  apiKey: string;
  baseUrl?: string;
  [key: string]: any;
}

interface CommunityProviderApiKeyModalProps {
  visible: boolean;
  config: CommunityProviderConfig;
  onClose: () => void;
  onSuccess?: (userConfig: { apiKey: string; baseUrl?: string }) => void;
  loading?: boolean;
}

export const CommunityProviderApiKeyModal: React.FC<CommunityProviderApiKeyModalProps> = memo(
  ({ visible, config, onClose, onSuccess, loading: externalLoading }) => {
    const [form] = Form.useForm<ApiKeyConfiguration>();
    const { t } = useTranslation();

    // Handle installation with API key
    const handleInstall = async (values: ApiKeyConfiguration) => {
      try {
        // Call the parent's onSuccess handler with the user configuration
        onSuccess?.({
          apiKey: values.apiKey,
          baseUrl: values.baseUrl || config.baseUrl,
        });
      } catch (error) {
        console.error('Install error:', error);
      }
    };

    // Handle modal close
    const handleClose = () => {
      form.resetFields();
      onClose();
    };

    // Get localized description
    const description =
      typeof config.description === 'object'
        ? config.description?.['zh-CN'] || config.description?.en || ''
        : config.description || '';

    const isLoading = externalLoading;

    return (
      <Modal
        title={
          <Space>
            <KeyOutlined />
            {t('settings.modelProviders.community.configureApiKey')}
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        width={520}
        footer={null}
        destroyOnClose
        maskClosable={!isLoading}
      >
        <div className="space-y-4">
          {/* Provider information */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mr-3">
                {config.icon ? (
                  <img src={config.icon} alt={config.name} className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                    {config.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Text strong className="text-gray-900">
                    {config.name}
                  </Text>
                  {config.documentation && (
                    <Link
                      href={config.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <Space size={4}>
                        <LinkOutlined />
                        <span className="text-xs">
                          {t('settings.modelProviders.community.documentation')}
                        </span>
                      </Space>
                    </Link>
                  )}
                </div>
                <div className="text-xs text-gray-500">{description}</div>
              </div>
            </div>
          </div>

          {/* API key requirement notice */}
          <Alert
            type="info"
            icon={<ExclamationCircleOutlined />}
            message={t('settings.modelProviders.community.apiKeyRequired')}
            description={t('settings.modelProviders.community.apiKeyRequiredDescription')}
            showIcon
          />

          {/* API key configuration form */}
          <Form form={form} layout="vertical" onFinish={handleInstall} disabled={isLoading}>
            <Form.Item
              name="apiKey"
              label={t('settings.modelProviders.community.apiKeyLabel')}
              rules={[
                {
                  required: true,
                  message: t('settings.modelProviders.community.apiKeyPlaceholder'),
                },
                {
                  min: 1,
                  message: t('settings.modelProviders.community.apiKeyPlaceholder'),
                },
              ]}
            >
              <Input.Password
                placeholder={t('settings.modelProviders.community.apiKeyPlaceholder')}
                prefix={<KeyOutlined />}
                size="large"
              />
            </Form.Item>

            {/* Optional base URL field */}
            <Form.Item
              name="baseUrl"
              label={t('settings.modelProviders.community.baseUrlLabel')}
              extra={t('settings.modelProviders.community.baseUrlDescription')}
            >
              <Input
                placeholder={
                  config.baseUrl || t('settings.modelProviders.community.baseUrlPlaceholder')
                }
                size="large"
              />
            </Form.Item>

            {/* Footer buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button onClick={handleClose} disabled={isLoading}>
                {t('settings.modelProviders.community.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoading} disabled={isLoading}>
                {isLoading
                  ? t('settings.modelProviders.community.installing')
                  : t('settings.modelProviders.community.install')}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    );
  },
);

CommunityProviderApiKeyModal.displayName = 'CommunityProviderApiKeyModal';
