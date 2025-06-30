import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Empty, Row, Col, Typography, Tag, message } from 'antd';
import { LuSearch } from 'react-icons/lu';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useTranslation } from 'react-i18next';

import { useListCommunityProviders } from '@refly-packages/ai-workspace-common/queries/provider-community';
import {
  CommunityProviderListProps,
  CommunityProviderFilterState,
  CommunityProviderResponse,
  CommunityProviderConfig,
} from './provider-store-types';
import { CommunityProviderCard } from './CommunityProviderCard';
import { filterProviders, sortProviders, isProviderInstalled } from './provider-store-utils';

const { Text } = Typography;

export const ProviderStore: React.FC<CommunityProviderListProps> = ({
  visible,
  installedProviders,
  onInstallSuccess,
}) => {
  const { t } = useTranslation();

  // Fetch community providers
  const { data: communityData, isLoading, error, refetch } = useListCommunityProviders();

  // Filter state
  const [filters, setFilters] = useState<CommunityProviderFilterState>({
    searchText: '',
    selectedCategory: 'all',
    selectedPricing: 'all',
    selectedTags: [],
  });

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    const data = communityData as CommunityProviderResponse | undefined;
    if (!data?.providers) return [];
    const filtered = filterProviders(data.providers, filters);
    return sortProviders(filtered);
  }, [communityData, filters]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: Partial<CommunityProviderFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handle install success
  const handleInstallSuccess = useCallback(
    (config: CommunityProviderConfig) => {
      message.success({
        content: t('settings.modelProviders.community.installSuccess', { name: config.name }),
        duration: 3,
      });

      onInstallSuccess();
      refetch(); // Refresh community providers to update install status
    },
    [onInstallSuccess, refetch, t],
  );

  // Refetch when visible
  useEffect(() => {
    if (visible) {
      refetch();
    }
  }, [visible, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty description={t('settings.mcpServer.community.loadError')}>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {t('common.retry')}
          </button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Search and filters */}
      <div className="mb-8 space-y-5">
        {/* Search bar */}
        <div className="relative flex-1 max-w-xs">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder={t('settings.modelProviders.searchPlaceholder')}
            value={filters.searchText}
            onChange={(e) => handleFiltersChange({ searchText: e.target.value })}
            className="transition-all duration-200 focus:shadow-md"
          />
        </div>

        {/* Active filters display */}
        {(filters.searchText ||
          filters.selectedCategory !== 'all' ||
          filters.selectedPricing !== 'all' ||
          filters.selectedTags.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Text type="secondary" className="text-sm">
              {t('settings.mcpServer.community.filterByType')}:
            </Text>
            {filters.searchText && (
              <Tag closable onClose={() => handleFiltersChange({ searchText: '' })}>
                {t('common.search')}: {filters.searchText}
              </Tag>
            )}
            {filters.selectedCategory !== 'all' && (
              <Tag closable onClose={() => handleFiltersChange({ selectedCategory: 'all' })}>
                {t('settings.modelProviders.category')}: {filters.selectedCategory}
              </Tag>
            )}
            {filters.selectedPricing !== 'all' && (
              <Tag closable onClose={() => handleFiltersChange({ selectedPricing: 'all' })}>
                {t('settings.subscription.currentPlan')}: {filters.selectedPricing}
              </Tag>
            )}
            {filters.selectedTags.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={() =>
                  handleFiltersChange({
                    selectedTags: filters.selectedTags.filter((t) => t !== tag),
                  })
                }
              >
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {filteredProviders.length === 0 ? (
          <Empty
            description={
              filters.searchText ||
              filters.selectedCategory !== 'all' ||
              filters.selectedPricing !== 'all' ||
              filters.selectedTags.length > 0
                ? t('settings.mcpServer.community.noConfigurations')
                : t('settings.mcpServer.community.noConfigurations')
            }
          />
        ) : (
          <>
            {/* Provider cards grid - maximum 2 per row */}
            <Row gutter={[24, 24]}>
              {filteredProviders.map((provider) => {
                const isInstalled = isProviderInstalled(provider, installedProviders);

                return (
                  <Col key={provider.providerId} xs={24} sm={24} md={12}>
                    <CommunityProviderCard
                      config={provider}
                      isInstalled={isInstalled}
                      onInstallSuccess={handleInstallSuccess}
                    />
                  </Col>
                );
              })}
            </Row>
          </>
        )}
      </div>
    </div>
  );
};

ProviderStore.displayName = 'ProviderStore';
