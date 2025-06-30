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

    // Handle API key change to manage default API key state
    const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value && value.trim() !== '') {
        setIsDefaultApiKey(false);
      }
    }, []);

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

    // Use React Query hook to test provider connection
    const testConnection = useCallback(async () => {
      console.log('=== Testing connection via React Query hook ===');
      setIsTestingConnection(true);
      setTestResult({ status: 'unknown', message: '', details: {}, timestamp: '' });

      try {
        const formValues = form.getFieldsValue();
        const { apiKey, baseUrl, providerKey, name } = formValues;

        // For new providers, create a temporary provider to test
        if (!isEditMode) {
          // Validate required fields first
          if (!name) {
            throw new Error('请填写供应商名称');
          }
          if (!providerKey) {
            throw new Error('请选择供应商类型');
          }

          // Check provider-specific required fields
          if (['jina', 'serper'].includes(providerKey)) {
            if (!apiKey) {
              throw new Error('请填写API Key');
            }
          } else if (['searxng', 'ollama'].includes(providerKey)) {
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

          // Create temporary provider for testing
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

          if (!createRes.data.success) {
            throw new Error('创建临时供应商失败');
          }

          const tempProvider = createRes.data.data;
          try {
            // Test the connection using React Query hook
            const testResult = await testProviderMutation.mutateAsync({
              body: {
                providerId: tempProvider.providerId,
              },
            });

            if (testResult.data.success) {
              // Analyze the detailed test results to determine overall status
              const data = testResult.data;

              const hasFailures =
                data.details && typeof data.details === 'object'
                  ? Object.values(data.details).some(
                      (test: any) =>
                        test &&
                        typeof test === 'object' &&
                        (test.status === 'failed' ||
                          (test.data?.statusCode &&
                            (test.data.statusCode >= 400 || test.data.statusCode === 401))),
                    )
                  : false;

              console.log('❌ 检测到失败:', hasFailures);

              const overallStatus = hasFailures ? 'failed' : 'success';
              const overallMessage = hasFailures
                ? 'API连接测试部分失败，请检查配置'
                : 'API连接成功';

              const finalTestResult = {
                status: overallStatus,
                message: overallMessage,
                details: data,
                timestamp: new Date().toISOString(),
              };

              console.log('📋 最终设置的testResult:', finalTestResult);
              setTestResult(finalTestResult);
            } else {
              throw new Error(testResult.message || '连接测试失败');
            }
          } finally {
            // Clean up: delete the temporary provider
            await getClient().deleteProvider({
              body: { providerId: tempProvider.providerId },
            });
          }
        } else {
          // For edit mode, test existing provider
          if (!provider) {
            throw new Error('供应商信息不存在');
          }

          const testResult = await testProviderMutation.mutateAsync({
            body: {
              providerId: provider.providerId,
            },
          });

          if (testResult.data.success) {
            // Analyze the detailed test results to determine overall status
            const data = testResult.data;

            const hasFailures =
              data.details && typeof data.details === 'object'
                ? Object.values(data.details).some(
                    (test: any) =>
                      test &&
                      typeof test === 'object' &&
                      (test.status === 'failed' ||
                        (test.data?.statusCode &&
                          (test.data.statusCode >= 400 || test.data.statusCode === 401))),
                  )
                : false;

            const overallStatus = hasFailures ? 'failed' : 'success';
            const overallMessage = hasFailures ? 'API连接测试部分失败，请检查配置' : 'API连接成功';

            const finalTestResult = {
              status: overallStatus,
              message: overallMessage,
              details: data,
              timestamp: new Date().toISOString(),
            };

            setTestResult(finalTestResult);
          } else {
            throw new Error(testResult.message || '连接测试失败');
          }
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);

        setTestResult({
          status: 'failed',
          message: error.message || 'API连接失败',
          details: { error: error.message },
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsTestingConnection(false);
      }
    }, [form, isEditMode, provider, testProviderMutation]);

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

      // Render detailed test results in a user-friendly format
      const renderDetailedResults = () => {
        if (!details || typeof details !== 'object') {
          return null;
        }

        // 实际的测试详情在 details.details 中
        const actualTestDetails = details.details || {};

        if (!actualTestDetails || typeof actualTestDetails !== 'object') {
          return null;
        }

        const testItems = [];

        // Map of test keys to display names
        const testDisplayNames: Record<string, string> = {
          apiKey: 'API Key验证',
          embeddings: '嵌入模型API',
          reranker: '重排序API',
          chat: '对话API',
          chatCompletion: '对话完成API',
          models: '模型列表API',
          modelsEndpoint: '模型端点API',
          health: '健康检查',
          search: '搜索功能',
          tags: 'Tags端点',
        };

        for (const [key, value] of Object.entries(actualTestDetails)) {
          if (value && typeof value === 'object' && 'status' in value) {
            const testItem = value as { status: string; data?: any; error?: any };
            const displayName = testDisplayNames[key] || key;

            testItems.push(
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm">{displayName}</span>
                <div className="flex items-center gap-1">
                  {testItem.status === 'success' &&
                  (!testItem.data?.statusCode || testItem.data.statusCode < 400) ? (
                    <>
                      <CheckCircleOutlined className="text-green-500 text-xs" />
                      <span className="text-xs text-green-600">成功</span>
                      {testItem.data?.statusCode && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({testItem.data.statusCode})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <CloseCircleOutlined className="text-red-500 text-xs" />
                      <span className="text-xs text-red-600">失败</span>
                      {(testItem.error || testItem.data?.statusCode >= 400) && (
                        <span className="text-xs text-red-500 ml-1">
                          ({testItem.error || `HTTP ${testItem.data?.statusCode}`})
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>,
            );
          }
        }

        return testItems.length > 0 ? (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <div className="text-sm font-medium text-gray-700 mb-2">测试详情</div>
            <div className="space-y-1">{testItems}</div>
          </div>
        ) : null;
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
            <div className="mt-2">
              {/* Render user-friendly detailed results */}
              {renderDetailedResults()}

              {/* Keep the raw JSON details as a collapsible section */}
              {details && (
                <details className="text-xs mt-3">
                  <summary className="cursor-pointer hover:text-blue-600">
                    {t('settings.modelProviders.viewDetails')}
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          }
          className="mb-4"
        />
      );
    };

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
              icon={
                isTestingConnection || testProviderMutation.isPending ? (
                  <SyncOutlined spin />
                ) : undefined
              }
              onClick={testConnection}
              disabled={
                !selectedProviderInfo || isTestingConnection || testProviderMutation.isPending
              }
              loading={isTestingConnection || testProviderMutation.isPending}
            >
              {isTestingConnection || testProviderMutation.isPending
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
                visibilityToggle={!isDefaultApiKey}
                className={isDefaultApiKey ? 'default-api-key' : ''}
                autoComplete="new-password"
                onChange={handleApiKeyChange}
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
