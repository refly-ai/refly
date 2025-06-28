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
    const [testResult, setTestResult] = useState<any>(null);

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

    // Simple API connection test using form values
    const testConnection = useCallback(async () => {
      console.log('=== NEW testConnection method called ===');
      setIsTestingConnection(true);
      setTestResult({ status: 'unknown', message: '', details: {}, timestamp: '' });

      try {
        // Get current form values directly
        const formValues = form.getFieldsValue();
        const { apiKey, baseUrl, providerKey } = formValues;

        // Check required fields based on provider type
        if (providerKey === 'jina') {
          if (!apiKey) {
            throw new Error('请填写API Key');
          }
        } else if (providerKey === 'searxng') {
          if (!baseUrl) {
            throw new Error('请填写Base URL');
          }
        } else if (providerKey === 'ollama') {
          if (!baseUrl) {
            throw new Error('请填写Base URL');
          }
        } else {
          // For OpenAI, Anthropic and other providers
          if (!baseUrl) {
            throw new Error('请填写Base URL');
          }
          if (!apiKey) {
            throw new Error('请填写API Key');
          }
        }

        // Configure test parameters based on provider type
        let testUrl: string;
        let testBody: any;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add API key if provided (most APIs need it)
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        // Configure request based on provider type
        switch (providerKey) {
          case 'openai':
            testUrl = baseUrl.endsWith('/')
              ? `${baseUrl}chat/completions`
              : `${baseUrl}/chat/completions`;
            testBody = {
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 1,
              temperature: 0,
            };
            break;

          case 'anthropic':
            testUrl = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;
            headers['anthropic-version'] = '2023-06-01';
            testBody = {
              model: 'claude-3-haiku-20240307',
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 1,
            };
            break;

          case 'ollama':
            testUrl = baseUrl.endsWith('/') ? `${baseUrl}api/generate` : `${baseUrl}/api/generate`;
            // Ollama doesn't need Authorization header
            headers.Authorization = undefined;
            testBody = {
              model: 'llama2', // Default model for testing
              prompt: 'Hello',
              stream: false,
              options: {
                num_predict: 1,
              },
            };
            break;

          case 'jina':
            // Jina uses official API endpoint, ignore user's baseUrl
            testUrl = 'https://api.jina.ai/v1/embeddings';
            testBody = {
              model: 'jina-embeddings-v2-base-en',
              input: ['Hello'],
              encoding_format: 'float',
            };
            break;

          case 'searxng':
            testUrl = baseUrl.endsWith('/') ? `${baseUrl}search` : `${baseUrl}/search`;
            // SearXNG doesn't need Authorization header
            headers.Authorization = undefined;
            testBody = {
              q: 'test',
              format: 'json',
              engines: 'google',
            };
            break;

          default:
            // Generic OpenAI-compatible API
            testUrl = baseUrl.endsWith('/')
              ? `${baseUrl}chat/completions`
              : `${baseUrl}/chat/completions`;
            testBody = {
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 1,
              temperature: 0,
            };
        }

        const response = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(testBody),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        // Check if API is reachable
        if (response.ok) {
          const data = await response.json();
          setTestResult({
            status: 'success',
            message: 'API连接成功',
            details: {
              config: { baseUrl, hasApiKey: !!apiKey, providerKey },
              response: data,
            },
            timestamp: new Date().toISOString(),
          });
        } else if (response.status === 401) {
          throw new Error('API Key无效或已过期');
        } else if (response.status === 403) {
          throw new Error('API Key权限不足');
        } else if (response.status === 404) {
          throw new Error('API端点不存在，请检查Base URL');
        } else {
          throw new Error(`API请求失败 (${response.status}): ${response.statusText}`);
        }
      } catch (error: any) {
        let errorMessage = 'API连接失败';

        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = '请求超时，请检查Base URL是否正确';
        } else if (error.message.includes('CORS') || error.message.includes('blocked')) {
          errorMessage = '跨域请求被阻止，可能需要在服务器端配置CORS';
        } else if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')
        ) {
          errorMessage = '网络错误，请检查Base URL和网络连接';
        } else {
          errorMessage = error.message || 'API连接失败';
        }

        setTestResult({
          status: 'failed',
          message: errorMessage,
          details: { error: error.message },
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsTestingConnection(false);
      }
    }, []);

    const renderConnectionTestResult = () => {
      if (!testResult) return null;

      const { status, message: testMessage, details } = testResult;

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
              onClick={testConnection}
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
              <Input placeholder={t('settings.modelProviders.baseUrlPlaceholder')} />
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

        {/* Connection test result */}
        {renderConnectionTestResult()}
      </Modal>
    );
  },
);

ProviderModal.displayName = 'ProviderModal';
