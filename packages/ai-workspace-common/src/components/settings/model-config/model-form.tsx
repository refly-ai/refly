import { useCallback, useEffect, useMemo, memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useListProviders,
  useListProviderItemOptions,
} from '@refly-packages/ai-workspace-common/queries';
import {
  Button,
  Input,
  Modal,
  Form,
  Switch,
  Select,
  message,
  InputNumber,
  Checkbox,
  AutoComplete,
} from 'antd';
import {
  LLMModelConfig,
  ProviderCategory,
  ProviderItem,
  ProviderItemOption,
  ModelCapabilities,
} from '@refly/openapi-schema';
import { providerInfoList } from '@refly/utils';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Loading } from '../parser-config';
import { ProviderModal } from '@refly-packages/ai-workspace-common/components/settings/model-providers/provider-modal';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import mediaConfig from './media-config.json';
import { useUserStoreShallow } from '@refly/stores';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';

// Type definition for media config
interface MediaModelConfig {
  config: {
    modelId: string;
    capabilities: {
      image?: boolean;
      video?: boolean;
      audio?: boolean;
      vision?: boolean;
    };
    description?: {
      zh: string;
      en: string;
    };
  };
  name: string;
}

interface MediaConfig {
  [providerId: string]: MediaModelConfig[];
}

export const ModelFormModal = memo(
  ({
    isOpen,
    onClose,
    model,
    onSuccess,
    filterProviderCategory,
    shouldRefetch,
    disabledEnableControl = false,
    defaultModelTypes,
    disableDefaultModelConfirm,
  }: {
    isOpen: boolean;
    onClose: () => void;
    model?: ProviderItem | null;
    onSuccess: (category: ProviderCategory, type: 'create' | 'update', model: ProviderItem) => void;
    filterProviderCategory: ProviderCategory;
    disabledEnableControl?: boolean;
    shouldRefetch?: boolean;
    defaultModelTypes?: string[];
    disableDefaultModelConfirm?: (modelName: string, handleOk: () => void) => void;
  }) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const isEditMode = !!model;
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<any>(null);

    const userProfile = useUserStoreShallow((state) => state.userProfile);

    const modelIdOptionsCache = useRef<Record<string, any[]>>({});

    // Generate a cache key combining providerId and category
    const getCacheKey = useCallback(
      (providerId: string) => {
        return `${providerId}_${filterProviderCategory}`;
      },
      [filterProviderCategory],
    );

    const getCachedOptions = useCallback(
      (providerId: string) => {
        const cacheKey = getCacheKey(providerId);
        return modelIdOptionsCache.current[cacheKey];
      },
      [getCacheKey],
    );

    const setCachedOptions = useCallback(
      (providerId: string, options: any[]) => {
        const cacheKey = getCacheKey(providerId);
        modelIdOptionsCache.current[cacheKey] = options;
      },
      [getCacheKey],
    );

    const {
      data: providersResponse,
      isLoading: isProvidersLoading,
      refetch,
    } = useListProviders({
      query: { enabled: true, isGlobal: userProfile?.preferences?.providerMode === 'global' },
    });

    const presetProviders = useMemo(() => {
      return providerInfoList.filter((provider) => {
        if (filterProviderCategory) {
          return provider.categories.includes(filterProviderCategory as ProviderCategory);
        }
        return true;
      });
    }, [providerInfoList, filterProviderCategory]);

    const [isSaving, setIsSaving] = useState(false);

    const getProviderByProviderId = useCallback(
      (providerId: string) => {
        return providerId === 'global'
          ? {
              providerId: 'global',
              providerKey: 'global',
              categories: [],
              enabled: true,
              name: t('settings.modelConfig.global'),
              isGlobal: true,
            }
          : providersResponse?.data?.find((provider) => provider.providerId === providerId);
      },
      [providersResponse],
    );

    const getConfigByCategory = useCallback(
      (values: any, existingConfig: any = {}) => {
        const baseConfig = {
          ...existingConfig,
          modelId: values.modelId,
          modelName: values.name,
        };

        if (filterProviderCategory === 'llm' || filterProviderCategory === 'mediaGeneration') {
          const capabilitiesObject: Record<string, boolean> = {};
          if (Array.isArray(values.capabilities)) {
            for (const capability of values.capabilities) {
              capabilitiesObject[capability] = true;
            }
          }

          const config = {
            ...baseConfig,
            contextLimit: values.contextLimit,
            maxOutput: values.maxOutput,
            capabilities: capabilitiesObject,
          };

          // Add description for media generation models
          if (filterProviderCategory === 'mediaGeneration' && values.description) {
            config.description = values.description;
          }

          return config;
        }

        if (filterProviderCategory === 'embedding') {
          return {
            ...baseConfig,
            batchSize: values.batchSize,
            dimensions: values.dimensions,
          };
        }

        if (filterProviderCategory === 'reranker') {
          return {
            ...baseConfig,
            topN: values.topN,
            relevanceThreshold: values.relevanceThreshold,
          };
        }

        return baseConfig;
      },
      [filterProviderCategory],
    );

    const getCapabilitiesFromObject = (capabilitiesObject: any) => {
      const capabilitiesArray: string[] = [];
      if (capabilitiesObject && typeof capabilitiesObject === 'object') {
        for (const [key, value] of Object.entries(capabilitiesObject)) {
          if (value === true) {
            capabilitiesArray.push(key);
          }
        }
      }
      return capabilitiesArray;
    };

    const { data: globalProviderItems, isLoading: loadingGlobalProviderItems } =
      useFetchProviderItems({
        category: filterProviderCategory as ProviderCategory,
        isGlobal: true,
      });

    const {
      data: providerItemOptions,
      refetch: refetchProviderItemOptions,
      isLoading: loadingItemOptions,
    } = useListProviderItemOptions(
      {
        query: {
          category: filterProviderCategory as ProviderCategory,
          providerId: selectedProviderId,
        },
      },
      undefined,
      {
        enabled: Boolean(
          selectedProviderId && selectedProviderId !== 'global' && filterProviderCategory === 'llm',
        ),
      },
    );

    // Update cache when new options are fetched
    useEffect(() => {
      if (providerItemOptions?.data && selectedProviderId) {
        const options = providerItemOptions.data.map((item) => ({
          label: item.config?.modelId || '',
          value: item.config?.modelId || '',
          ...item,
        }));
        setCachedOptions(selectedProviderId, options);
      }
    }, [providerItemOptions, selectedProviderId, setCachedOptions]);

    // Force refetch when selectedProviderId changes for non-media generation categories
    useEffect(() => {
      if (selectedProviderId && filterProviderCategory !== 'mediaGeneration') {
        const cachedOptions = getCachedOptions(selectedProviderId);
        if (!cachedOptions) {
          refetchProviderItemOptions();
        }
      }
    }, [selectedProviderId, filterProviderCategory, getCachedOptions, refetchProviderItemOptions]);

    const createModelMutation = useCallback(
      async (values: any) => {
        setIsSaving(true);
        const res = await getClient().createProviderItem({
          body: {
            ...values,
            category: (filterProviderCategory as ProviderCategory) || 'llm',
            providerId: values.providerId,
            config: getConfigByCategory(values),
          },
        });
        setIsSaving(false);
        if (res.data?.success && res.data?.data) {
          message.success(t('common.addSuccess'));
          const provider = getProviderByProviderId(values.providerId);
          onSuccess?.(filterProviderCategory, 'create', {
            ...res.data.data,
            provider,
          });
          onClose();
        }
      },
      [onSuccess, onClose, getConfigByCategory, filterProviderCategory, getProviderByProviderId],
    );

    const updateModelMutation = useCallback(
      async (values: any, model: ProviderItem) => {
        setIsSaving(true);
        const res = await getClient().updateProviderItem({
          body: {
            ...values,
            itemId: model.itemId,
            config: getConfigByCategory(values, model.config),
          },
          query: {
            providerId: values.providerId,
          },
        });
        setIsSaving(false);
        if (res.data?.success && res.data?.data) {
          message.success(t('common.saveSuccess'));
          const provider = getProviderByProviderId(values.providerId);
          onSuccess?.(filterProviderCategory, 'update', {
            ...res.data.data,
            provider,
          });
          onClose();
        }
      },
      [onSuccess, onClose, getConfigByCategory, filterProviderCategory, getProviderByProviderId],
    );

    const handleAddModel = useCallback(() => {
      setIsProviderModalOpen(true);
    }, []);

    const handleProviderModalClose = useCallback(() => {
      setIsProviderModalOpen(false);
    }, []);

    const handleCreateProviderSuccess = useCallback(
      (provider: Provider) => {
        refetch();
        if (provider?.enabled) {
          resetFormExcludeField(['providerId']);
          form.setFieldsValue({
            providerId: provider.providerId,
            enabled: true,
          });
          setSelectedProviderId(provider.providerId);
        }
      },
      [refetch, form],
    );

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        if (isEditMode) {
          if (!values.enabled && defaultModelTypes?.length) {
            disableDefaultModelConfirm?.(model?.name, () => {
              updateModelMutation(values, model);
            });
          } else {
            updateModelMutation(values, model);
          }
        } else {
          createModelMutation(values);
        }
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    }, [form, updateModelMutation, createModelMutation, disableDefaultModelConfirm]);

    const providerOptions = useMemo(() => {
      const remoteProviders = (
        providersResponse?.data?.map((provider) => ({
          isGlobal: provider?.isGlobal,
          categories: provider?.categories,
          providerKey: provider?.providerKey,
          label: provider?.name || provider?.providerId,
          value: provider?.providerId,
        })) || []
      ).filter((provider) => {
        return provider.categories?.includes(filterProviderCategory as ProviderCategory);
      });
      return [
        { label: t('settings.modelConfig.global'), value: 'global', providerKey: 'global' },
        ...remoteProviders,
      ];
    }, [t, providersResponse, filterProviderCategory]);

    // Get current model options based on the selected provider
    const modelIdOptions = useMemo(() => {
      if (!selectedProviderId) return [];

      // If we have cached data, return it
      const cachedOptions = getCachedOptions(selectedProviderId);
      if (cachedOptions) {
        return cachedOptions;
      }

      // For media generation category, use the static configuration
      if (filterProviderCategory === 'mediaGeneration') {
        const provider = providerOptions.find((p) => p.value === selectedProviderId);
        const providerKey = provider?.providerKey || selectedProviderId;
        const providerConfig = (mediaConfig as unknown as MediaConfig)[providerKey];

        if (!providerConfig) return [];

        // Flatten all media types (image, audio, video) into a single array
        const allModels: MediaModelConfig[] = [];
        for (const mediaTypeArray of Object.values(providerConfig)) {
          if (Array.isArray(mediaTypeArray)) {
            allModels.push(...mediaTypeArray);
          }
        }

        return allModels.map((item) => ({
          label: item.config?.modelId || '',
          value: item.config?.modelId || '',
          ...item,
        }));
      }

      // If we're loading data, return empty array
      if (loadingItemOptions) {
        return [];
      }

      // If we have fresh data, update cache and return it
      if (providerItemOptions?.data) {
        const options = providerItemOptions.data.map((item) => ({
          label: item.config?.modelId || '',
          value: item.config?.modelId || '',
          ...item,
        }));
        setCachedOptions(selectedProviderId, options);
        return options;
      }

      return [];
    }, [
      selectedProviderId,
      loadingItemOptions,
      providerItemOptions?.data,
      getCachedOptions,
      setCachedOptions,
      filterProviderCategory,
      providerOptions,
    ]);

    const globalModelOptions = useMemo(() => {
      return globalProviderItems?.map((item) => ({
        label: item.name,
        value: item.itemId,
        ...item,
      }));
    }, [globalProviderItems]);

    if (!selectedProviderId && providerOptions?.[0]?.value) {
      setSelectedProviderId(providerOptions?.[0]?.value);
      form.setFieldsValue({ providerId: providerOptions?.[0]?.value });
    }

    const resetFormExcludeField = (fields: string[]) => {
      const values = form.getFieldsValue();
      form.resetFields();
      for (const field of fields) {
        form.setFieldsValue({ [field]: values[field] });
      }
    };

    const handleProviderChange = useCallback(
      (value: string) => {
        resetFormExcludeField(['providerId']);
        form.setFieldsValue({ enabled: true });
        const provider = providerOptions.find((p) => p.value === value);
        setSelectedProviderId(provider?.value);

        // Clear the cached options for the new provider to force refresh
        if (provider?.value) {
          const cacheKey = getCacheKey(provider.value);
          delete modelIdOptionsCache.current[cacheKey];
        }
      },
      [providerOptions, form, getCacheKey],
    );

    // Handle model ID selection
    const handleModelIdChange = useCallback(
      (_value: string, option: ProviderItemOption | ProviderItemOption[] | undefined) => {
        if (!option || Array.isArray(option)) return;

        resetFormExcludeField(['providerId', 'modelId']);

        const capabilities = getCapabilitiesFromObject(
          (option?.config as LLMModelConfig)?.capabilities as ModelCapabilities,
        );

        const formValues: any = {
          name: option?.name ?? '',
          enabled: true,
        };

        if (filterProviderCategory === 'llm') {
          formValues.contextLimit = (option?.config as LLMModelConfig)?.contextLimit;
          formValues.maxOutput = (option?.config as LLMModelConfig)?.maxOutput;
          formValues.capabilities = capabilities;
        } else if (filterProviderCategory === 'mediaGeneration') {
          formValues.capabilities = capabilities;
          // Handle description for media generation models
          if ((option?.config as any)?.description) {
            const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
            const description = (option.config as any).description;
            formValues.description = description[currentLang] || description.en;
          }
        }

        form.setFieldsValue(formValues);
      },
      [
        form,
        resetFormExcludeField,
        getCapabilitiesFromObject,
        filterProviderCategory,
        i18n.language,
      ],
    );

    const handleGlobalModelChange = useCallback(
      (_value: string, option: ProviderItem | ProviderItem[] | undefined) => {
        // Handle array case (shouldn't happen for single select, but type requires it)
        const selectedOption = Array.isArray(option) ? option[0] : option;
        if (!selectedOption) return;

        resetFormExcludeField(['providerId', 'modelId']);

        const capabilities = getCapabilitiesFromObject(
          (selectedOption?.config as LLMModelConfig)?.capabilities as ModelCapabilities,
        );

        const formValues: any = {
          globalItemId: selectedOption?.itemId ?? '',
          enabled: true,
        };

        if (filterProviderCategory === 'llm') {
          formValues.contextLimit = (selectedOption?.config as LLMModelConfig)?.contextLimit;
          formValues.maxOutput = (selectedOption?.config as LLMModelConfig)?.maxOutput;
          formValues.capabilities = capabilities;
        } else if (filterProviderCategory === 'mediaGeneration') {
          formValues.capabilities = capabilities;
          // Handle description for media generation models
          if ((selectedOption?.config as any)?.description) {
            const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
            const description = (selectedOption.config as any).description;
            formValues.description = description[currentLang] || description.en;
          }
        }

        form.setFieldsValue(formValues);
      },
      [
        form,
        resetFormExcludeField,
        getCapabilitiesFromObject,
        filterProviderCategory,
        i18n.language,
      ],
    );

    useEffect(() => {
      if (isOpen) {
        if (model) {
          const config = model?.config || ({} as any);

          interface FormValuesType {
            name: string;
            group: string;
            modelId: string;
            providerId: string;
            enabled: boolean;
            contextLimit?: number;
            maxOutput?: number;
            capabilities?: string[];
            batchSize?: number;
            dimensions?: number;
            topN?: number;
            relevanceThreshold?: number;
            description?: string;
          }

          const capabilitiesArray = getCapabilitiesFromObject(config.capabilities);

          const formValues: FormValuesType = {
            name: model?.name || '',
            group: model?.group || '',
            modelId: config.modelId,
            providerId: model?.providerId || '',
            enabled: model?.enabled ?? true,
          };

          if (filterProviderCategory === 'llm') {
            formValues.contextLimit = config.contextLimit;
            formValues.maxOutput = config.maxOutput;
            formValues.capabilities = capabilitiesArray;
          } else if (filterProviderCategory === 'mediaGeneration') {
            formValues.capabilities = capabilitiesArray;
            // Handle description for media generation models
            if (config.description) {
              const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
              formValues.description =
                config.description[currentLang] || config.description.en || config.description;
            }
          } else if (filterProviderCategory === 'embedding') {
            formValues.batchSize = config.batchSize;
            formValues.dimensions = config.dimensions;
          } else if (filterProviderCategory === 'reranker') {
            formValues.topN = config.topN;
            formValues.relevanceThreshold = config.relevanceThreshold;
          }

          form.setFieldsValue(formValues);

          // Check if we need to fetch provider item options
          const providerId = formValues.providerId;
          setSelectedProviderId(providerId);
          if (providerId && !getCachedOptions(providerId)) {
            refetchProviderItemOptions();
          }
        } else {
          form.resetFields();
          form.setFieldsValue({
            enabled: true,
            providerId: providerOptions?.[0]?.value,
            capabilities: [],
          });

          setSelectedProviderId(providerOptions?.[0]?.value);

          // Check if we need to fetch provider item options for the default provider
          const providerId = providerOptions?.[0]?.value;
          if (providerId && !getCachedOptions(providerId)) {
            refetchProviderItemOptions();
          }
        }
      }
    }, [isOpen]);

    useEffect(() => {
      if (shouldRefetch) {
        refetch();
      }
    }, [shouldRefetch]);

    const renderCategorySpecificFields = useMemo(() => {
      if (filterProviderCategory === 'llm') {
        return (
          <>
            <Form.Item
              name="contextLimit"
              label={t('settings.modelConfig.contextLimit')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.contextLimitPlaceholder')}
                className="w-full"
                min={0}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>

            <Form.Item
              name="maxOutput"
              label={t('settings.modelConfig.maxOutput')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.maxOutputPlaceholder')}
                className="w-full"
                min={0}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>

            <Form.Item name="capabilities" label={t('settings.modelConfig.capabilities')}>
              <Checkbox.Group
                className="w-full"
                key={`capabilities-${JSON.stringify(form.getFieldValue('capabilities'))}`}
                disabled={selectedProviderId === 'global'}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Checkbox value="functionCall">{t('settings.modelConfig.functionCall')}</Checkbox>
                  <Checkbox value="vision">{t('settings.modelConfig.vision')}</Checkbox>
                  <Checkbox value="reasoning">{t('settings.modelConfig.reasoning')}</Checkbox>
                  <Checkbox value="contextCaching">
                    {t('settings.modelConfig.contextCaching')}
                  </Checkbox>
                </div>
              </Checkbox.Group>
            </Form.Item>
          </>
        );
      }

      if (filterProviderCategory === 'mediaGeneration') {
        return (
          <>
            <Form.Item name="description" label={t('settings.modelConfig.description')}>
              <Input.TextArea
                placeholder={t('settings.modelConfig.descriptionPlaceholder')}
                rows={2}
              />
            </Form.Item>

            <Form.Item name="capabilities" label={t('settings.modelConfig.capabilities')}>
              <Checkbox.Group
                className="w-full"
                key={`capabilities-${JSON.stringify(form.getFieldValue('capabilities'))}`}
                onChange={(checkedValues) => {
                  // Limit to single selection for mediaGeneration
                  if (checkedValues.length > 1) {
                    const latestValue = checkedValues[checkedValues.length - 1];
                    form.setFieldsValue({ capabilities: [latestValue] });
                  }
                }}
                disabled={selectedProviderId === 'global'}
              >
                <div className="grid grid-cols-3 gap-1">
                  <Checkbox value="image">{t('settings.modelConfig.image')}</Checkbox>
                  <Checkbox value="video">{t('settings.modelConfig.video')}</Checkbox>
                  <Checkbox value="audio">{t('settings.modelConfig.audio')}</Checkbox>
                </div>
              </Checkbox.Group>
            </Form.Item>
          </>
        );
      }

      if (filterProviderCategory === 'embedding') {
        return (
          <>
            <Form.Item
              name="dimensions"
              label={t('settings.modelConfig.dimensions')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.dimensionsPlaceholder')}
                className="w-full"
                min={1}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>
            <Form.Item
              name="batchSize"
              label={t('settings.modelConfig.batchSize')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.batchSizePlaceholder')}
                className="w-full"
                min={1}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>
          </>
        );
      }

      if (filterProviderCategory === 'reranker') {
        return (
          <>
            <Form.Item
              name="topN"
              label={t('settings.modelConfig.topN')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.topNPlaceholder')}
                className="w-full"
                min={1}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>

            <Form.Item
              name="relevanceThreshold"
              label={t('settings.modelConfig.relevanceThreshold')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.relevanceThresholdPlaceholder')}
                className="w-full"
                min={0}
                max={1}
                step={0.01}
                disabled={selectedProviderId === 'global'}
              />
            </Form.Item>
          </>
        );
      }

      return null;
    }, [filterProviderCategory, selectedProviderId, t]);

    return (
      <Modal
        title={t(`settings.modelConfig.${isEditMode ? 'editModel' : 'addModel'}`)}
        centered
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSaving}>
            {isEditMode ? t('common.save') : t('common.add')}
          </Button>,
        ]}
      >
        <div>
          <Form form={form} className="mt-6" labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
            <Form.Item
              name="providerId"
              label={t('settings.modelConfig.provider')}
              rules={[{ required: true, message: t('settings.modelConfig.providerPlaceholder') }]}
            >
              <Select
                placeholder={t('settings.modelConfig.providerPlaceholder')}
                loading={isProvidersLoading}
                options={providerOptions}
                onChange={handleProviderChange}
                popupRender={(menu) => (
                  <>
                    {isProvidersLoading ? (
                      <Loading />
                    ) : (
                      <>
                        <div className="max-h-50 overflow-y-auto">{menu}</div>
                        <div className="p-2 border-t border-gray-200">
                          <Button
                            type="text"
                            icon={<IconPlus />}
                            onClick={handleAddModel}
                            className="flex items-center w-full"
                          >
                            {t('settings.parserConfig.createProvider')}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              />
            </Form.Item>

            {selectedProviderId === 'global' ? (
              <Form.Item
                name="globalItemId"
                label={t('settings.modelConfig.providerItem')}
                rules={[
                  { required: true, message: t('settings.modelConfig.providerItemPlaceholder') },
                ]}
              >
                <Select
                  placeholder={t('settings.modelConfig.providerItemPlaceholder')}
                  showSearch
                  optionFilterProp="label"
                  options={globalModelOptions}
                  notFoundContent={
                    loadingGlobalProviderItems && selectedProviderId === 'global' ? (
                      <Loading />
                    ) : null
                  }
                  loading={loadingGlobalProviderItems}
                  onChange={handleGlobalModelChange}
                />
              </Form.Item>
            ) : (
              <>
                <Form.Item
                  name="modelId"
                  label={t('settings.modelConfig.modelId')}
                  rules={[
                    { required: true, message: t('settings.modelConfig.modelIdPlaceholder') },
                  ]}
                >
                  <AutoComplete
                    placeholder={t('settings.modelConfig.modelIdPlaceholder')}
                    options={modelIdOptions}
                    filterOption={true}
                    onSelect={handleModelIdChange}
                  />
                </Form.Item>

                <Form.Item
                  name="name"
                  label={t('settings.modelConfig.name')}
                  rules={[{ required: true, message: t('settings.modelConfig.namePlaceholder') }]}
                >
                  <Input placeholder={t('settings.modelConfig.namePlaceholder')} />
                </Form.Item>
              </>
            )}

            <Form.Item name="group" label={t('settings.modelConfig.group')}>
              <Input placeholder={t('settings.modelConfig.groupPlaceholder')} />
            </Form.Item>

            {renderCategorySpecificFields}

            <Form.Item
              name="enabled"
              label={t('settings.modelConfig.enabled')}
              valuePropName="checked"
            >
              <Switch disabled={disabledEnableControl} />
            </Form.Item>
          </Form>
        </div>

        <ProviderModal
          isOpen={isProviderModalOpen}
          filterCategory={filterProviderCategory}
          presetProviders={presetProviders}
          onClose={handleProviderModalClose}
          onSuccess={handleCreateProviderSuccess}
          disabledEnableControl={true}
        />
      </Modal>
    );
  },
);

ModelFormModal.displayName = 'ModelFormModal';
