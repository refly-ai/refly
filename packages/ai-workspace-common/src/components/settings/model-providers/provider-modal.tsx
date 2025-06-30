import { useTranslation } from 'react-i18next';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Button,
  Input,
  Modal,
  Form,
  Switch,
  Select,
  Checkbox,
  message,
  Alert,
  Tooltip,
} from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Provider, ProviderCategory } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { ProviderInfo, providerInfoList } from '@refly/utils';
import { useTestProviderConnection } from '@refly-packages/ai-workspace-common/queries';

export const ProviderModal = React.memo(
  ({
    isOpen,
    onClose,
    provider,
    filterCategory,
    presetProviders,
    defaultProviderKey,
    onSuccess,
    disabledEnableControl = false,
  }: {
    isOpen: boolean;
    onClose: () => void;
    provider?: Provider | null;
    filterCategory?: ProviderCategory;
    presetProviders?: ProviderInfo[];
    defaultProviderKey?: string;
    onSuccess?: (provider: Provider) => void;
    disabledEnableControl?: boolean;
  }) => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form] = Form.useForm();
    const [isDefaultApiKey, setIsDefaultApiKey] = useState(false);
    const [selectedProviderKey, setSelectedProviderKey] = useState<string | undefined>(
      provider?.providerKey || defaultProviderKey,
    );
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const isEditMode = !!provider;

    // Use React Query hook for provider connection testing
    const testProviderMutation = useTestProviderConnection();

    // Convert provider info list to options for the select component
    const providerOptions = useMemo(
      () =>
        (presetProviders || providerInfoList).map((providerInfo) => ({
          label: providerInfo.name,
          value: providerInfo.key,
        })),
      [presetProviders],
    );

    // Find the selected provider info
    const selectedProviderInfo = useMemo(() => {
      const providers = presetProviders || providerInfoList;
      return providers.find((p) => p.key === selectedProviderKey);
    }, [selectedProviderKey, presetProviders]);

    // Get available categories for the selected provider
    const categories = useMemo(() => {
      if (filterCategory) {
        return [filterCategory];
      }
      return selectedProviderInfo?.categories || [];
    }, [filterCategory, selectedProviderInfo]);

    // Create checkbox options from categories
    const categoryOptions = useMemo(() => {
      return categories.map((category) => ({
        label: t(`settings.modelProviders.categories.${category}`),
        value: category,
      }));
    }, [categories, t]);

    // Determine if apiKey and baseUrl should be shown and required
    const showApiKey = useMemo(() => {
      return selectedProviderInfo?.fieldConfig.apiKey.presence !== 'omit';
    }, [selectedProviderInfo]);

    const apiKeyRequired = useMemo(() => {
      return selectedProviderInfo?.fieldConfig.apiKey.presence === 'required';
    }, [selectedProviderInfo]);

    const showBaseUrl = useMemo(() => {
      return selectedProviderInfo?.fieldConfig.baseUrl.presence !== 'omit';
    }, [selectedProviderInfo]);

    const baseUrlRequired = useMemo(() => {
      return selectedProviderInfo?.fieldConfig.baseUrl.presence === 'required';
    }, [selectedProviderInfo]);

    // Handle provider type change
    const handleProviderChange = useCallback(
      (value: string) => {
        setSelectedProviderKey(value);
        const providers = presetProviders || providerInfoList;
        const providerInfo = providers.find((p) => p.key === value);

        // Clear test result when provider changes
        setTestResult(null);

        // Reset form fields except for providerKey and enabled
        const enabled = form.getFieldValue('enabled');
        form.resetFields();
        form.setFieldsValue({
          providerKey: value,
          enabled: enabled ?? true,
        });

        // Set baseUrl to default value if available, otherwise clear it
        if (providerInfo?.fieldConfig.baseUrl.defaultValue) {
          form.setFieldValue('baseUrl', providerInfo.fieldConfig.baseUrl.defaultValue);
        } else {
          form.setFieldValue('baseUrl', '');
        }

        // Reset API key field
        form.setFieldValue('apiKey', '');
        setIsDefaultApiKey(false);

        // Set all available categories as default
        const providerCategories = providerInfo?.categories || [];
        if (providerCategories.length > 0) {
          form.setFieldValue('categories', providerCategories);
        } else {
          form.setFieldValue('categories', []);
        }
      },
      [form, presetProviders],
    );

    const handleBaseUrlChange = useCallback(() => {
      // Clear test result when base URL changes
      setTestResult(null);
    }, []);

    useEffect(() => {
      if (isOpen) {
        if (provider) {
          const apiKeyValue = provider.apiKey;
          setIsDefaultApiKey(!!apiKeyValue);
          setSelectedProviderKey(provider.providerKey);

          form.setFieldsValue({
            name: provider.name,
            apiKey: apiKeyValue,
            baseUrl: provider.baseUrl || '',
            enabled: provider.enabled,
            providerKey: provider.providerKey,
            categories: provider.categories || [],
          });
        } else {
          setIsDefaultApiKey(false);
          const initialProviderKey = defaultProviderKey || providerOptions[0]?.value;
          setSelectedProviderKey(initialProviderKey);

          form.resetFields();
          form.setFieldsValue({
            enabled: true,
            providerKey: initialProviderKey,
          });

          // Set default baseUrl if available
          const providers = presetProviders || providerInfoList;
          const providerInfo = providers.find((p) => p.key === initialProviderKey);
          if (providerInfo?.fieldConfig.baseUrl.defaultValue) {
            form.setFieldValue('baseUrl', providerInfo.fieldConfig.baseUrl.defaultValue);
          }

          // Select all categories by default
          const providerCategories = providerInfo?.categories || [];
          if (providerCategories.length > 0) {
            form.setFieldValue('categories', providerCategories);
          }
        }
      }
    }, [provider, isOpen, form, providerOptions, defaultProviderKey, presetProviders]);

    const handleApiKeyChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Clear test result when API key changes
        setTestResult(null);

        if (isDefaultApiKey && value !== 'default') {
          form.setFieldsValue({ apiKey: '' });
          setIsDefaultApiKey(false);
        } else {
          form.setFieldsValue({ apiKey: value });
        }
      },
      [isDefaultApiKey, form],
    );

    // Simple test connection function - Step 3: React Query integration
    const handleTestConnection = useCallback(async () => {
      try {
        setIsTestingConnection(true);
        setTestResult(null);

        // Basic form validation
        const formValues = form.getFieldsValue();
        const { name, providerKey, apiKey, baseUrl } = formValues;

        // Validate required fields
        if (!name?.trim()) {
          throw new Error('请填写供应商名称');
        }
        if (!providerKey) {
          throw new Error('请选择供应商类型');
        }

        // Provider-specific validation
        if (selectedProviderInfo) {
          if (selectedProviderInfo.fieldConfig.apiKey.presence === 'required' && !apiKey?.trim()) {
            throw new Error('请填写API Key');
          }
          if (
            selectedProviderInfo.fieldConfig.baseUrl.presence === 'required' &&
            !baseUrl?.trim()
          ) {
            throw new Error('请填写Base URL');
          }
        }

        // For edit mode, test existing provider directly
        if (isEditMode && provider) {
          console.log('Testing existing provider:', provider.providerId);

          const testResult = await testProviderMutation.mutateAsync({
            body: {
              providerId: provider.providerId,
            },
          });

          if (testResult.data?.success) {
            setTestResult({
              status: 'success',
              message: 'API连接测试成功',
              details: testResult.data,
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new Error('连接测试失败');
          }
        } else {
          // For new providers, create temporary provider for testing
          console.log('Creating temporary provider for testing');

          const createRes = await getClient().createProvider({
            body: {
              name: `temp_test_${Date.now()}`,
              enabled: false,
              apiKey: apiKey || undefined,
              baseUrl: baseUrl || undefined,
              providerKey,
              categories: ['llm'], // Default category for testing
            },
          });

          if (!createRes.data?.success) {
            throw new Error('创建临时供应商失败');
          }

          const tempProvider = createRes.data.data;
          try {
            console.log('Testing temporary provider:', tempProvider.providerId);

            const testResult = await testProviderMutation.mutateAsync({
              body: {
                providerId: tempProvider.providerId,
              },
            });

            if (testResult.data?.success) {
              setTestResult({
                status: 'success',
                message: 'API连接测试成功',
                details: testResult.data,
                timestamp: new Date().toISOString(),
              });
            } else {
              throw new Error('连接测试失败');
            }
          } finally {
            // Clean up: delete the temporary provider
            await getClient().deleteProvider({
              body: { providerId: tempProvider.providerId },
            });
          }
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);
        setTestResult({
          status: 'failed',
          message: error.message || 'API连接失败',
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsTestingConnection(false);
      }
    }, [form, selectedProviderInfo, isEditMode, provider, testProviderMutation]);

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
              providerKey: values.providerKey,
              categories: values.categories,
            },
          });
          if (res.data.success) {
            message.success(t('common.saveSuccess'));
            onSuccess?.(res.data.data);
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
              providerKey: values.providerKey,
              categories: values.categories,
            },
          });
          if (res.data.success) {
            message.success(t('common.addSuccess'));
            onSuccess?.(res.data.data);
            form.resetFields();
            onClose();
          }
        }
      } catch (error) {
        console.error(`Failed to ${isEditMode ? 'update' : 'create'} provider`, error);
      } finally {
        setIsSubmitting(false);
      }
    }, [form, onClose, onSuccess, provider, isEditMode, t]);

    const modalTitle = isEditMode
      ? t('settings.modelProviders.editProvider')
      : t('settings.modelProviders.addProvider');

    const submitButtonText = isEditMode ? t('common.save') : t('common.add');

    return (
      <Modal
        centered
        title={modalTitle}
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Tooltip
            title={!selectedProviderInfo ? t('settings.modelProviders.selectProviderFirst') : ''}
            key="test"
          >
            <Button
              icon={isTestingConnection ? <SyncOutlined spin /> : undefined}
              onClick={handleTestConnection}
              disabled={!selectedProviderInfo || isTestingConnection}
              loading={isTestingConnection}
            >
              {isTestingConnection
                ? t('settings.modelProviders.testing')
                : t('settings.modelProviders.testConnection')}
            </Button>
          </Tooltip>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSubmitting}>
            {submitButtonText}
          </Button>,
        ]}
      >
        <Form form={form} className="mt-6" labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
          <Form.Item
            name="providerKey"
            label={t('settings.modelProviders.providerType')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.selectProviderType'),
              },
            ]}
          >
            <Select
              placeholder={t('settings.modelProviders.selectProviderType')}
              options={providerOptions}
              onChange={handleProviderChange}
            />
          </Form.Item>
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
          {categories.length > 0 && (
            <Form.Item
              name="categories"
              label={t('settings.modelProviders.category')}
              rules={[
                {
                  required: true,
                  message: t('settings.modelProviders.categoryPlaceholder'),
                },
              ]}
            >
              <Checkbox.Group options={categoryOptions} className="w-full" />
            </Form.Item>
          )}
          {showApiKey && (
            <Form.Item
              name="apiKey"
              label={t('settings.modelProviders.apiKey')}
              rules={[
                {
                  required: apiKeyRequired,
                  message: t('settings.modelProviders.apiKeyPlaceholder'),
                },
              ]}
            >
              <Input.Password
                placeholder={t('settings.modelProviders.apiKeyPlaceholder')}
                onChange={handleApiKeyChange}
                visibilityToggle={!isDefaultApiKey}
                className={isDefaultApiKey ? 'default-api-key' : ''}
                autoComplete="new-password"
              />
            </Form.Item>
          )}
          {showBaseUrl && (
            <Form.Item
              name="baseUrl"
              label={t('settings.modelProviders.baseUrl')}
              rules={[
                {
                  required: baseUrlRequired,
                  message: t('settings.modelProviders.baseUrlPlaceholder'),
                },
              ]}
            >
              <Input
                placeholder={t('settings.modelProviders.baseUrlPlaceholder')}
                onChange={handleBaseUrlChange}
              />
            </Form.Item>
          )}
          <Form.Item
            name="enabled"
            label={t('settings.modelProviders.enabled')}
            valuePropName="checked"
          >
            <Switch disabled={disabledEnableControl} />
          </Form.Item>
        </Form>

        {/* Connection test result placeholder */}
        {testResult && (
          <Alert
            type={testResult.status === 'success' ? 'success' : 'error'}
            icon={
              testResult.status === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />
            }
            message={
              <div className="flex items-center justify-between">
                <span>{testResult.message}</span>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setTestResult(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            }
            description={
              <div className="text-sm text-gray-600">
                测试时间: {new Date(testResult.timestamp).toLocaleString()}
              </div>
            }
            className="mb-4"
          />
        )}
      </Modal>
    );
  },
);

ProviderModal.displayName = 'ProviderModal';
