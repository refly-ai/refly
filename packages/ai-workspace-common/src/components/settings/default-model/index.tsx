import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries/queries';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ProviderItem } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { Select, Typography, message, Skeleton } from 'antd';

const { Text, Title } = Typography;

type ModelSelectProps = {
  value?: ProviderItem;
  onChange: (model: ProviderItem) => void;
  options: ProviderItem[];
  placeholder: string;
  description: string;
  title: string;
  isUpdating?: boolean;
};

const ModelSelect = React.memo(
  ({ value, onChange, options, placeholder, description, title, isUpdating }: ModelSelectProps) => {
    const handleModelChange = useCallback(
      (itemId: string) => {
        const selectedModel = options?.find((model) => model?.itemId === itemId);
        if (selectedModel) {
          onChange(selectedModel);
        }
      },
      [onChange, options],
    );

    return (
      <div className="mb-6">
        <Title level={5} className="mb-4">
          {title}
        </Title>
        <Select
          className="w-full mb-2"
          placeholder={placeholder}
          value={value?.itemId}
          loading={isUpdating}
          onChange={handleModelChange}
          options={options?.map((model) => ({
            label: model?.name ?? '',
            value: model?.itemId ?? '',
          }))}
        />
        <Text type="secondary" className="text-sm">
          {description}
        </Text>
      </div>
    );
  },
);

ModelSelect.displayName = 'ModelSelect';

export const DefaultModel = React.memo(({ visible }: { visible: boolean }) => {
  const { t } = useTranslation();
  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state?.userProfile,
    setUserProfile: state?.setUserProfile,
  }));

  const { data, isLoading, refetch } = useListProviderItems({
    query: {
      enabled: true,
      category: 'llm',
    },
  });

  const llmProviders = useMemo(() => data?.data ?? [], [data?.data]);

  const defaultPreferences = useMemo(
    () => userProfile?.preferences ?? {},
    [userProfile?.preferences],
  );
  const defaultModel = useMemo(() => defaultPreferences?.defaultModel ?? {}, [defaultPreferences]);

  const [chatModel, setChatModel] = useState<ProviderItem | undefined>(defaultModel?.chat);
  const [agentModel, setAgentModel] = useState<ProviderItem | undefined>(defaultModel?.agent);
  const [queryAnalysisModel, setQueryAnalysisModel] = useState<ProviderItem | undefined>(
    defaultModel?.queryAnalysis,
  );
  const [titleGenerationModel, setTitleGenerationModel] = useState<ProviderItem | undefined>(
    defaultModel?.titleGeneration,
  );

  const [updateLoading, setUpdateLoading] = useState<Record<string, boolean>>({});

  const updateSettings = useCallback(
    async (type: 'chat' | 'agent' | 'queryAnalysis' | 'titleGeneration', model?: ProviderItem) => {
      const updatedDefaultModel = {
        ...defaultModel,
        [type]: model,
      };

      const updatedPreferences = {
        ...defaultPreferences,
        defaultModel: updatedDefaultModel,
      };

      setUpdateLoading((prev) => ({ ...prev, [type]: true }));

      try {
        const res = await getClient().updateSettings({
          body: {
            preferences: updatedPreferences,
          },
        });

        if (res?.data?.success) {
          setUserProfile({
            ...userProfile,
            preferences: updatedPreferences,
          });
          message.success(t('settings.defaultModel.updateSuccessfully'));
        }
      } catch (error) {
        console.error('Failed to update settings:', error);
        message.error(t('settings.defaultModel.updateFailed'));
      } finally {
        setUpdateLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [defaultModel, defaultPreferences, setUserProfile, userProfile, t],
  );

  const handleChatModelChange = useCallback(
    (model: ProviderItem) => {
      setChatModel(model);
      updateSettings('chat', model);
    },
    [updateSettings],
  );

  const handleQueryAnalysisModelChange = useCallback(
    (model: ProviderItem) => {
      setQueryAnalysisModel(model);
      updateSettings('queryAnalysis', model);
    },
    [updateSettings],
  );

  const handleTitleGenerationModelChange = useCallback(
    (model: ProviderItem) => {
      setTitleGenerationModel(model);
      updateSettings('titleGeneration', model);
    },
    [updateSettings],
  );

  const handleAgentModelChange = useCallback(
    (model: ProviderItem) => {
      setAgentModel(model);
      updateSettings('agent', model);
    },
    [updateSettings],
  );

  useEffect(() => {
    if (visible) {
      refetch();
    }
  }, [visible, refetch]);

  useEffect(() => {
    if (visible) {
      setChatModel(defaultModel?.chat);
      setAgentModel(defaultModel?.agent);
      setQueryAnalysisModel(defaultModel?.queryAnalysis);
      setTitleGenerationModel(defaultModel?.titleGeneration);
    }
  }, [visible, defaultModel]);

  if (isLoading) {
    return (
      <div className="w-full h-full p-4">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className="p-4">
      <ModelSelect
        value={chatModel}
        onChange={handleChatModelChange}
        options={llmProviders}
        placeholder={t('settings.defaultModel.noModel')}
        description={t('settings.defaultModel.description.chat')}
        title={t('settings.defaultModel.chat')}
        isUpdating={updateLoading.chat}
      />

      <ModelSelect
        value={agentModel}
        onChange={handleAgentModelChange}
        options={llmProviders}
        placeholder={t('settings.defaultModel.noModel')}
        description={t('settings.defaultModel.description.agent')}
        title={t('settings.defaultModel.agent')}
        isUpdating={updateLoading.agent}
      />

      <ModelSelect
        value={queryAnalysisModel}
        onChange={handleQueryAnalysisModelChange}
        options={llmProviders}
        placeholder={t('settings.defaultModel.noModel')}
        description={t('settings.defaultModel.description.queryAnalysis')}
        title={t('settings.defaultModel.queryAnalysis')}
        isUpdating={updateLoading.queryAnalysis}
      />

      <ModelSelect
        value={titleGenerationModel}
        onChange={handleTitleGenerationModelChange}
        options={llmProviders}
        placeholder={t('settings.defaultModel.noModel')}
        description={t('settings.defaultModel.description.titleGeneration')}
        title={t('settings.defaultModel.titleGeneration')}
        isUpdating={updateLoading.titleGeneration}
      />
    </div>
  );
});

DefaultModel.displayName = 'DefaultModel';
