import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  Button,
  Input,
  Modal,
  Empty,
  Form,
  Switch,
  Tooltip,
  Dropdown,
  DropdownProps,
  Popconfirm,
  MenuProps,
  Typography,
  message,
} from 'antd';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import {
  IconDelete,
  IconEdit,
  IconMoreHorizontal,
} from '@refly-packages/ai-workspace-common/components/common/icon';
const { Title } = Typography;
const ActionDropdown = ({
  provider,
  handleEdit,
  refetch,
}: { provider: Provider; handleEdit: () => void; refetch: () => void }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

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
          <IconEdit size={16} className="mr-2" />
          {t('common.edit')}
        </div>
      ),
      key: 'edit',
      onClick: () => handleEdit(),
    },
    {
      label: (
        <Popconfirm
          placement="bottomLeft"
          title={t('settings.modelProviders.deleteConfirm', {
            name: provider.name || t('common.untitled'),
          })}
          onConfirm={() => handleDelete(provider)}
          onCancel={() => setVisible(false)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div className="flex items-center text-red-600 flex-grow">
            <IconDelete size={16} className="mr-2" />
            {t('common.delete')}
          </div>
        </Popconfirm>
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
    <Dropdown trigger={['click']} open={visible} onOpenChange={handleOpenChange} menu={{ items }}>
      <Button type="text" icon={<IconMoreHorizontal />} />
    </Dropdown>
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
      <div className="mb-3 p-4 hover:bg-gray-50 rounded-md cursor-pointer border border-solid border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 flex items-center">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
              {provider.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{provider.name}</div>
              <div className="text-sm text-gray-500">{provider.providerKey}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionDropdown
              provider={provider}
              handleEdit={() => onSettingsClick(provider)}
              refetch={refetch}
            />

            <Tooltip
              title={
                provider.enabled
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
                />
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  },
);

const ProviderModal = React.memo(
  ({
    isOpen,
    onClose,
    provider,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    provider?: Provider | null;
    onSuccess?: () => void;
  }) => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form] = Form.useForm();

    const isEditMode = !!provider;

    useEffect(() => {
      if (isOpen) {
        if (provider) {
          form.setFieldsValue({
            name: provider.name,
            apiKey: provider.apiKey,
            baseUrl: provider.baseUrl || '',
            enabled: provider.enabled,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            enabled: true,
          });
        }
      }
    }, [provider, isOpen, form]);

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        setIsSubmitting(true);

        if (isEditMode && provider) {
          const res = await getClient().updateProvider({
            body: {
              ...provider,
              name: values.name,
              enabled: values.enabled,
              apiKey: values.apiKey,
              baseUrl: values.baseUrl || undefined,
            },
          });
          if (res.data.success) {
            message.success(t('common.saveSuccess'));
            onSuccess?.();
            form.resetFields();
            onClose();
          }
        } else {
          const res = await getClient().createProvider({
            body: {
              name: values.name,
              enabled: values.enabled,
              apiKey: values.apiKey,
              baseUrl: values.baseUrl,
              providerKey: 'openai',
            },
          });
          if (res.data.success) {
            message.success(t('common.addSuccess'));
            onSuccess?.();
            form.resetFields();
            onClose();
          }
        }
      } catch (error) {
        console.error(`Failed to ${isEditMode ? 'update' : 'create'} provider`, error);
      } finally {
        setIsSubmitting(false);
      }
    }, [form, onClose, onSuccess, provider, isEditMode]);

    const modalTitle = isEditMode
      ? t('settings.modelProviders.editProvider')
      : t('settings.modelProviders.addProvider');

    const submitButtonText = isEditMode ? t('common.save') : t('common.add');

    return (
      <Modal
        title={modalTitle}
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSubmitting}>
            {submitButtonText}
          </Button>,
        ]}
      >
        <Form form={form} className="mt-6">
          <Form.Item
            name="name"
            label={t('settings.modelProviders.name')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.namePlaceholder'),
              },
            ]}
          >
            <Input placeholder={t('settings.modelProviders.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label={t('settings.modelProviders.apiKey')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.apiKeyPlaceholder'),
              },
            ]}
          >
            <Input placeholder={t('settings.modelProviders.apiKeyPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label={t('settings.modelProviders.baseUrl')}
            rules={[{ required: true, message: t('settings.modelProviders.baseUrlPlaceholder') }]}
          >
            <Input placeholder={t('settings.modelProviders.baseUrlPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="enabled"
            label={t('settings.modelProviders.enableSetting')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

export const ModelProviders = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);

  const { data, isLoading, refetch } = useListProviders();

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
        }
      } catch (error) {
        console.error('Failed to update provider status', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [refetch],
  );

  const filteredProviders = useMemo(() => {
    if (!data?.data) return [];

    if (!searchQuery.trim()) return data.data;

    const lowerQuery = searchQuery.toLowerCase();
    return data.data.filter(
      (provider) =>
        provider.name?.toLowerCase().includes(lowerQuery) ||
        provider.providerKey?.toLowerCase().includes(lowerQuery),
    );
  }, [data?.data, searchQuery]);

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.tabs.modelProviders')}
      </Title>
      {/* Search and Add Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-xs">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder={t('settings.modelProviders.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button
          type="primary"
          icon={<LuPlus className="h-5 w-5 flex items-center" />}
          onClick={() => setIsAddDialogOpen(true)}
        >
          {t('settings.modelProviders.addProvider')}
        </Button>
      </div>

      {/* Providers List */}
      <div
        className={cn(
          'flex-1 overflow-auto',
          isLoading || filteredProviders.length === 0 ? 'flex items-center justify-center' : '',
          filteredProviders.length === 0 ? 'border-dashed border-gray-200 rounded-md' : '',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin />
          </div>
        ) : filteredProviders.length === 0 ? (
          <Empty
            description={
              searchQuery ? (
                <>
                  <p>{t('settings.modelProviders.noSearchResults')}</p>
                  <p className="text-sm text-gray-400">
                    {t('settings.modelProviders.tryDifferentSearch')}
                  </p>
                </>
              ) : (
                <p>{t('settings.modelProviders.noProviders')}</p>
              )
            }
          >
            {!searchQuery && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                icon={<LuPlus className="flex items-center" />}
              >
                {t('settings.modelProviders.addFirstProvider')}
              </Button>
            )}
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
            <div className="text-center text-gray-400 text-sm mt-4">{t('common.noMore')}</div>
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
        onSuccess={refetch}
      />
    </div>
  );
};
