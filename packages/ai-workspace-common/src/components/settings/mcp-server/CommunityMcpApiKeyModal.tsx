import React, { memo } from 'react';
import { Modal, Form, Input, Button, message, Alert, Space, Typography } from 'antd';
import { KeyOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { CommunityMcpApiKeyModalProps, ApiKeyConfiguration } from './types';
import { getConfigDescription, requiresApiKey } from './utils';

const { Text, Link } = Typography;

export const CommunityMcpApiKeyModal: React.FC<CommunityMcpApiKeyModalProps> = memo(
  ({ visible, config, onClose, onSuccess, loading: externalLoading }) => {
    const [form] = Form.useForm<ApiKeyConfiguration>();

    const { t } = useTranslation();

    // Check if API key is required
    const requiresApiKeyFlag = requiresApiKey(config);

    // Handle direct installation with validation
    const handleValidateAndInstall = async (values: ApiKeyConfiguration) => {
      try {
        // Step 1: Validate MCP server connection

        message.info(t('settings.mcpServer.community.validating'));

        await onSuccess?.(values.apiKey);

        // Step 2: Install the MCP server if validation successful
      } catch (error) {
        console.error('Validate and install error:', error);
        // Error handling is done in mutation callbacks
      }
    };

    // Handle modal close
    const handleClose = () => {
      form.resetFields();

      onClose();
    };

    // Get description text using utility function
    const description = getConfigDescription(config, t);

    // Get authorization type descriptions
    const getAuthDescription = () => {
      if (!config.authorization?.length) return null;

      const authTypes = config.authorization.map((auth) => {
        switch (auth.apiKeyIn) {
          case 'url':
            return t('settings.mcpServer.community.auth.urlParam');
          case 'authorizationBearer':
            return t('settings.mcpServer.community.auth.bearerToken');
          case 'headers':
            return t('settings.mcpServer.community.auth.headerKey', {
              header: auth.paramName || 'X-API-Key',
            });
          default:
            return t('settings.mcpServer.community.auth.apiKey');
        }
      });

      return authTypes.join(', ');
    };

    const isLoading = externalLoading;

    return (
      <Modal
        title={
          <Space>
            <KeyOutlined />
            {t('settings.mcpServer.community.configureApiKey')}
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
          {/* Server information */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center mr-3">
                {config.icon ? (
                  <img src={config.icon} alt={config.name} className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-4 h-4 rounded bg-gray-300 dark:bg-gray-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Text strong className="text-gray-900 dark:text-gray-100">
                    {config.name}
                  </Text>
                  {config.documentation && (
                    <Link
                      href={config.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Space size={4}>
                        <LinkOutlined />
                        <span className="text-xs">{t('common.docs')}</span>
                      </Space>
                    </Link>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
              </div>
            </div>
          </div>

          {/* API key requirement notice */}
          {requiresApiKeyFlag && (
            <Alert
              type="info"
              icon={<ExclamationCircleOutlined />}
              message={t('settings.mcpServer.community.apiKeyRequired')}
              description={
                <div className="space-y-2">
                  <div>{t('settings.mcpServer.community.apiKeyDescription')}</div>
                  {getAuthDescription() && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {t('settings.mcpServer.community.authMethod')}: {getAuthDescription()}
                    </div>
                  )}
                </div>
              }
              showIcon
            />
          )}

          {/* API key configuration form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleValidateAndInstall}
            disabled={isLoading}
          >
            <Form.Item
              name="apiKey"
              label={t('settings.mcpServer.community.apiKeyLabel')}
              rules={[
                {
                  required: true,
                  message: t('settings.mcpServer.community.apiKeyRequired'),
                },
                {
                  min: 1,
                  message: t('settings.mcpServer.community.apiKeyRequired'),
                },
              ]}
            >
              <Input.Password
                placeholder={t('settings.mcpServer.community.apiKeyPlaceholder')}
                prefix={<KeyOutlined />}
                size="large"
              />
            </Form.Item>

            {/* Footer buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button onClick={handleClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoading} disabled={isLoading}>
                {isLoading
                  ? t('settings.mcpServer.community.installing')
                  : t('settings.mcpServer.community.install')}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    );
  },
);

CommunityMcpApiKeyModal.displayName = 'CommunityMcpApiKeyModal';
