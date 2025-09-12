import React, { memo, useState } from 'react';
import { Button, Typography, Tooltip, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
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
import { Doc } from 'refly-icons';
import { CategoryTag } from '../model-providers/CommunityProviderCard';

const { Paragraph } = Typography;

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
          loading: true,
          disabled: true,
          children: t('settings.mcpServer.community.validating'),
        };
      }

      if (isInstalling || installing) {
        return {
          loading: true,
          disabled: true,
          children: t('settings.mcpServer.community.installing'),
        };
      }

      return {
        onClick: handleInstall,
        children: t('settings.mcpServer.community.install'),
      };
    };

    const buttonProps = getInstallButtonProps();
    const faviconUrl = getFaviconUrl();
    const faviconServiceUrl = getFaviconServiceUrl();

    return (
      <>
        <div className="p-4 bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border rounded-lg hover:shadow-refly-m transition-all duration-200">
          {/* Header section with icon, title and badge */}
          <div className="mb-2">
            <div className="flex items-center mb-0.5">
              {/* Favicon/Icon */}
              <div className="w-11 h-11 rounded-lg bg-refly-bg-control-z0 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt={`${config.name} icon`}
                    className="w-6 h-6 object-contain rounded"
                    style={{
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                    onError={() => setFaviconError(true)}
                    onLoad={() => setFaviconError(false)}
                  />
                ) : (
                  <Favicon url={faviconServiceUrl} size={24} />
                )}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="text-refly-text-0 text-base leading-[26px] line-clamp-1 font-semibold">
                  {config.name}
                </div>
                <div className="flex items-center gap-1">
                  <CategoryTag category={config.type?.toUpperCase()} />
                </div>
              </div>
            </div>
          </div>

          {/* Description section */}
          <div className="mb-5">
            <div className="text-refly-text-1 text-sm leading-relaxed min-h-[4.5rem] flex items-start">
              <Paragraph
                className="text-refly-text-1 text-sm !mb-0"
                ellipsis={{ rows: 3, tooltip: true }}
              >
                {description}
              </Paragraph>
            </div>
          </div>

          {/* Action section */}
          <div className="flex items-center justify-between gap-3">
            <Button
              {...buttonProps}
              size="middle"
              type="text"
              variant="filled"
              className={`h-8 flex-1 cursor-pointer font-semibold border-solid border-[1px] border-refly-Card-Border rounded-lg bg-refly-tertiary-default ${
                buttonProps.disabled ? '' : 'hover:!bg-refly-tertiary-hover'
              }`}
            />

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
