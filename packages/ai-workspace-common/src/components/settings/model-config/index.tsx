import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Button,
  Input,
  Empty,
  Switch,
  Tooltip,
  Dropdown,
  Popconfirm,
  Typography,
  message,
  MenuProps,
  Divider,
  Tag,
  Modal,
  Collapse,
} from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import {
  IconDelete,
  IconEdit,
  IconMoreHorizontal,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LLMModelConfig, ProviderCategory, ProviderItem } from '@refly/openapi-schema';
import { ModelIcon } from '@lobehub/icons';
import { modelEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/model';
import { useGroupModels } from '@refly-packages/ai-workspace-common/hooks/use-group-models';
import { ModelFormModal } from './model-form';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

const { Title } = Typography;

const MODEL_TIER_TO_COLOR = {
  free: 'green',
  t1: 'blue',
  t2: 'orange',
};

const panelStyle: React.CSSProperties = {
  marginBottom: 12,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(0,0,0, 0.02)',
};

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
          title={t('settings.modelConfig.deleteConfirm', {
            name: model.name || t('common.untitled'),
          })}
          onConfirm={() => handleDelete()}
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

  const handleOpenChange = (open: boolean, info: any) => {
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
      <div className="bg-white relative mb-3 px-5 py-0.5 rounded-md cursor-pointer border border-solid border-gray-100 group hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 flex items-center gap-2">
            <ModelIcon
              model={(model.config as LLMModelConfig)?.modelId || model.name}
              size={18}
              type={'color'}
            />
            <div className="font-medium">{model.name}</div>

            <Divider type="vertical" />
            <div className="font-normal text-xs text-gray-500">{model.provider?.name}</div>

            {model.tier && (
              <>
                <Divider type="vertical" />
                <Tag color={MODEL_TIER_TO_COLOR[model.tier]}>
                  {t(`settings.modelTier.${model.tier}`)}
                </Tag>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ActionDropdown model={model} handleEdit={handleEdit} handleDelete={handleDelete} />

            <Tooltip
              title={
                model.enabled ? t('settings.modelConfig.disable') : t('settings.modelConfig.enable')
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
          </div>
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
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProviderItem | null>(null);
  const [activeCollapseKeys, setActiveCollapseKeys] = useState<string[]>([]);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));
  const defaultPreferences = userProfile?.preferences || {};
  const defaultModel = defaultPreferences.defaultModel || {};
  const chatModel = defaultModel.chat;
  const queryAnalysisModel = defaultModel.queryAnalysis;
  const titleGenerationModel = defaultModel.titleGeneration;

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
        updatedDefaultModel[type] = model;
      }

      const updatedPreferences = {
        ...defaultPreferences,
        defaultModel: updatedDefaultModel,
      };

      setUserProfile({
        ...userProfile,
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
    const res = await getClient().listProviderItems();
    setIsLoading(false);
    if (res?.data?.success) {
      const list = res?.data?.data || [];
      setModelItems(list.filter((item) => item.category === 'llm'));
      setEmbedding(list.filter((item) => item.category === 'embedding')?.[0]);
      setReranker(list.filter((item) => item.category === 'reranker')?.[0]);
    }
  }, []);

  const updateModelMutation = useCallback(
    async (enabled: boolean, model: ProviderItem) => {
      setIsUpdating(true);
      const res = await getClient().updateProviderItem({
        body: {
          ...model,
          enabled,
        },
        query: {
          providerId: model.providerId,
        },
      });
      setIsUpdating(false);
      if (res.data.success) {
        const updatedModel = {
          ...model,
          enabled,
        };
        setModelItems(
          modelItems.map((item) => (item.itemId === updatedModel.itemId ? updatedModel : item)),
        );
        message.success(t('common.saveSuccess'));

        // Emit event to refresh model list in other components
        modelEmitter.emit('model:list:refetch', null);
      }
    },
    [modelItems, t],
  );

  const beforeDeleteProviderItem = async (model: ProviderItem) => {
    const type = getDefaultModelTypes(model.itemId);
    if (type.length) {
      Modal.confirm({
        title: t('settings.modelConfig.deleteSyncConfirm', {
          name: model.name || t('common.untitled'),
        }),
        onOk: () => deleteProviderItem(model.itemId),
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
      deleteProviderItem(model.itemId);
    }
  };

  const disableDefaultModelConfirm = async (modelName: string, handleOk: () => void) => {
    Modal.confirm({
      title: t('settings.modelConfig.disableSyncConfirm', {
        name: modelName || t('common.untitled'),
      }),
      onOk: () => handleOk(),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: {
        danger: true,
      },
      cancelButtonProps: {
        className: 'hover:!text-green-600 hover:!border-green-600',
      },
    });
  };

  const deleteProviderItem = async (itemId: string) => {
    const res = await getClient().deleteProviderItem({
      body: { itemId },
    });
    if (res.data.success) {
      message.success(t('common.deleteSuccess'));
      setModelItems(modelItems.filter((item) => item.itemId !== itemId));
      const types = getDefaultModelTypes(itemId);
      if (types.length) {
        updateDefaultModel(types, null);
      }

      // Emit event to refresh model list in other components
      modelEmitter.emit('model:list:refetch', null);
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
        updateDefaultModel(types, null);
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
    if (categoryType === 'llm') {
      let updatedItems = [...modelItems];
      if (type === 'create') {
        updatedItems = [...modelItems, model];
        setModelItems(updatedItems);
      } else if (type === 'update') {
        updatedItems = [
          ...modelItems.map((item) => (item.itemId === model.itemId ? { ...model } : item)),
        ];
        setModelItems(updatedItems);

        const types = getDefaultModelTypes(model.itemId);
        if (types.length) {
          updateDefaultModel(types, model?.enabled ? model : null);
        }
      }

      if (model) {
        setTimeout(() => {
          const groups = handleGroupModelList(updatedItems);
          const groupWithModel = groups.find((group) =>
            group.models.some((m) => m.itemId === model.itemId),
          );

          if (groupWithModel) {
            // Open the group containing the model
            setActiveCollapseKeys((prev) =>
              prev.includes(groupWithModel.key) ? prev : [...prev, groupWithModel.key],
            );
          }
        }, 0);
      }
    } else if (categoryType === 'embedding') {
      setEmbedding(model);
    } else if (categoryType === 'reranker') {
      setReranker(model);
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

  // Use the utility function instead of inline implementation
  const { handleGroupModelList } = useGroupModels();
  const sortedGroups = useMemo(() => handleGroupModelList(filteredModels), [filteredModels]);

  // When search query changes, update active collapse keys to show matching groups
  useEffect(() => {
    if (searchQuery.trim() && userHasInteracted) {
      const matchingGroupKeys = sortedGroups
        .filter((group) =>
          group.models.some((model) =>
            model.name?.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        )
        .map((group) => group.key);

      setActiveCollapseKeys(matchingGroupKeys);
    }
  }, [searchQuery, sortedGroups, userHasInteracted]);

  // Update active keys when groups change (initial load)
  useEffect(() => {
    if (sortedGroups.length > 0 && !userHasInteracted) {
      setActiveCollapseKeys(sortedGroups.map((group) => group.key));
    }
  }, [sortedGroups, userHasInteracted]);

  useEffect(() => {
    if (visible) {
      getProviderItems();
    }
  }, [visible]);

  // Handle collapse panel change
  const handleCollapseChange = (keys: string | string[]) => {
    setUserHasInteracted(true);
    setActiveCollapseKeys(typeof keys === 'string' ? [keys] : keys);
  };

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.modelConfig.chatModels')}
      </Title>

      {/* Search and Add Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-xs">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder={t('settings.modelConfig.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button
          type="primary"
          icon={<LuPlus className="h-5 w-5 flex items-center" />}
          onClick={() => handleAddModel('llm')}
        >
          {t('settings.modelConfig.addModel')}
        </Button>
      </div>

      {/* Models List */}
      <div
        className={cn(
          isLoading || filteredModels.length === 0 ? 'flex items-center justify-center' : '',
          filteredModels.length === 0
            ? 'p-4 border-dashed border-gray-200 dark:border-gray-600 rounded-md'
            : '',
          'min-h-[50px] overflow-y-auto',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin />
          </div>
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
            {!searchQuery && (
              <Button
                onClick={() => handleAddModel('llm')}
                icon={<LuPlus className="flex items-center" />}
              >
                {t('settings.modelConfig.addFirstModel')}
              </Button>
            )}
          </Empty>
        ) : (
          <div className="mb-4 w-full">
            <Collapse
              size="small"
              activeKey={activeCollapseKeys}
              onChange={handleCollapseChange}
              bordered={false}
              className="bg-transparent"
              items={sortedGroups.map((group) => ({
                key: group.key,
                label: <span className="font-medium text-base">{group.name}</span>,
                style: panelStyle,
                children: group.models.map((model) => (
                  <ModelItem
                    key={model.itemId}
                    model={model}
                    onEdit={handleEditModel}
                    onDelete={handleDeleteModel}
                    onToggleEnabled={handleToggleEnabled}
                    isSubmitting={isUpdating}
                  />
                )),
              }))}
            />

            <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
          </div>
        )}
      </div>

      <Divider />

      <Title level={4} className="pb-4">
        {t('settings.modelConfig.otherModels')}
      </Title>

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
        defaultModelTypes={getDefaultModelTypes(editingModel?.itemId)}
        onSuccess={handleSuccess}
        disabledEnableControl={['embedding', 'reranker'].includes(category)}
      />
    </div>
  );
};
