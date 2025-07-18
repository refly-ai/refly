import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, Skeleton, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ModelIcon } from '@lobehub/icons';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { LLMModelConfig, ModelInfo, TokenUsageMeter } from '@refly/openapi-schema';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuInfo } from 'react-icons/lu';
import { SettingsModalActiveTab, useSiderStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { IContextItem } from '@refly/common-types';
import { modelEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/model';
import { useGroupModels } from '@refly-packages/ai-workspace-common/hooks/use-group-models';
import './index.scss';
import { useUserStoreShallow } from '@refly/stores';
import { ArrowDown, Settings } from 'refly-icons';
import cn from 'classnames';

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
    open,
    model,
    handleOpenSettingModal,
  }: { open: boolean; model: ModelInfo | null; handleOpenSettingModal: () => void }) => {
    const { t } = useTranslation();

    if (!model) {
      return (
        <Button
          type="text"
          size="small"
          className={cn(
            'h-7text-xs gap-1.5 p-1 hover:border-refly-Card-Border',
            open && 'border-refly-Card-Border',
          )}
          style={{ color: '#f59e0b' }}
          icon={<LuInfo className="flex items-center" />}
          onClick={handleOpenSettingModal}
        >
          <div className="leading-5">{t('copilot.modelSelector.configureModel')}</div>
        </Button>
      );
    }

    return (
      <Button
        type="text"
        size="small"
        className={cn(
          'h-7 text-xs gap-0.5 p-1 hover:border-refly-Card-Border min-w-0',
          open && 'border-refly-Card-Border',
        )}
        icon={<ModelIcon model={model.name} type={'color'} />}
      >
        <span className="truncate leading-5">{model.label}</span>
        <ArrowDown size={12} color="var(--refly-text-0)" className="flex-shrink-0" />
      </Button>
    );
  },
);

SelectedModelDisplay.displayName = 'SelectedModelDisplay';

const ModelLabel = memo(
  ({ model, isContextIncludeImage }: { model: ModelInfo; isContextIncludeImage: boolean }) => {
    const { t } = useTranslation();

    return (
      <span className="text-xs flex items-center gap-1 text-refly-text-0 min-w-0 flex-1">
        <span className="truncate">{model.label}</span>
        {!model.capabilities?.vision && isContextIncludeImage && (
          <Tooltip title={t('copilot.modelSelector.noVisionSupport')}>
            <IconError className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
          </Tooltip>
        )}
      </span>
    );
  },
);

ModelLabel.displayName = 'ModelLabel';

// Create a memoized settings button component
export const SettingsButton = memo(
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
      <div
        onClick={handleClick}
        className="p-3 flex items-center rounded-b-lg gap-2 hover:bg-refly-tertiary-hover cursor-pointer border-t-1 border-x-0 border-b-0 border-solid border-refly-Card-Border"
      >
        <Settings size={14} />
        <span className="text-xs font-semibold text-refly-text-0">
          {t('copilot.modelSelector.configureModel')}
        </span>
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
    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));

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

    const handleMenuClick = useCallback(
      ({ key }: { key: string }) => {
        const selectedModel = modelList?.find((model) => model.name === key);
        if (selectedModel) {
          setModel(selectedModel);
          setDropdownOpen(false);
        }
      },
      [modelList, setModel, setDropdownOpen],
    );

    const droplist: MenuProps['items'] = useMemo(() => {
      let list = [];
      for (const group of sortedGroups) {
        if (group?.models?.length > 0) {
          const header = {
            key: group.key,
            type: 'group',
            label: (
              <div className="font-semibold text-refly-text-1 w-full truncate px-1.5 pb-1 pt-2">
                {group.name}
              </div>
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

      return list;
    }, [sortedGroups, isContextIncludeImage]);

    // Custom dropdown overlay component
    const dropdownOverlay = useMemo(
      () => (
        <div className="w-[240px] bg-refly-bg-content-z2 rounded-lg border border-1 border-solid border-refly-Card-Border">
          <div className="max-h-[48vh] w-full overflow-y-auto p-2">
            {droplist.map((item) => (
              <div key={item.key} className="model-list-item">
                {item.type === 'group' ? (
                  item.label
                ) : item.type !== 'divider' ? (
                  <div
                    className="flex items-center gap-1 rounded-[6px] p-1.5 hover:bg-refly-tertiary-hover cursor-pointer min-w-0"
                    onClick={() => handleMenuClick({ key: item.key as string })}
                  >
                    <div className="flex-shrink-0">{item.icon}</div>
                    <div className="min-w-0 flex-1">{item.label}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <SettingsButton
            handleOpenSettingModal={handleOpenSettingModal}
            setDropdownOpen={setDropdownOpen}
          />
        </div>
      ),
      [droplist, handleMenuClick, handleOpenSettingModal, setDropdownOpen],
    );

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
        const defaultModelItemId = userProfile?.preferences?.defaultModel?.chat?.itemId;
        let initialModel: ModelInfo | null = null;

        if (defaultModelItemId) {
          initialModel = modelList?.find((m) => m.providerItemId === defaultModelItemId);
        }
        if (!initialModel) {
          initialModel = modelList?.find((m) => !isModelDisabled(tokenUsage, m));
        }
        setModel(initialModel);
      }
    }, [model, tokenUsage, modelList, isModelDisabled, setModel]);

    if (isModelListLoading || isUsageLoading) {
      return <Skeleton className="w-28" active paragraph={false} />;
    }

    const remoteModel = modelList?.find((m) => m.name === model?.name);

    return (
      <Dropdown
        dropdownRender={() => dropdownOverlay}
        placement={placement}
        trigger={trigger}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        getPopupContainer={getPopupContainer}
        overlayClassName="model-selector-overlay"
        autoAdjustOverflow={true}
      >
        {!briefMode ? (
          <div className="text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-300">
            <SelectedModelDisplay
              open={dropdownOpen}
              model={model}
              handleOpenSettingModal={handleOpenSettingModal}
            />

            {!remoteModel?.capabilities?.vision && isContextIncludeImage && (
              <Tooltip title={t('copilot.modelSelector.noVisionSupport')}>
                <IconError className="w-3.5 h-3.5 text-[#faad14]" />
              </Tooltip>
            )}
          </div>
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
