import React, { useState, useMemo } from 'react';
import { Row, Col, Input, Select, Alert, Empty, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { McpServerDTO } from '@refly/openapi-schema';
import { useListCommunityMcpConfigs } from '@refly-packages/ai-workspace-common/queries/mcp-community';
import {
  CommunityMcpCard,
  CommunityMcpCardSkeleton,
} from '@refly-packages/ai-workspace-common/components/settings/mcp-server';
import { CommunityMcpConfig } from './types';

interface CommunityMcpListProps {
  visible: boolean;
  installedServers: McpServerDTO[];
  onInstallSuccess: () => void;
}

export const CommunityMcpList: React.FC<CommunityMcpListProps> = ({
  visible,
  installedServers,
  onInstallSuccess,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Fetch community configurations
  const {
    data: communityData,
    isLoading: isCommunityLoading,
    error: communityError,
  } = useListCommunityMcpConfigs(undefined, {
    enabled: visible,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const communityConfigs = useMemo(() => communityData?.servers || [], [communityData]);

  // Filter community configurations
  const filteredCommunityConfigs = useMemo(() => {
    if (!communityConfigs) return [];

    return communityConfigs.filter((config) => {
      const matchesSearch =
        searchText === '' ||
        config.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (typeof config.description === 'string'
          ? config.description.toLowerCase().includes(searchText.toLowerCase())
          : config.description?.en?.toLowerCase().includes(searchText.toLowerCase()) ||
            config.description?.['zh-CN']?.toLowerCase().includes(searchText.toLowerCase()));

      const matchesType = selectedType === 'all' || config.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [communityConfigs, searchText, selectedType]);

  // Check if server is already installed
  const isServerInstalled = (config: CommunityMcpConfig) => {
    return installedServers.some((server) => server.name === config.name);
  };

  // Handle successful installation from CommunityMcpCard
  const handleInstallSuccess = () => {
    // Notify parent to refresh the servers list
    onInstallSuccess();
  };

  if (!visible) return null;

  // Render loading state
  if (isCommunityLoading) {
    return (
      <div
        className="community-mcp-list"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 1px' }}
      >
        {/* Search and filter */}
        <div className="mb-4" style={{ padding: '0 4px' }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {t('settings.mcpServer.community.description')}
              </Typography.Text>
            </div>
          </div>
          <Row gutter={16} align="middle">
            <Col xs={24} sm={16} md={12}>
              <Input
                placeholder={t('settings.mcpServer.community.searchPlaceholder')}
                prefix={<SearchOutlined />}
                disabled
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Select
                style={{ width: '100%' }}
                placeholder={t('settings.mcpServer.community.filterByType')}
                disabled
                value="all"
              >
                <Select.Option value="all">
                  {t('settings.mcpServer.community.allTypes')}
                </Select.Option>
              </Select>
            </Col>
          </Row>
        </div>

        {/* Loading skeleton */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 4px' }}>
          <Row gutter={[16, 12]}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Col key={index} xs={24} sm={24} md={12} lg={12} xl={12}>
                <CommunityMcpCardSkeleton />
              </Col>
            ))}
          </Row>
        </div>
      </div>
    );
  }

  // Render error state
  if (communityError) {
    return (
      <div
        className="community-mcp-list"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 1px' }}
      >
        <div className="flex justify-between items-center mb-5" style={{ padding: '0 4px' }}>
          <h2
            style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}
            className="text-gray-900 dark:text-gray-100"
          >
            {t('settings.mcpServer.community.title')}
          </h2>
        </div>
        <div style={{ padding: '24px 4px' }}>
          <Alert
            message={t('settings.mcpServer.community.loadError')}
            description={t('settings.mcpServer.community.loadErrorDescription')}
            type="error"
            showIcon
          />
        </div>
      </div>
    );
  }

  // Render main content
  return (
    <div
      className="community-mcp-list"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 1px' }}
    >
      {/* Search and filter */}
      <div className="mb-4" style={{ padding: '0 4px' }}>
        <div className="flex justify-between items-start mb-3" />
        <Row gutter={16} align="middle">
          <Col xs={24} sm={16} md={12}>
            <Input
              placeholder={t('settings.mcpServer.community.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder={t('settings.mcpServer.community.filterByType')}
              value={selectedType}
              onChange={(value) => setSelectedType(value)}
            >
              <Select.Option value="all">
                {t('settings.mcpServer.community.allTypes')}
              </Select.Option>
              <Select.Option value="sse">
                {t('settings.mcpServer.community.types.sse')}
              </Select.Option>
              <Select.Option value="streamable">
                {t('settings.mcpServer.community.types.streamable')}
              </Select.Option>
              <Select.Option value="stdio">
                {t('settings.mcpServer.community.types.stdio')}
              </Select.Option>
            </Select>
          </Col>
        </Row>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 4px' }}>
        {filteredCommunityConfigs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('settings.mcpServer.community.noConfigurations')}
          />
        ) : (
          <Row gutter={[16, 12]}>
            {filteredCommunityConfigs.map((config) => (
              <Col key={config.name} xs={24} sm={24} md={12} lg={12} xl={12}>
                <CommunityMcpCard
                  config={config}
                  isInstalled={isServerInstalled(config)}
                  onInstall={handleInstallSuccess}
                />
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
};
