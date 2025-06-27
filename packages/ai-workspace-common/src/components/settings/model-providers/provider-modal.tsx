import { useTranslation } from 'react-i18next';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Button, Input, Modal, Form, Switch, Select, Checkbox, message, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Provider, ProviderCategory } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { ProviderInfo, providerInfoList } from '@refly/utils';

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
    const [connectionTestResult, setConnectionTestResult] = useState<any>(null);

    const isEditMode = !!provider;

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

        if (isDefaultApiKey && value !== 'default') {
          form.setFieldsValue({ apiKey: '' });
          setIsDefaultApiKey(false);
        } else {
          form.setFieldsValue({ apiKey: value });
        }
      },
      [isDefaultApiKey, form],
    );

    // Test OpenAI-compatible API
    const testOpenAICompatible = useCallback(async (baseUrl: string, apiKey: string) => {
      if (!baseUrl) {
        throw new Error('请填写Base URL');
      }
      if (!apiKey) {
        throw new Error('请填写API Key');
      }

      try {
        // Test /models endpoint
        const response = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('API Key无效或已过期');
          } else if (response.status === 403) {
            throw new Error('API Key权限不足');
          } else if (response.status === 404) {
            throw new Error('API端点不存在，请检查Base URL');
          } else {
            throw new Error(`API请求失败 (${response.status}): ${response.statusText}`);
          }
        }

        const data = await response.json();
        if (!data?.data && !data?.object) {
          throw new Error('API响应格式不正确');
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error('请求超时，请检查Base URL是否正确');
        } else if (error.message.includes('CORS') || error.message.includes('blocked')) {
          throw new Error('跨域请求被阻止，可能需要在服务器端配置CORS');
        } else if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')
        ) {
          throw new Error('网络错误，请检查Base URL和网络连接');
        }
        throw error; // Re-throw if it's already a handled error
      }
    }, []);

    // Test Ollama API
    const testOllama = useCallback(async (baseUrl: string) => {
      if (!baseUrl) {
        throw new Error('请填写Base URL');
      }

      try {
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`请求失败 (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.models) {
          throw new Error('Ollama API响应格式不正确');
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error('请求超时，请检查Base URL是否正确');
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error('网络错误，请检查Base URL和网络连接');
        }
        throw error;
      }
    }, []);

    // Test Jina API
    const testJina = useCallback(async (baseUrl: string, apiKey: string) => {
      if (!apiKey) {
        throw new Error('Jina API需要API Key');
      }

      const testBaseUrl = baseUrl || 'https://api.jina.ai/v1';

      try {
        // Test with a simple embedding request
        const response = await fetch(`${testBaseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'jina-embeddings-v2-base-en',
            input: ['test'],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('API Key无效');
          } else {
            throw new Error(`请求失败 (${response.status}): ${response.statusText}`);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error('请求超时，请检查配置');
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error('网络错误，请检查Base URL和网络连接');
        }
        throw error;
      }
    }, []);

    // Direct validation function
    const testProviderDirectly = useCallback(
      async (providerKey: string, apiKey: string, baseUrl: string, category?: ProviderCategory) => {
        const testResult = {
          providerKey,
          apiKey: apiKey ? '***已提供***' : '未设置',
          baseUrl: baseUrl || '默认',
          category,
          status: 'unknown' as 'success' | 'failed' | 'unknown',
          message: '',
          details: {} as any,
          timestamp: new Date().toISOString(),
        };

        try {
          // Test based on provider type
          switch (providerKey) {
            case 'openai':
            case 'anthropic':
              await testOpenAICompatible(baseUrl, apiKey);
              break;
            case 'ollama':
              await testOllama(baseUrl);
              break;
            case 'jina':
              await testJina(baseUrl, apiKey);
              break;
            default:
              // Generic OpenAI-compatible test
              await testOpenAICompatible(baseUrl, apiKey);
          }

          testResult.status = 'success';
          testResult.message = 'API连接验证成功';
          setConnectionTestResult(testResult);
          message.success('API连接验证成功！');
        } catch (error: any) {
          testResult.status = 'failed';
          testResult.message = error.message || 'API连接验证失败';
          testResult.details = { error: error.message };
          setConnectionTestResult(testResult);
          message.error(`API连接验证失败：${error.message}`);
        }
      },
      [testOpenAICompatible, testOllama, testJina],
    );

    const handleTestConnection = useCallback(async () => {
      try {
        setIsTestingConnection(true);
        setConnectionTestResult(null);

        // Get current form values directly
        const formValues = form.getFieldsValue();
        const { providerKey, apiKey, baseUrl } = formValues;

        // Validate required fields
        if (!providerKey) {
          message.warning('请先选择Provider类型');
          return;
        }

        // Test the configuration directly without saving
        await testProviderDirectly(providerKey, apiKey, baseUrl, filterCategory);
      } catch (error: any) {
        console.error('Connection test failed:', error);
        message.error(`连接测试失败：${error?.message || '未知错误'}`);
        setConnectionTestResult({
          status: 'failed',
          message: error?.message || 'Connection test failed',
        });
      } finally {
        setIsTestingConnection(false);
      }
    }, [form, filterCategory, testProviderDirectly]);

    const renderConnectionTestResult = () => {
      if (!connectionTestResult) return null;

      const { status, message: testMessage, details } = connectionTestResult;

      const getStatusIcon = () => {
        switch (status) {
          case 'success':
            return <CheckCircleOutlined className="text-green-500" />;
          case 'failed':
            return <CloseCircleOutlined className="text-red-500" />;
          default:
            return <ExclamationCircleOutlined className="text-yellow-500" />;
        }
      };

      const getAlertType = () => {
        switch (status) {
          case 'success':
            return 'success';
          case 'failed':
            return 'error';
          default:
            return 'warning';
        }
      };

      return (
        <Alert
          type={getAlertType()}
          icon={getStatusIcon()}
          message={
            <div>
              <div className="font-medium">
                {status === 'success'
                  ? t('settings.modelProviders.connectionTestSuccess')
                  : t('settings.modelProviders.connectionTestFailed')}
              </div>
              {testMessage && <div className="text-sm opacity-80 mt-1">{testMessage}</div>}
            </div>
          }
          description={
            details && (
              <div className="mt-2">
                <details className="text-xs">
                  <summary className="cursor-pointer hover:text-blue-600">
                    {t('settings.modelProviders.viewDetails')}
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </details>
              </div>
            )
          }
          className="mb-4"
        />
      );
    };

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
        }
      } catch (err) {
        console.error('Failed to submit provider:', err);
      } finally {
        setIsSubmitting(false);
      }
    }, [form, isEditMode, provider, onSuccess, onClose, t]);

    return (
      <Modal
        title={
          isEditMode
            ? t('settings.modelProviders.editProvider')
            : t('settings.modelProviders.addProvider')
        }
        open={isOpen}
        onCancel={onClose}
        width={600}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="test"
            type="default"
            loading={isTestingConnection}
            onClick={handleTestConnection}
            icon={isTestingConnection ? <SyncOutlined spin /> : undefined}
          >
            {isTestingConnection ? '测试中...' : '测试连接'}
          </Button>,
          <Button key="submit" type="primary" loading={isSubmitting} onClick={handleSubmit}>
            {isEditMode ? t('common.save') : t('common.create')}
          </Button>,
        ]}
      >
        {renderConnectionTestResult()}

        <Form form={form} layout="vertical" className="space-y-4">
          <Form.Item
            label={t('settings.modelProviders.form.providerType')}
            name="providerKey"
            rules={[
              { required: true, message: t('settings.modelProviders.form.providerTypeRequired') },
            ]}
          >
            <Select
              placeholder={t('settings.modelProviders.form.selectProviderType')}
              options={providerOptions}
              onChange={handleProviderChange}
              disabled={isEditMode}
            />
          </Form.Item>

          <Form.Item
            label={t('settings.modelProviders.form.name')}
            name="name"
            rules={[{ required: true, message: t('settings.modelProviders.form.nameRequired') }]}
          >
            <Input placeholder={t('settings.modelProviders.form.namePlaceholder')} />
          </Form.Item>

          {showApiKey && (
            <Form.Item
              label={t('settings.modelProviders.form.apiKey')}
              name="apiKey"
              rules={
                apiKeyRequired
                  ? [{ required: true, message: t('settings.modelProviders.form.apiKeyRequired') }]
                  : []
              }
            >
              <Input.Password
                placeholder={t('settings.modelProviders.form.apiKeyPlaceholder')}
                onChange={handleApiKeyChange}
              />
            </Form.Item>
          )}

          {showBaseUrl && (
            <Form.Item
              label={t('settings.modelProviders.form.baseUrl')}
              name="baseUrl"
              rules={
                baseUrlRequired
                  ? [{ required: true, message: t('settings.modelProviders.form.baseUrlRequired') }]
                  : []
              }
            >
              <Input
                placeholder={
                  selectedProviderInfo?.fieldConfig.baseUrl.placeholder ||
                  t('settings.modelProviders.form.baseUrlPlaceholder')
                }
              />
            </Form.Item>
          )}

          <Form.Item
            label={t('settings.modelProviders.form.categories')}
            name="categories"
            rules={[
              { required: true, message: t('settings.modelProviders.form.categoriesRequired') },
            ]}
          >
            <Checkbox.Group options={categoryOptions} />
          </Form.Item>

          {!disabledEnableControl && (
            <Form.Item name="enabled" valuePropName="checked">
              <Switch />
              <span className="ml-2">{t('settings.modelProviders.form.enabled')}</span>
            </Form.Item>
          )}
        </Form>
      </Modal>
    );
  },
);

ProviderModal.displayName = 'ProviderModal';
