import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { ProviderIcon } from '@lobehub/icons';
import {
  Button,
  Empty,
  Switch,
  Tooltip,
  Dropdown,
  DropdownProps,
  MenuProps,
  message,
  Tag,
  Modal,
  Skeleton,
} from 'antd';

import { LuGlobe, LuPlus } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { ProviderModal } from './provider-modal';
import { ProviderStore } from './ProviderStore';
import { ContentHeader } from '@refly-packages/ai-workspace-common/components/settings/contentHeader';
import { Close, More, Delete, Edit, Market } from 'refly-icons';
import './index.scss';

const ActionDropdown = ({
  provider,
  handleEdit,
  refetch,
}: { provider: Provider; handleEdit: () => void; refetch: () => void }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await handleDelete(provider);
      setModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = useCallback(
    async (provider: Provider) => {
      try {
        const res = await getClient().deleteProvider({
          body: { providerId: provider.providerId },
        });
        if (res.data.success) {
          refetch();
          message.success(t('common.deleteSuccess'));
        }
      } catch (error) {
        console.error('Failed to delete provider', error);
      }
    },
    [refetch],
  );

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center flex-grow">
          <Edit size={18} className="mr-2" />
          {t('common.edit')}
        </div>
      ),
      key: 'edit',
      onClick: () => handleEdit(),
    },
    {
      label: (
        <div
          className="flex items-center text-red-600 flex-grow cursor-pointer"
          onClick={() => {
            setVisible(false);
            setModalVisible(true);
          }}
        >
          <Delete size={18} className="mr-2" />
          {t('common.delete')}
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setVisible(open);
    }
  };

  return (
    <>
      <Dropdown trigger={['click']} open={visible} onOpenChange={handleOpenChange} menu={{ items }}>
        <Button type="text" icon={<More size={18} />} />
      </Dropdown>
      <Modal
        title={t('common.deleteConfirmMessage')}
        centered
        width={416}
        open={modalVisible}
        onOk={handleDeleteConfirm}
        onCancel={() => setModalVisible(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ loading: isDeleting }}
        destroyOnHidden
        closeIcon={null}
        confirmLoading={isDeleting}
      >
        <div>
          <div className="mb-2">
            {t('settings.modelProviders.deleteConfirm', {
              name: provider.name || t('common.untitled'),
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};

const ProviderItem = React.memo(
  ({
    provider,
    onSettingsClick,
    onToggleEnabled,
    isSubmitting,
    refetch,
  }: {
    provider: Provider;
    onSettingsClick: (provider: Provider) => void;
    onToggleEnabled: (provider: Provider, enabled: boolean) => void;
    isSubmitting: boolean;
    refetch: () => void;
  }) => {
    const { t } = useTranslation();
    const handleToggleChange = useCallback(
      (checked: boolean) => {
        onToggleEnabled(provider, checked);
      },
      [provider, onToggleEnabled],
    );

    const handleSwitchWrapperClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    return (
      <div className="mb-5 p-2 rounded-md cursor-pointer hover:bg-refly-tertiary-hover">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 flex items-center">
            <div className="flex-shrink-0 h-10 w-10 rounded-md bg-refly-tertiary-default flex items-center justify-center mr-3">
              {provider.isGlobal ? (
                <LuGlobe size={24} className="text-refly-text-2" />
              ) : (
                <ProviderIcon provider={provider.name?.toLowerCase()} size={24} type={'color'} />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{provider.name}</div>
                <div className="px-1 h-[18px] flex items-center justify-center rounded-[4px] bg-refly-bg-control-z0 text-[10px] leading-[14px] text-refly-text-1 border-solid border-[1px] border-refly-Card-Border font-semibold">
                  {provider.providerKey.toUpperCase()}
                </div>
              </div>
              {provider.categories?.length > 0 && (
                <div className="flex items-center gap-2">
                  {provider.categories.map((category) => (
                    <Tag
                      key={category}
                      className="m-0 px-1 h-[18px] flex items-center justify-center rounded-[4px] bg-refly-bg-control-z0 text-[10px] leading-[14px] text-refly-text-1 border-solid border-[1px] border-refly-Card-Border font-semibold"
                    >
                      {category}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Tooltip
              title={
                provider.isGlobal
                  ? ''
                  : provider.enabled
                    ? t('settings.modelProviders.disable')
                    : t('settings.modelProviders.enable')
              }
            >
              <div onClick={handleSwitchWrapperClick} className="flex items-center">
                <Switch
                  size="small"
                  checked={provider.enabled ?? false}
                  onChange={handleToggleChange}
                  loading={isSubmitting}
                  disabled={provider.isGlobal}
                />
              </div>
            </Tooltip>

            {!provider.isGlobal && (
              <ActionDropdown
                provider={provider}
                handleEdit={() => onSettingsClick({ ...provider, apiKey: 'default' })}
                refetch={refetch}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

ProviderItem.displayName = 'ProviderItem';

// ProviderItem Skeleton Component
const ProviderItemSkeleton = React.memo(() => {
  return (
    <div className="mb-5 p-2 rounded-md">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1 flex items-center">
          {/* Provider Icon Skeleton */}
          <Skeleton.Avatar active size={45} shape="square" className="mr-3 flex-shrink-0" />

          <div className="flex flex-col gap-1">
            {/* Provider Name and Key Skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton.Input active size="small" style={{ width: 120, height: 18 }} />
              <Skeleton.Input active size="small" style={{ width: 28, height: 18, minWidth: 28 }} />
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton.Input
                  key={index}
                  active
                  size="small"
                  style={{ width: 28, height: 16, minWidth: 28 }}
                />
              ))}
            </div>
          </div>
        </div>

        <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
      </div>
    </div>
  );
});

ProviderItemSkeleton.displayName = 'ProviderItemSkeleton';

// My Providers Tab Component
const MyProviders: React.FC<{
  onRefetch: () => void;
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
}> = ({ onRefetch, isAddDialogOpen, setIsAddDialogOpen }) => {
  const { t } = useTranslation();
  const [editProvider, setEditProvider] = useState<Provider | null>(null);

  const { data, isLoading, refetch } = useListProviders({
    query: { isGlobal: false },
  });

  const handleSettingsClick = useCallback((provider: Provider) => {
    setEditProvider(provider);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleEnabled = useCallback(
    async (provider: Provider, enabled: boolean) => {
      setIsSubmitting(true);
      try {
        const res = await getClient().updateProvider({
          body: {
            ...provider,
            enabled,
          },
        });
        if (res.data.success) {
          refetch();
          onRefetch(); // Notify parent to refresh
        }
      } catch (error) {
        console.error('Failed to update provider status', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [refetch, onRefetch],
  );

  const filteredProviders = useMemo(() => {
    return data?.data || [];
  }, [data?.data]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Providers List */}
      <div
        className={cn(
          'flex-1 overflow-auto px-5',
          !isLoading && filteredProviders.length === 0 ? 'flex items-center justify-center' : '',
        )}
      >
        {isLoading ? (
          <div>
            {Array.from({ length: 10 }).map((_, index) => (
              <ProviderItemSkeleton key={index} />
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <Empty description={<p>{t('settings.modelProviders.noProviders')}</p>}>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              icon={<LuPlus className="flex items-center" />}
            >
              {t('settings.modelProviders.addFirstProvider')}
            </Button>
          </Empty>
        ) : (
          <div>
            <div>
              {filteredProviders?.map((provider) => (
                <ProviderItem
                  key={provider.providerId}
                  provider={provider}
                  refetch={refetch}
                  onSettingsClick={handleSettingsClick}
                  onToggleEnabled={handleToggleEnabled}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
            <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
          </div>
        )}
      </div>

      {/* Combined Modal for Create and Edit */}
      <ProviderModal
        isOpen={isAddDialogOpen || !!editProvider}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditProvider(null);
        }}
        provider={editProvider}
        onSuccess={() => {
          refetch();
          onRefetch();
        }}
      />
    </div>
  );
};

interface ModelProvidersProps {
  visible: boolean;
}

export const ModelProviders = ({ visible }: ModelProvidersProps) => {
  const { t } = useTranslation();
  const [isProviderStoreOpen, setIsProviderStoreOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  // Get installed providers for Provider Store
  const { data: providersData, refetch: refetchProviders } = useListProviders();
  const installedProviders = providersData?.data || [];

  const handleInstallSuccess = useCallback(() => {
    refetchProviders();
  }, [refetchProviders]);

  const handleRefetch = useCallback(() => {
    refetchProviders();
  }, [refetchProviders]);

  useEffect(() => {
    if (visible) {
      refetchProviders();
    }
  }, [visible, refetchProviders]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ContentHeader
        title={t('settings.tabs.providers')}
        customActions={
          <div className="flex items-center gap-3">
            <Button
              type="text"
              className="font-semibold border-solid border-[1px] border-refly-Card-Border rounded-lg"
              icon={<Market size={16} />}
              onClick={() => setIsProviderStoreOpen(true)}
            >
              {t('settings.modelProviders.providerStore')}
            </Button>

            <Button type="primary" onClick={() => setIsAddDialogOpen(true)}>
              {t('settings.modelProviders.addProvider')}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden py-6">
        <MyProviders
          onRefetch={handleRefetch}
          isAddDialogOpen={isAddDialogOpen}
          setIsAddDialogOpen={setIsAddDialogOpen}
        />
      </div>

      <Modal
        className="provider-store-modal"
        width="calc(100vw - 80px)"
        style={{ height: 'calc(var(--screen-height) - 80px)' }}
        centered
        open={isProviderStoreOpen}
        closable={false}
        footer={null}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-solid border-[1px] border-x-0 border-t-0 border-refly-Card-Border">
            <div className="text-lg font-semibold text-refly-text-0 leading-7">
              {t('settings.modelProviders.providerStore')}
            </div>
            <Button
              type="text"
              icon={<Close size={24} />}
              onClick={() => setIsProviderStoreOpen(false)}
            />
          </div>
          <ProviderStore
            visible={isProviderStoreOpen}
            installedProviders={installedProviders}
            onInstallSuccess={handleInstallSuccess}
          />
        </div>
      </Modal>
    </div>
  );
};
