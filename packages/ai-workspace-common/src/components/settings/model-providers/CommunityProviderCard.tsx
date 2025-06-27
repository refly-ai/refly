import React, { memo, useState, useCallback } from 'react';
import { Card, Button, Typography, Space, message } from 'antd';
import { DownloadOutlined, CheckOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { CommunityProviderConfig } from './provider-store-types';
import { convertCommunityConfigToProviderRequest, requiresApiKey } from './provider-store-utils';
import { CommunityProviderApiKeyModal } from './CommunityProviderApiKeyModal';
import { useCreateProvider } from '@refly-packages/ai-workspace-common/queries';

const { Text } = Typography;

interface CommunityProviderCardProps {
  config: CommunityProviderConfig;
  isInstalled?: boolean;
  onInstallSuccess?: (config: CommunityProviderConfig) => void;
}

export const CommunityProviderCard: React.FC<CommunityProviderCardProps> = memo(
  ({ config, isInstalled = false, onInstallSuccess }) => {
    const [isCurrentlyInstalling, setIsCurrentlyInstalling] = useState(false);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const { t } = useTranslation();

    // Initialize the create MCP server mutation
    const createProvider = useCreateProvider([], {
      onSuccess: (response) => {
        if (!response?.data?.success) {
          throw response.data.errMsg;
        }
        message.success(t('settings.mcpServer.community.installSuccess', { name: config.name }));
        setIsCurrentlyInstalling(false);
        onInstallSuccess?.(config);
      },
      onError: (error) => {
        console.error('Installation error:', error);
        message.error(t('settings.mcpServer.community.installError', { name: config.name }));
        setIsCurrentlyInstalling(false);
      },
    });

    // Handle installation with user configuration (API key, etc.)
    const handleInstallWithConfig = useCallback(
      async (userConfig?: { apiKey: string; baseUrl?: string }) => {
        try {
          setIsCurrentlyInstalling(true);

          const request = convertCommunityConfigToProviderRequest(config, userConfig);
          await createProvider.mutateAsync({
            body: request,
          });

          message.success(
            t('settings.modelProviders.community.installSuccess', { name: config.name }),
          );
          setShowApiKeyModal(false);
          onInstallSuccess?.(config);
        } catch (error) {
          console.error('Installation error:', error);
          message.error(t('settings.modelProviders.community.installError', { name: config.name }));
        } finally {
          setIsCurrentlyInstalling(false);
        }
      },
      [config, createProvider, onInstallSuccess, t],
    );

    // Handle install button click
    const handleInstall = useCallback(() => {
      if (requiresApiKey(config)) {
        setShowApiKeyModal(true);
      } else {
        handleInstallWithConfig();
      }
    }, [config, handleInstallWithConfig]);

    // Handle documentation link click
    const handleDocumentationClick = useCallback(() => {
      if (config.documentation) {
        window.open(config.documentation, '_blank', 'noopener,noreferrer');
      }
    }, [config.documentation]);

    // Get localized description
    const description =
      typeof config.description === 'object'
        ? config.description?.['zh-CN'] || config.description?.en || ''
        : config.description || '';

    // Get button properties based on state
    const getButtonProps = () => {
      if (isInstalled) {
        return {
          type: 'default' as const,
          icon: <CheckOutlined />,
          children: t('settings.modelProviders.community.installed'),
          disabled: true,
          style: {
            color: '#52c41a',
            borderColor: '#52c41a',
            backgroundColor: '#f6ffed',
          },
        };
      }

      if (isCurrentlyInstalling) {
        return {
          type: 'primary' as const,
          loading: true,
          children: t('settings.modelProviders.community.installing'),
          disabled: true,
        };
      }

      return {
        type: 'primary' as const,
        icon: <DownloadOutlined />,
        children: t('settings.modelProviders.community.install'),
        onClick: handleInstall,
      };
    };

    const buttonProps = getButtonProps();

    return (
      <>
        <Card
          hoverable={!isInstalled}
          className="transition-all duration-200 hover:shadow-md"
          style={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            position: 'relative',
          }}
          bodyStyle={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* Header with name and documentation */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* <Avatar
                src={config.icon}
                size={40}
                className="flex-shrink-0"
                style={{
                  backgroundColor: config.icon ? 'transparent' : '#1890ff',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                {!config.icon && config.name.charAt(0).toUpperCase()}
              </Avatar> */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <Text
                    strong
                    className="text-gray-900 text-base leading-tight truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {config.name}
                  </Text>
                </div>
              </div>
            </div>

            {/* Documentation link in top right */}
            {config.documentation && (
              <span
                onClick={handleDocumentationClick}
                className="text-gray-400 hover:text-blue-500 transition-colors duration-200 cursor-pointer flex-shrink-0"
                style={{ fontSize: '12px' }}
              >
                <Space size={4}>
                  <LinkOutlined style={{ fontSize: '12px' }} />
                  <span>查看文档</span>
                </Space>
              </span>
            )}
          </div>

          {/* Description */}
          <div className="flex-1 mb-3">
            <Text
              className="text-gray-600 text-sm leading-relaxed block"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.4',
                height: '2.8em',
              }}
            >
              {description || t('settings.modelProviders.community.noDescription')}
            </Text>
          </div>

          {/* Footer with categories and install button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 flex-wrap flex-1 min-w-0">
              {/* Category tags */}
              {config.categories?.length > 0
                ? config.categories.map((category, index) => (
                    <span
                      key={`${category}-${index}`}
                      className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap"
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        lineHeight: '16px',
                      }}
                    >
                      {category}
                    </span>
                  ))
                : config.category && (
                    <span
                      className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 border border-blue-200"
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        lineHeight: '16px',
                      }}
                    >
                      {config.category}
                    </span>
                  )}
            </div>

            {/* Install Button */}
            <Button {...buttonProps} size="small" className="ml-auto" />
          </div>
        </Card>

        {/* API Key Configuration Modal */}
        <CommunityProviderApiKeyModal
          visible={showApiKeyModal}
          config={config}
          onClose={() => setShowApiKeyModal(false)}
          onSuccess={handleInstallWithConfig}
          loading={isCurrentlyInstalling}
        />
      </>
    );
  },
);

CommunityProviderCard.displayName = 'CommunityProviderCard';
