import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Button,
  Empty,
  Switch,
  Tooltip,
  Dropdown,
  message,
  MenuProps,
  Divider,
  Modal,
  Segmented,
  Skeleton,
} from 'antd';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import {
  IconDelete,
  IconEdit,
  ModelIcon,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  LLMModelConfig,
  ProviderCategory,
  ProviderItem,
  ProviderMode,
} from '@refly/openapi-schema';
import { modelEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/model';
import { ModelFormModal } from './model-form';
import { useUserStoreShallow, useChatStoreShallow } from '@refly/stores';
import { More, Settings, Back, Chat, AIModel } from 'refly-icons';
import { ContentHeader } from '../contentHeader';
import { DefaultModel } from '../default-model';
import { CreditBillingInfo } from '@refly-packages/ai-workspace-common/components/common/credit-billing-info';

const ActionDropdown = ({
  model,
  handleEdit,
  handleDelete,
}: {
  model: ProviderItem;
  handleEdit: () => void;
  handleDelete: () => void;
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await handleDelete();
      setModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

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
        <div
          className="flex items-center text-red-600 flex-grow cursor-pointer"
          onClick={() => {
            setVisible(false);
            setModalVisible(true);
          }}
        >
          <IconDelete size={16} className="mr-2" />
          {t('common.delete')}
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setVisible(open);
    }
  };

  return (
    <>
      <Dropdown trigger={['click']} open={visible} onOpenChange={handleOpenChange} menu={{ items }}>
        <Button type="text" icon={<More size={18} />} size="small" />
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
            {t('settings.modelConfig.deleteConfirm', {
              name: model.name || t('common.untitled'),
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};

const ModelItem = memo(
  ({
    model,
    onEdit,
    onDelete,
    onToggleEnabled,
    isSubmitting,
  }: {
    model: ProviderItem;
    onEdit: (model: ProviderItem) => void;
    onDelete: (model: ProviderItem) => void;
    onToggleEnabled: (model: ProviderItem, enabled: boolean) => void;
    isSubmitting: boolean;
  }) => {
    const { t } = useTranslation();
    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));
    const editable = userProfile?.preferences?.providerMode === 'custom';

    const handleToggleChange = useCallback(
      (checked: boolean) => {
        onToggleEnabled(model, checked);
      },
      [model, onToggleEnabled],
    );

    const handleSwitchWrapperClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    const handleEdit = useCallback(() => {
      onEdit(model);
    }, [model, onEdit]);

    const handleDelete = useCallback(() => {
      onDelete(model);
    }, [model, onDelete]);

    return (
      <div className="relative px-1.5 py-0.5 rounded-md cursor-pointer group hover:bg-refly-tertiary-hover">
        <div className="min-h-8 flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 flex items-center gap-2">
            <ModelIcon model={(model.config as LLMModelConfig)?.modelId || model.name} size={18} />
            <div className="text-refly-text-0">{model.name}</div>
            {model.creditBilling && (
              <>
                <Divider type="vertical" className="bg-refly-Card-Border mx-1 h-4" />
                <CreditBillingInfo creditBilling={model.creditBilling} />
              </>
            )}
          </div>

          {editable && (
            <div className="flex items-center gap-3">
              <div className="text-refly-text-1 text-xs">
                {model.provider?.isGlobal ? t('settings.modelConfig.global') : model.provider?.name}
              </div>

              <Divider type="vertical" className="bg-refly-Card-Border m-0 h-4" />
              <Tooltip
                title={
                  model.enabled
                    ? t('settings.modelConfig.disable')
                    : t('settings.modelConfig.enable')
                }
              >
                <div onClick={handleSwitchWrapperClick} className="flex items-center">
                  <Switch
                    size="small"
                    checked={model.enabled ?? false}
                    onChange={handleToggleChange}
                    loading={isSubmitting}
                  />
                </div>
              </Tooltip>
              <ActionDropdown model={model} handleEdit={handleEdit} handleDelete={handleDelete} />
            </div>
          )}
        </div>
      </div>
    );
  },
);

export const ModelConfig = ({ visible }: { visible: boolean }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ProviderCategory>('llm');
  const [modelItems, setModelItems] = useState<ProviderItem[]>([]);
  const [embedding, setEmbedding] = useState<ProviderItem | null>(null);
  const [reranker, setReranker] = useState<ProviderItem | null>(null);
  const [mediaGenerationModels, setMediaGenerationModels] = useState<ProviderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchQuery, _setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProviderItem | null>(null);
  const [activeTab, setActiveTab] = useState('conversation');
  const [isConfigDefaultModel, setIsConfigDefaultModel] = useState(false);

  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));

  const editable = userProfile?.preferences?.providerMode === 'custom';

  const { setMediaModelList } = useChatStoreShallow((state) => ({
    setMediaModelList: state.setMediaModelList,
  }));

  useEffect(() => {
    setMediaModelList(mediaGenerationModels.filter((item) => item.enabled));
  }, [mediaGenerationModels, setMediaModelList]);

  const defaultPreferences = userProfile?.preferences || {};
  const defaultModel = defaultPreferences.defaultModel || {};
  const chatModel = defaultModel.chat;
  const queryAnalysisModel = defaultModel.queryAnalysis;
  const titleGenerationModel = defaultModel.titleGeneration;

  const [providerMode, setProviderMode] = useState<ProviderMode>(
    defaultPreferences.providerMode || 'global',
  );

  const [isProviderModeChanging, setIsProviderModeChanging] = useState(false);

  const handleProviderModeChange = useCallback(
    async (checked: boolean) => {
      setIsProviderModeChanging(true);
      const newMode: ProviderMode = checked ? 'custom' : 'global';

      const updatedPreferences = {
        ...defaultPreferences,
        providerMode: newMode,
      };

      try {
        const res = await getClient().updateSettings({
          body: {
            preferences: updatedPreferences,
          },
        });

        if (res?.data?.success) {
          message.success(t('settings.modelConfig.syncSuccessfully'));
          setUserProfile({
            ...userProfile!,
            preferences: updatedPreferences,
          });
          setProviderMode(newMode);
        }
      } catch {
        message.error(t('settings.modelConfig.syncFailed'));
      } finally {
        setIsProviderModeChanging(false);
      }
    },
    [defaultPreferences, setUserProfile, userProfile, t],
  );

  const getDefaultModelTypes = (itemId: string) => {
    const type = [];
    if (itemId === chatModel?.itemId) {
      type.push('chat');
    }
    if (itemId === queryAnalysisModel?.itemId) {
      type.push('queryAnalysis');
    }
    if (itemId === titleGenerationModel?.itemId) {
      type.push('titleGeneration');
    }
    return type;
  };

  const updateDefaultModel = useCallback(
    async (types: ('chat' | 'queryAnalysis' | 'titleGeneration')[], model: ProviderItem | null) => {
      const updatedDefaultModel = {
        ...defaultModel,
      };
      for (const type of types) {
        if (model) {
          updatedDefaultModel[type] = model;
        }
      }

      const updatedPreferences = {
        ...defaultPreferences,
        defaultModel: updatedDefaultModel,
      };

      setUserProfile({
        ...userProfile!,
        preferences: updatedPreferences,
      });

      const res = await getClient().updateSettings({
        body: {
          preferences: updatedPreferences,
        },
      });

      if (res?.data?.success) {
        message.success(t('settings.defaultModel.syncSuccessfully'));
      }
    },
    [defaultModel, defaultPreferences, setUserProfile, userProfile, t],
  );

  const getProviderItems = useCallback(async () => {
    setIsLoading(true);
    const res = await getClient().listProviderItems({
      query: providerMode === 'global' ? { isGlobal: true, enabled: true } : { isGlobal: false },
    });
    setIsLoading(false);
    if (res?.data?.success) {
      const list = res?.data?.data || [];
      setModelItems(list.filter((item) => item.category === 'llm'));
      setEmbedding(list.filter((item) => item.category === 'embedding')?.[0]);
      setReranker(list.filter((item) => item.category === 'reranker')?.[0]);
      setMediaGenerationModels(list.filter((item) => item.category === 'mediaGeneration'));
    }
  }, [providerMode]);

  const updateModelMutation = async (enabled: boolean, model: ProviderItem) => {
    setIsUpdating(true);
    const res = await getClient().updateProviderItem({
      body: {
        itemId: model.itemId,
        enabled,
      },
    });
    if (res.data?.success) {
      const updatedModel = { ...model, enabled };
      if (model.category === 'llm') {
        setModelItems((prev) =>
          prev.map((item) => (item.itemId === model.itemId ? updatedModel : item)),
        );
      } else if (model.category === 'embedding') {
        setEmbedding(updatedModel);
      } else if (model.category === 'reranker') {
        setReranker(updatedModel);
      } else if (model.category === 'mediaGeneration') {
        setMediaGenerationModels((prev) =>
          prev.map((item) => (item.itemId === model.itemId ? updatedModel : item)),
        );
      }

      // Emit event to refresh model list in other components
      modelEmitter.emit('model:list:refetch', null);
    }
    setIsUpdating(false);
  };

  const beforeDeleteProviderItem = async (model: ProviderItem) => {
    const type = getDefaultModelTypes(model.itemId);
    if (type.length) {
      Modal.confirm({
        title: t('settings.modelConfig.deleteSyncConfirm', {
          name: model.name || t('common.untitled'),
        }),
        onOk: () => deleteProviderItem(model.itemId, model.category),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        okButtonProps: {
          danger: true,
        },
        cancelButtonProps: {
          className: 'hover:!text-green-600 hover:!border-green-600',
        },
      });
    } else {
      deleteProviderItem(model.itemId, model.category);
    }
  };

  const disableDefaultModelConfirm = async (modelName: string, handleOk: () => void) => {
    Modal.confirm({
      title: t('settings.modelConfig.disableDefaultModelTitle'),
      content: t('settings.modelConfig.disableDefaultModelContent', { modelName }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: handleOk,
    });
  };

  const deleteProviderItem = async (itemId: string, category: ProviderCategory) => {
    const res = await getClient().deleteProviderItem({
      body: { itemId },
    });
    if (res.data?.success) {
      message.success(t('common.deleteSuccess'));

      if (category === 'mediaGeneration') {
        setMediaGenerationModels(mediaGenerationModels.filter((item) => item.itemId !== itemId));
      } else {
        setModelItems(modelItems.filter((item) => item.itemId !== itemId));
        const types = getDefaultModelTypes(itemId);
        if (types.length) {
          updateDefaultModel(types as any, null);
        }

        // Emit event to refresh model list in other components
        modelEmitter.emit('model:list:refetch', null);
      }
    }
  };

  const handleAddModel = (category: ProviderCategory) => {
    setCategory(category);
    setEditingModel(null);
    setIsModalOpen(true);
  };

  const handleEditModel = (model: ProviderItem) => {
    setEditingModel(model);
    setCategory(model.category);
    setIsModalOpen(true);
  };

  const handleEditEmbedding = () => {
    if (embedding) {
      handleEditModel(embedding);
    } else {
      handleAddModel('embedding');
    }
  };

  const handleEditReranker = () => {
    if (reranker) {
      handleEditModel(reranker);
    } else {
      handleAddModel('reranker');
    }
  };

  const handleDeleteModel = (model: ProviderItem) => {
    beforeDeleteProviderItem(model);
  };

  const handleToggleEnabled = async (model: ProviderItem, enabled: boolean) => {
    const types = getDefaultModelTypes(model.itemId);
    if (!enabled && types.length) {
      disableDefaultModelConfirm(model.name, () => {
        updateModelMutation(enabled, model);
        updateDefaultModel(types as any, null);
      });
    } else {
      updateModelMutation(enabled, model);
    }
  };

  const handleSuccess = (
    categoryType: ProviderCategory,
    type?: 'create' | 'update',
    model?: ProviderItem,
  ) => {
    if (type === 'create') {
      if (categoryType === 'llm') {
        setModelItems((prev) => [...prev, model!]);
      } else if (categoryType === 'embedding') {
        setEmbedding(model!);
      } else if (categoryType === 'reranker') {
        setReranker(model!);
      } else if (categoryType === 'mediaGeneration') {
        setMediaGenerationModels((prev) => [...prev, model!]);
      }
    } else if (type === 'update') {
      if (categoryType === 'llm') {
        setModelItems((prev) =>
          prev.map((item) => (item.itemId === model!.itemId ? model! : item)),
        );
      } else if (categoryType === 'embedding') {
        setEmbedding(model!);
      } else if (categoryType === 'reranker') {
        setReranker(model!);
      } else if (categoryType === 'mediaGeneration') {
        setMediaGenerationModels((prev) =>
          prev.map((item) => (item.itemId === model!.itemId ? model! : item)),
        );
      }
    }
    setIsModalOpen(false);
    setEditingModel(null);

    // Emit event to refresh model list in other components
    modelEmitter.emit('model:list:refetch', null);
  };

  const filteredModels = useMemo(() => {
    const items = modelItems;

    if (!searchQuery.trim()) return items;

    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((model) => model.name?.toLowerCase().includes(lowerQuery));
  }, [modelItems, searchQuery]);

  useEffect(() => {
    if (visible) {
      getProviderItems();
    }
  }, [visible, getProviderItems, providerMode]);

  // Segmented options for model categories
  const segmentedOptions = useMemo(
    () => [
      {
        label: (
          <div className="flex items-center justify-center gap-1.5 w-full">
            <Chat size={16} />
            <span>{t('settings.modelConfig.conversationModels')}</span>
          </div>
        ),
        value: 'conversation',
      },
      {
        label: (
          <div className="flex items-center justify-center gap-1.5 w-full">
            <AIModel size={16} />
            <span>{t('settings.modelConfig.otherModels')}</span>
          </div>
        ),
        value: 'other',
      },
    ],
    [t],
  );

  const renderConversationModels = () => (
    <div
      className={cn(
        !isLoading && filteredModels.length === 0 ? 'flex items-center justify-center' : '',
        'min-h-[50px] overflow-y-auto',
      )}
    >
      {isLoading ? (
        <Skeleton active title={false} paragraph={{ rows: 10 }} />
      ) : filteredModels.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchQuery ? (
              <>
                <p>{t('settings.modelConfig.noSearchResults')}</p>
                <p className="text-sm text-gray-400">
                  {t('settings.modelConfig.tryDifferentSearch')}
                </p>
              </>
            ) : (
              <p>{t('settings.modelConfig.noModels')}</p>
            )
          }
        >
          {!searchQuery && editable && (
            <Button onClick={() => handleAddModel('llm')}>
              {t('settings.modelConfig.addFirstModel')}
            </Button>
          )}
        </Empty>
      ) : (
        <div className="mb-4 w-full space-y-2">
          {filteredModels
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
            .map((model) => (
              <ModelItem
                key={model.itemId}
                model={model}
                onEdit={handleEditModel}
                onDelete={handleDeleteModel}
                onToggleEnabled={handleToggleEnabled}
                isSubmitting={isUpdating}
              />
            ))}

          <div className="text-center text-refly-text-2 text-sm mt-4 pb-10">
            {t('common.noMore')}
          </div>
        </div>
      )}
    </div>
  );

  const renderOtherModels = () => (
    <>
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-medium">{t('settings.modelConfig.embedding')}</div>
            <div className="text-xs text-gray-500">
              {t('settings.modelConfig.embeddingDescription')}
            </div>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleEditEmbedding()}
          >
            <Button
              type="text"
              icon={<IconEdit size={16} className="text-gray-700" />}
              iconPosition="end"
              className={cn(embedding?.name ? 'text-gray-500' : 'text-gray-400', 'text-sm')}
            >
              {embedding?.name || t('settings.modelConfig.clickToSet')}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-medium">{t('settings.modelConfig.reranker')}</div>
            <div className="text-xs text-gray-500">
              {t('settings.modelConfig.rerankerDescription')}
            </div>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleEditReranker()}
          >
            <Button
              type="text"
              icon={<IconEdit size={16} className="text-gray-700" />}
              iconPosition="end"
              className={cn(reranker?.name ? 'text-gray-500' : 'text-gray-400', 'text-sm')}
            >
              {reranker?.name || t('settings.modelConfig.clickToSet')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'conversation':
        return renderConversationModels();
      case 'other':
        return renderOtherModels();
      default:
        return null;
    }
  };

  const customActions = useMemo(() => {
    return (
      <div className="flex items-center gap-3">
        <Tooltip title={t('settings.modelConfig.providerModeDescription')}>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-refly-text-0">
              {t('settings.modelConfig.providerMode')}
            </div>

            <Switch
              loading={isProviderModeChanging}
              checkedChildren={t('settings.modelConfig.custom')}
              unCheckedChildren={t('settings.modelConfig.global')}
              checked={providerMode === 'custom'}
              onChange={handleProviderModeChange}
            />
          </div>
        </Tooltip>

        <Divider type="vertical" className="h-6 bg-refly-Card-Border m-0" />

        <Button
          type="text"
          className="font-semibold border-solid border-[1px] border-refly-Card-Border rounded-lg"
          icon={<Settings size={18} />}
          onClick={() => setIsConfigDefaultModel(!isConfigDefaultModel)}
        >
          {t(`settings.${isConfigDefaultModel ? 'modelConfig' : 'defaultModel'}.title`)}
        </Button>
        {activeTab === 'conversation' && editable && (
          <Button type="primary" onClick={() => handleAddModel('llm')}>
            {t('settings.modelConfig.addModel')}
          </Button>
        )}
      </div>
    );
  }, [handleAddModel, t, activeTab, setIsConfigDefaultModel, editable, isConfigDefaultModel]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Custom Tab Header */}
      <ContentHeader
        title={t(`settings.${isConfigDefaultModel ? 'defaultModel' : 'modelConfig'}.title`)}
        onTitleClick={isConfigDefaultModel ? () => setIsConfigDefaultModel(false) : undefined}
        prefixIcon={isConfigDefaultModel ? <Back size={18} /> : null}
        customActions={customActions}
      />
      {isConfigDefaultModel ? (
        <DefaultModel visible={isConfigDefaultModel} />
      ) : (
        <>
          <div className="px-5 pt-5">
            <Segmented
              shape="round"
              options={segmentedOptions}
              value={activeTab}
              onChange={(value) => setActiveTab(value as string)}
              className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
              size="middle"
              style={{ width: '100%' }}
            />
          </div>

          {/* Tab Content */}
          <div className="p-5 flex-1 overflow-auto">{renderTabContent()}</div>
        </>
      )}

      {/* Modal for Create and Edit */}
      <ModelFormModal
        shouldRefetch={visible}
        isOpen={isModalOpen}
        filterProviderCategory={category}
        onClose={() => {
          setIsModalOpen(false);
          setEditingModel(null);
        }}
        disableDefaultModelConfirm={disableDefaultModelConfirm}
        model={editingModel}
        defaultModelTypes={getDefaultModelTypes(editingModel?.itemId ?? '')}
        onSuccess={handleSuccess}
        disabledEnableControl={['embedding', 'reranker'].includes(category)}
      />
    </div>
  );
};

ModelItem.displayName = 'ModelItem';
