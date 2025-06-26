import React, { memo, useState } from 'react';
import { Card, Button, Badge, Typography, Tooltip, Space, message } from 'antd';
import { DownloadOutlined, CheckOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useCreateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';

import { CommunityMcpCardProps } from './types';
import {
  convertCommunityConfigToServerRequest,
  requiresApiKey,
  getConfigDescription,
} from './utils';
import { CommunityMcpApiKeyModal } from './CommunityMcpApiKeyModal';
import { Favicon } from '../../common/favicon';

const { Text, Title, Paragraph } = Typography;

export const CommunityMcpCard: React.FC<CommunityMcpCardProps> = memo(
  ({ config, isInstalled, isInstalling, onInstall }) => {
    const [installing, setInstalling] = useState(false);
    const [validating, setValidating] = useState(false);
    const [faviconError, setFaviconError] = useState(false);
    const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
    const { t } = useTranslation();

    // Initialize the create MCP server mutation
    const createMcpServer = useCreateMcpServer([], {
      onSuccess: (response) => {
        if (!response?.data?.success) {
          throw response.data.errMsg;
        }
        message.success(t('settings.mcpServer.community.installSuccess', { name: config.name }));
        setInstalling(false);
        onInstall?.(config);
      },
      onError: (error) => {
        console.error('Installation error:', error);
        message.error(t('settings.mcpServer.community.installError', { name: config.name }));
        setInstalling(false);
      },
    });

    // Initialize the validate MCP server mutation
    const validateMcpServer = useValidateMcpServer([], {
      onSuccess: (response) => {
        if (!response?.data?.success) {
          throw response.data.errMsg;
        }
        message.success(t('settings.mcpServer.community.validateSuccess'));
        setValidating(false);
      },
      onError: (error) => {
        console.error('Validation error:', error);
        message.error(t('settings.mcpServer.community.validateError'));
        setValidating(false);
      },
    });

    // Get favicon URL with fallback
    const getFaviconUrl = () => {
      if (faviconError || !config.icon) {
        return null;
      }
      return config.icon;
    };

    // Get URL for favicon service (prioritize documentation then main URL)
    const getFaviconServiceUrl = () => {
      // Priority 1: Use documentation URL if available
      if (config.documentation) {
        return config.documentation;
      }

      // Priority 2: Use main URL if available
      if (config.url) {
        return config.url;
      }

      // Fallback: use a generic URL
      return `https://${config.name?.toLowerCase().replace(/\s+/g, '-') || 'example'}.com`;
    };

    // Get description with locale support
    const description = getConfigDescription(config, t);

    // Get type color for badge
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'sse':
          return '#1890ff';
        case 'streamable':
          return '#52c41a';
        case 'stdio':
          return '#fa8c16';
        case 'websocket':
          return '#722ed1';
        default:
          return '#d9d9d9';
      }
    };

    // Handle installation
    const handleInstall = async () => {
      // Check if API key is required using utility function
      if (requiresApiKey(config)) {
        // Show API key configuration modal
        setApiKeyModalVisible(true);
        return;
      }

      // Direct installation for configs that don't require API key
      await performInstallation();
    };

    // Perform the actual installation
    const performInstallation = async (apiKey?: string) => {
      try {
        // Convert community config to server request format with API key
        const serverRequest = convertCommunityConfigToServerRequest(config, apiKey);

        // Step 1: Validate MCP server connection
        setValidating(true);
        message.info(t('settings.mcpServer.community.validating'));

        await validateMcpServer.mutateAsync({
          body: serverRequest,
        });

        // Step 2: Install the MCP server if validation successful
        setValidating(false);
        setInstalling(true);

        await createMcpServer.mutateAsync({
          body: serverRequest,
        });

        // Only show success message for direct installation (no API key modal)
        // API key modal will show its own success message
        if (!apiKey) {
          message.success(t('settings.mcpServer.community.installSuccess', { name: config.name }));
        }

        setApiKeyModalVisible(false);
        // Always call onInstall on success to refresh parent state
        onInstall?.(config);
      } catch (error: any) {
        console.error('Installation error:', error);
        // Always show error message regardless of source
        const errorMessage = validating
          ? t('settings.mcpServer.community.validateError')
          : t('settings.mcpServer.community.installError', { name: config.name });
        message.error(errorMessage);
      } finally {
        setValidating(false);
        setInstalling(false);
      }
    };

    // Get install button props
    const getInstallButtonProps = () => {
      if (isInstalled) {
        return {
          type: 'default' as const,
          icon: <CheckOutlined />,
          disabled: true,
          children: t('settings.mcpServer.community.installed'),
          style: {
            color: '#52c41a',
            borderColor: '#52c41a',
            backgroundColor: '#f6ffed',
          },
        };
      }

      if (validating) {
        return {
          type: 'primary' as const,
          loading: true,
          disabled: true,
          children: t('settings.mcpServer.community.validating'),
        };
      }

      if (isInstalling || installing) {
        return {
          type: 'primary' as const,
          loading: true,
          disabled: true,
          children: t('settings.mcpServer.community.installing'),
        };
      }

      return {
        type: 'primary' as const,
        icon: <DownloadOutlined />,
        onClick: handleInstall,
        children: t('settings.mcpServer.community.install'),
      };
    };

    const buttonProps = getInstallButtonProps();
    const faviconUrl = getFaviconUrl();
    const faviconServiceUrl = getFaviconServiceUrl();

    return (
      <>
        <Card
          hoverable={!isInstalled && !isInstalling}
          className="community-mcp-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          style={{
            height: '100px',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          styles={{
            body: {
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            },
          }}
        >
          {/* Main content layout */}
          <div className="flex items-center justify-between h-full">
            {/* Left side - Logo, title and description */}
            <div className="flex items-center flex-1 min-w-0">
              {/* Logo with favicon or placeholder */}
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center mr-3 flex-shrink-0 overflow-hidden shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt={`${config.name} icon`}
                    className="w-8 h-8 object-contain rounded-lg"
                    style={{
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                    onError={() => setFaviconError(true)}
                    onLoad={() => setFaviconError(false)}
                  />
                ) : (
                  <Favicon url={faviconServiceUrl} size={32} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title and badge row */}
                <div className="flex items-center mb-1">
                  <Title
                    level={5}
                    className="truncate text-gray-900 dark:text-gray-100"
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      marginRight: '8px',
                    }}
                    title={config.name}
                  >
                    {config.name}
                  </Title>
                  <Badge
                    color={getTypeColor(config.type)}
                    text={config.type?.toUpperCase()}
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  />
                </div>

                {/* Description */}
                <Paragraph
                  className="text-gray-600 dark:text-gray-400"
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: '1.3',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    height: '32px',
                  }}
                  title={description}
                >
                  {description}
                </Paragraph>

                {/* Metadata */}
                {(config.author || config.version) && (
                  <div className="flex items-center mt-1">
                    <Space size={6}>
                      {config.author && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          # {config.author}
                        </Text>
                      )}
                      {config.version && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          v{config.version}
                        </Text>
                      )}
                    </Space>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center ml-3 flex-shrink-0">
              {/* Documentation button */}
              {config.documentation && (
                <Tooltip title={t('settings.mcpServer.community.viewDocumentation')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ExclamationCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (config.documentation) {
                        window.open(config.documentation, '_blank');
                      }
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mr-2"
                    style={{
                      padding: '2px',
                      fontSize: '12px',
                    }}
                  />
                </Tooltip>
              )}

              {/* Install button */}
              <Button
                size="small"
                {...buttonProps}
                style={{
                  minWidth: '70px',
                  height: '28px',
                  fontWeight: 500,
                  fontSize: '12px',
                  ...buttonProps.style,
                }}
              />
            </div>
          </div>
        </Card>

        {/* API Key Configuration Modal */}
        <CommunityMcpApiKeyModal
          visible={apiKeyModalVisible}
          config={config}
          onClose={() => setApiKeyModalVisible(false)}
          onSuccess={(apiKey: string) => performInstallation(apiKey)}
          loading={installing || validating}
        />
      </>
    );
  },
);

CommunityMcpCard.displayName = 'CommunityMcpCard';
