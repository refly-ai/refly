import React, { memo } from 'react';
import { Modal, Form, Input, Button, message, Space, Typography, Tooltip } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { CommunityMcpApiKeyModalProps, ApiKeyConfiguration } from './types';
import { getConfigDescription, requiresApiKey } from './utils';
import { Doc, Mcp } from 'refly-icons';
import { CategoryTag } from '../model-providers/CommunityProviderCard';

const { Text, Paragraph } = Typography;

export const CommunityMcpApiKeyModal: React.FC<CommunityMcpApiKeyModalProps> = memo(
  ({ visible, config, onClose, onSuccess, loading: externalLoading }) => {
    const [form] = Form.useForm<ApiKeyConfiguration>();

    const { t } = useTranslation();

    // Check if API key is required
    const requiresApiKeyFlag = requiresApiKey(config);

    // Get form values for validation
    const apiKeyValue = Form.useWatch('apiKey', form);

    // Check if submit button should be disabled
    const isSubmitDisabled = externalLoading || (requiresApiKeyFlag && !apiKeyValue?.trim());

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
        centered
        open={visible}
        onCancel={handleClose}
        width={520}
        footer={null}
        destroyOnHidden
        maskClosable={!isLoading}
        closable={false}
      >
        <div>
          {/* Server information */}
          <div className="mt-5 border-solid border-[1px] border-refly-Card-Border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-lg bg-refly-bg-control-z0 flex items-center justify-center">
                {config.icon ? (
                  <img src={config.icon} alt={config.name} className="w-5 h-5 object-contain" />
                ) : (
                  <Mcp size={24} />
                )}
              </div>
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <Text strong className="text-gray-900 dark:text-gray-100">
                    {config.name}
                  </Text>
                  <div className="flex items-center gap-1">
                    <CategoryTag category={config.type?.toUpperCase()} />
                  </div>
                </div>

                {config.documentation && (
                  <Tooltip
                    title={t('settings.mcpServer.community.viewDocumentation')}
                    placement="bottom"
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (config.documentation) {
                          window.open(config.documentation, '_blank');
                        }
                      }}
                      className="w-8 h-8 cursor-pointer flex-shrink-0 rounded-md bg-refly-tertiary-default flex items-center justify-center hover:bg-refly-tertiary-hover"
                    >
                      <Doc size={24} />
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
            <Paragraph
              className="text-refly-text-1 text-sm !mb-0"
              ellipsis={{ rows: 3, tooltip: true }}
            >
              {description}
            </Paragraph>
          </div>

          {/* API key requirement notice */}
          {requiresApiKeyFlag && (
            <div className="my-3 text-refly-func-warning-default">
              <div className="text-sm font-semibold">
                {t('settings.mcpServer.community.apiKeyDescription')}
              </div>
              {getAuthDescription() && (
                <div className="text-xs">
                  {t('settings.mcpServer.community.authMethod')}: {getAuthDescription()}
                </div>
              )}
            </div>
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
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                disabled={isSubmitDisabled}
              >
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
