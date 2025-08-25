import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, Skeleton, Tooltip, Typography } from 'antd';
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
import { CreditBillingInfo } from '@refly-packages/ai-workspace-common/components/common/credit-billing-info';

const { Paragraph } = Typography;

interface ModelSelectorProps {
  model: ModelInfo | null;
  size?: 'small' | 'medium';
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
    size = 'medium',
    handleOpenSettingModal,
  }: {
    open: boolean;
    model: ModelInfo | null;
    size?: 'small' | 'medium';
    handleOpenSettingModal: () => void;
  }) => {
    const { t } = useTranslation();

    if (!model) {
      return (
        <Button
          type="text"
          size="small"
          className={cn(
            'h-7 text-xs gap-1.5 p-1 hover:border-refly-Card-Border',
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
          'h-7 text-sm gap-1.5 p-1 hover:border-refly-Card-Border min-w-0 flex items-center',
          open && 'border-refly-Card-Border',
        )}
      >
        <ModelIcon model={model.name} type={'color'} size={18} />
        <Paragraph
          className={cn(
            'truncate leading-5 !mb-0',
            size === 'small' ? 'text-xs max-w-28' : 'text-sm max-w-48',
          )}
          ellipsis={{ rows: 1, tooltip: true }}
        >
          {model.label}
        </Paragraph>
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
        className="p-3 flex items-center rounded-b-lg gap-2 hover:bg-refly-tertiary-hover cursor-pointer border-t-[1px] border-x-0 border-b-0 border-solid border-refly-Card-Border"
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
      return meter.t1CountUsed! >= meter.t1CountQuota! && meter.t1CountQuota! >= 0;
    }
    if (model.tier === 't2') {
      return meter.t2CountUsed! >= meter.t2CountQuota! && meter.t2CountQuota! >= 0;
    }
  }
  return false;
};

export const ModelSelector = memo(
  ({
    placement = 'bottomLeft',
    trigger = ['click'],
    briefMode = false,
    size = 'medium',
    model,
    setModel,
    contextItems,
  }: ModelSelectorProps) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { t } = useTranslation();

    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));
    const providerMode = userProfile?.preferences?.providerMode;

    const {
      data: providerItemList,
      isLoading: isModelListLoading,
      refetch: refetchModelList,
    } = useListProviderItems(
      {
        query: {
          category: 'llm',
          enabled: true,
          isGlobal: userProfile?.preferences?.providerMode === 'global',
        },
      },
      undefined,
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

    // Refetch model list when provider mode changes
    useEffect(() => {
      refetchModelList();
    }, [providerMode, refetchModelList]);

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
            provider: item.provider?.providerKey ?? '',
            providerItemId: item.itemId,
            contextLimit: config.contextLimit!,
            maxOutput: config.maxOutput!,
            capabilities: config.capabilities,
            creditBilling: item.creditBilling,
            group: item.group,
          };
        }) || []
      );
    }, [providerItemList?.data]);

    const { handleGroupModelList } = useGroupModels();

    const isContextIncludeImage = useMemo(() => {
      return contextItems?.some((item) => item.type === 'image') ?? false;
    }, [contextItems]);

    const handleMenuClick = useCallback(
      ({ key }: { key: string }) => {
        const selectedModel = modelList?.find((model) => model.providerItemId === key);
        if (selectedModel) {
          setModel(selectedModel);
          setDropdownOpen(false);
        }
      },
      [modelList, setModel, setDropdownOpen],
    );

    const droplist: MenuProps['items'] = useMemo(() => {
      if (providerMode === 'global') {
        return modelList
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((model) => ({
            key: model.providerItemId,
            label: <ModelLabel model={model} isContextIncludeImage={isContextIncludeImage} />,
            icon: <ModelIcon model={model.name} size={16} type={'color'} />,
          }));
      }

      const sortedGroups = handleGroupModelList(modelList);

      let list: any[] = [];
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
            key: model.providerItemId,
            label: <ModelLabel model={model} isContextIncludeImage={isContextIncludeImage} />,
            icon: <ModelIcon model={model.name} size={16} type={'color'} />,
          }));
          list = [...list, header, ...items];
        }
      }

      return list;
    }, [modelList, isContextIncludeImage]);

    // Custom dropdown overlay component
    const dropdownOverlay = useMemo(
      () => (
        <div className="w-[260px] bg-refly-bg-content-z2 rounded-lg border-[1px] border-solid border-refly-Card-Border">
          <div className="max-h-[48vh] w-full overflow-y-auto p-2">
            {droplist
              .filter((item) => !!item)
              .map((item) => {
                const model = modelList.find((m) => m.providerItemId === item.key);
                return (
                  <div key={item.key} className="model-list-item">
                    {item.type === 'group' ? (
                      item.label
                    ) : item.type !== 'divider' ? (
                      <div
                        className="flex justify-between items-center gap-1.5 rounded-[6px] p-2 hover:bg-refly-tertiary-hover cursor-pointer min-w-0"
                        onClick={() => handleMenuClick({ key: item.key as string })}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 flex items-center">{item.icon}</div>
                          <div className="min-w-0 flex-1">{item.label}</div>
                        </div>
                        {model?.creditBilling && (
                          <CreditBillingInfo creditBilling={model.creditBilling} />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
          <SettingsButton
            handleOpenSettingModal={handleOpenSettingModal}
            setDropdownOpen={setDropdownOpen}
          />
        </div>
      ),
      [t, droplist, handleMenuClick, handleOpenSettingModal, setDropdownOpen],
    );

    // Automatically select available model when:
    // 1. No model is selected
    // 2. Current model is disabled
    // 3. Current model is not present in the model list
    useEffect(() => {
      if (modelList?.length === 0) {
        return;
      }

      if (
        !model ||
        isModelDisabled(tokenUsage!, model) ||
        !modelList?.find((m) => m.name === model.name)
      ) {
        const defaultModelItemId = userProfile?.preferences?.defaultModel?.chat?.itemId;
        let initialModel: ModelInfo | undefined;

        if (defaultModelItemId) {
          initialModel = modelList?.find((m) => m.providerItemId === defaultModelItemId);
        }
        if (!initialModel) {
          initialModel = modelList?.find((m) => !isModelDisabled(tokenUsage!, m));
        }
        setModel(initialModel ?? null);
      }
    }, [model, tokenUsage, modelList, isModelDisabled, setModel]);

    if (isModelListLoading || isUsageLoading) {
      return <Skeleton className="w-28" active paragraph={false} />;
    }

    const remoteModel = modelList?.find((m) => m.name === model?.name);

    return (
      <Dropdown
        popupRender={() => dropdownOverlay}
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
              size={size}
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
      prevProps.size === nextProps.size &&
      prevProps.contextItems === nextProps.contextItems &&
      JSON.stringify(prevProps.trigger) === JSON.stringify(nextProps.trigger)
    );
  },
);

ModelSelector.displayName = 'ModelSelector';
