import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, Divider, Dropdown, DropdownProps, MenuProps, Skeleton, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { DownOutlined } from '@ant-design/icons';
import { ModelIcon } from '@lobehub/icons';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { LLMModelConfig, ModelInfo, TokenUsageMeter } from '@refly/openapi-schema';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuInfo, LuSettings2 } from 'react-icons/lu';
import {
  SettingsModalActiveTab,
  useSiderStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/sider';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { modelEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/model';
import { useGroupModels } from '@refly-packages/ai-workspace-common/hooks/use-group-models';
import './index.scss';

interface ModelSelectorProps {
  model: ModelInfo | null;
  setModel: (model: ModelInfo | null) => void;
  briefMode?: boolean;
  placement?: DropdownProps['placement'];
  trigger?: DropdownProps['trigger'];
  contextItems?: IContextItem[];
}

// Memoize the selected model display
const SelectedModelDisplay = memo(
  ({
    model,
    handleOpenSettingModal,
  }: { model: ModelInfo | null; handleOpenSettingModal: () => void }) => {
    const { t } = useTranslation();

    if (!model) {
      return (
        <Button
          type="text"
          size="small"
          className="text-xs gap-1.5"
          style={{ color: '#f59e0b' }}
          icon={<LuInfo className="flex items-center" />}
          onClick={handleOpenSettingModal}
        >
          {t('copilot.modelSelector.configureModel')}
        </Button>
      );
    }

    return (
      <Button
        type="text"
        size="small"
        className="text-xs gap-1.5"
        icon={<ModelIcon model={model.name} type={'color'} />}
      >
        {model.label}
        <DownOutlined />
      </Button>
    );
  },
);

SelectedModelDisplay.displayName = 'SelectedModelDisplay';

const ModelLabel = memo(
  ({ model, isContextIncludeImage }: { model: ModelInfo; isContextIncludeImage: boolean }) => {
    const { t } = useTranslation();

    return (
      <span className="text-xs flex items-center gap-1">
        {model.label}
        {!model.capabilities?.vision && isContextIncludeImage && (
          <Tooltip title={t('copilot.modelSelector.noVisionSupport')}>
            <IconError className="w-3.5 h-3.5 text-[#faad14]" />
          </Tooltip>
        )}
      </span>
    );
  },
);

ModelLabel.displayName = 'ModelLabel';

// Create a memoized settings button component
const SettingsButton = memo(
  ({
    handleOpenSettingModal,
    setDropdownOpen,
  }: {
    handleOpenSettingModal: () => void;
    setDropdownOpen: (open: boolean) => void;
  }) => {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
      setDropdownOpen(false);
      handleOpenSettingModal();
    }, [setDropdownOpen, handleOpenSettingModal]);

    return (
      <div onClick={handleClick} className="text-xs flex items-center gap-2 group">
        <LuSettings2 className="text-sm text-gray-500 flex items-center" />
        <div className="text-xs flex items-center gap-1.5 text-gray-500">
          {t('copilot.modelSelector.configureModel')}
        </div>
      </div>
    );
  },
);

SettingsButton.displayName = 'SettingsButton';

const isModelDisabled = (meter: TokenUsageMeter, model: ModelInfo) => {
  if (meter && model) {
    if (model.tier === 't1') {
      return meter.t1CountUsed >= meter.t1CountQuota && meter.t1CountQuota >= 0;
    }
    if (model.tier === 't2') {
      return meter.t2CountUsed >= meter.t2CountQuota && meter.t2CountQuota >= 0;
    }
  }
  return false;
};

export const ModelSelector = memo(
  ({
    placement = 'bottomLeft',
    trigger = ['click'],
    briefMode = false,
    model,
    setModel,
    contextItems,
  }: ModelSelectorProps) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { t } = useTranslation();

    const {
      data: providerItemList,
      isLoading: isModelListLoading,
      refetch: refetchModelList,
    } = useListProviderItems(
      {
        query: {
          category: 'llm',
          enabled: true,
        },
      },
      [],
      {
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    );

    // Listen for model update events
    useEffect(() => {
      const handleModelRefetch = () => {
        refetchModelList();
      };

      modelEmitter.on('model:list:refetch', handleModelRefetch);

      return () => {
        modelEmitter.off('model:list:refetch', handleModelRefetch);
      };
    }, [refetchModelList]);

    const { tokenUsage, isUsageLoading } = useSubscriptionUsage();

    const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
      setShowSettingModal: state.setShowSettingModal,
      setSettingsModalActiveTab: state.setSettingsModalActiveTab,
    }));

    const handleOpenSettingModal = useCallback(() => {
      setShowSettingModal(true);
      setSettingsModalActiveTab(SettingsModalActiveTab.ModelConfig);
    }, [setShowSettingModal, setSettingsModalActiveTab]);

    const modelList: ModelInfo[] = useMemo(() => {
      return (
        providerItemList?.data?.map((item) => {
          const config = item.config as LLMModelConfig;
          return {
            name: config.modelId,
            label: item.name,
            provider: item.provider?.providerKey,
            providerItemId: item.itemId,
            contextLimit: config.contextLimit,
            maxOutput: config.maxOutput,
            capabilities: config.capabilities,
            group: item.group,
          };
        }) || []
      );
    }, [providerItemList?.data]);

    const { handleGroupModelList } = useGroupModels();
    const sortedGroups = useMemo(() => handleGroupModelList(modelList), [modelList]);
    const isContextIncludeImage = useMemo(() => {
      return contextItems?.some((item) => item.type === 'image');
    }, [contextItems]);

    const droplist: MenuProps['items'] = useMemo(() => {
      let list = [];
      for (const group of sortedGroups) {
        if (group?.models?.length > 0) {
          const header = {
            key: group.key,
            type: 'group',
            label: (
              <Divider
                className="!my-1 !p-0"
                variant="dashed"
                orientation="left"
                orientationMargin="0"
              >
                <div className="text-[13px] max-w-[300px] truncate">{group.name}</div>
              </Divider>
            ),
          };
          const items = group.models.map((model) => ({
            key: model.name,
            label: <ModelLabel model={model} isContextIncludeImage={isContextIncludeImage} />,
            icon: <ModelIcon model={model.name} size={16} type={'color'} />,
          }));
          list = [...list, header, ...items];
        }
      }

      // Add settings button at the bottom
      list.push({
        key: 'settings',
        type: 'divider',
        className: '!my-1',
      });

      list.push({
        key: 'settings-button',
        label: (
          <SettingsButton
            handleOpenSettingModal={handleOpenSettingModal}
            setDropdownOpen={setDropdownOpen}
          />
        ),
      });

      return list;
    }, [sortedGroups, isContextIncludeImage, handleOpenSettingModal, setDropdownOpen]);

    // Automatically select available model when:
    // 1. No model is selected
    // 2. Current model is disabled
    // 3. Current model is not present in the model list
    useEffect(() => {
      if (
        !model ||
        isModelDisabled(tokenUsage, model) ||
        !modelList?.find((m) => m.name === model.name)
      ) {
        const availableModel = modelList?.find((m) => !isModelDisabled(tokenUsage, m));
        setModel(availableModel);
      }
    }, [model, tokenUsage, modelList, isModelDisabled, setModel]);

    const handleMenuClick = useCallback(
      ({ key }: { key: string }) => {
        const selectedModel = modelList?.find((model) => model.name === key);
        if (selectedModel) {
          setModel(selectedModel);
        }
      },
      [modelList, setModel],
    );

    if (isModelListLoading || isUsageLoading) {
      return <Skeleton className="w-28" active paragraph={false} />;
    }

    const remoteModel = modelList?.find((m) => m.name === model?.name);

    return (
      <Dropdown
        menu={{
          items: droplist,
          onClick: handleMenuClick,
        }}
        placement={placement}
        trigger={trigger}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        getPopupContainer={getPopupContainer}
        overlayClassName="model-selector-overlay"
        autoAdjustOverflow={true}
      >
        {!briefMode ? (
          <span className="text-xs flex items-center gap-1.5 text-gray-500 cursor-pointer transition-all duration-300 hover:text-gray-700">
            <SelectedModelDisplay model={model} handleOpenSettingModal={handleOpenSettingModal} />

            {!remoteModel?.capabilities?.vision && isContextIncludeImage && (
              <Tooltip title={t('copilot.modelSelector.noVisionSupport')}>
                <IconError className="w-3.5 h-3.5 text-[#faad14]" />
              </Tooltip>
            )}
          </span>
        ) : (
          <ModelIcon model={'gpt-4o'} size={16} type={'color'} />
        )}
      </Dropdown>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.placement === nextProps.placement &&
      prevProps.briefMode === nextProps.briefMode &&
      prevProps.model === nextProps.model &&
      prevProps.contextItems === nextProps.contextItems &&
      JSON.stringify(prevProps.trigger) === JSON.stringify(nextProps.trigger)
    );
  },
);

ModelSelector.displayName = 'ModelSelector';
