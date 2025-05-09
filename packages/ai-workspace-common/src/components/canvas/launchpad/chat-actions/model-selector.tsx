import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, Progress, Skeleton, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconDown } from '@arco-design/web-react/icon';
import { AiOutlineExperiment } from 'react-icons/ai';
import { ModelIcon } from '@lobehub/icons';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { PiWarningCircleBold } from 'react-icons/pi';
import {
  LLMModelConfig,
  ModelInfo,
  SubscriptionPlanType,
  TokenUsageMeter,
} from '@refly/openapi-schema';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import {
  IconSubscription,
  IconError,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuInfinity } from 'react-icons/lu';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { modelEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/model';
import './index.scss';

interface ModelSelectorProps {
  model: ModelInfo | null;
  setModel: (model: ModelInfo | null) => void;
  briefMode?: boolean;
  placement?: DropdownProps['placement'];
  trigger?: DropdownProps['trigger'];
  contextItems?: IContextItem[];
}

const UsageProgress = memo(
  ({
    used,
    quota,
    setDropdownOpen,
  }: { used: number; quota: number; setDropdownOpen: (open: boolean) => void }) => {
    const { t } = useTranslation();
    const setShowSettingModal = useSiderStoreShallow((state) => state.setShowSettingModal);

    const handleShowSettingModal = useCallback(() => {
      setDropdownOpen(false);
      setShowSettingModal(true);
    }, [setDropdownOpen, setShowSettingModal]);

    const formattedUsed = useMemo(
      () => used?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '0',
      [used],
    );
    const formattedQuota = useMemo(
      () => quota?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '0',
      [quota],
    );

    return (
      <div className="flex items-center gap-1 cursor-pointer" onClick={handleShowSettingModal}>
        {quota < 0 ? (
          <Tooltip title={t('copilot.modelSelector.unlimited')}>
            <LuInfinity className="text-sm" />
          </Tooltip>
        ) : (
          <Progress
            type="circle"
            percent={(used / quota) * 100}
            strokeColor={used >= quota ? '#EF4444' : '#46C0B2'}
            strokeWidth={20}
            size={14}
            format={() =>
              used >= quota
                ? t('copilot.modelSelector.quotaExceeded')
                : t('copilot.modelSelector.tokenUsed', {
                    used: formattedUsed,
                    quota: formattedQuota,
                  })
            }
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.used === nextProps.used && prevProps.quota === nextProps.quota;
  },
);

UsageProgress.displayName = 'UsageProgress';

// Memoize model option items
const ModelOption = memo(({ provider }: { provider: string }) => (
  <ModelIcon model={provider} type={'color'} />
));

ModelOption.displayName = 'ModelOption';

// Create a memoized group header component
const GroupHeader = memo(
  ({
    type,
    tokenUsage,
    planTier,
    setDropdownOpen,
    setSubscribeModalVisible,
  }: {
    type: 'premium' | 'standard' | 'free';
    tokenUsage: TokenUsageMeter;
    planTier: SubscriptionPlanType;
    setDropdownOpen: (open: boolean) => void;
    setSubscribeModalVisible: (visible: boolean) => void;
  }) => {
    const { t } = useTranslation();

    if (type === 'premium') {
      return (
        <div className="flex justify-between items-center">
          <span className="text-sm">{t('copilot.modelSelector.premium')}</span>
          {subscriptionEnabled &&
            (planTier === 'free' && tokenUsage?.t1CountQuota === 0 ? (
              <Button
                type="text"
                size="small"
                className="text-xs !text-green-600 gap-1 translate-x-2"
                icon={<IconSubscription />}
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                  setSubscribeModalVisible(true);
                }}
              >
                {t('copilot.modelSelector.upgrade')}
              </Button>
            ) : (
              <UsageProgress
                used={tokenUsage?.t1CountUsed}
                quota={tokenUsage?.t1CountQuota}
                setDropdownOpen={setDropdownOpen}
              />
            ))}
        </div>
      );
    }

    if (type === 'standard') {
      return (
        <div className="flex justify-between items-center">
          <div className="text-sm">{t('copilot.modelSelector.standard')}</div>
          {subscriptionEnabled && (
            <UsageProgress
              used={tokenUsage?.t2CountUsed}
              quota={tokenUsage?.t2CountQuota}
              setDropdownOpen={setDropdownOpen}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-sm">{t('copilot.modelSelector.free')}</span>
          <Tooltip title={t('copilot.modelSelector.freeModelHint')}>
            <AiOutlineExperiment className="w-3.5 h-3.5 text-orange-500" />
          </Tooltip>
        </div>
        {subscriptionEnabled && (
          <UsageProgress used={-1} quota={-1} setDropdownOpen={setDropdownOpen} />
        )}
      </div>
    );
  },
);

GroupHeader.displayName = 'GroupHeader';

// Memoize the selected model display
const SelectedModelDisplay = memo(({ model }: { model: ModelInfo | null }) => {
  const { t } = useTranslation();

  if (!model) {
    return (
      <>
        <PiWarningCircleBold className="text-yellow-600" />
        <span className="text-yellow-600">{t('copilot.modelSelector.noModelAvailable')}</span>
      </>
    );
  }

  return (
    <>
      <ModelIcon model={model.name} type={'color'} />
      {model.label}
    </>
  );
});

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
          };
        }) || []
      );
    }, [providerItemList?.data]);

    const isContextIncludeImage = useMemo(() => {
      return contextItems?.some((item) => item.type === 'image');
    }, [contextItems]);

    const droplist: MenuProps['items'] = useMemo(() => {
      return modelList.map((model) => ({
        key: model.name,
        label: <ModelLabel model={model} isContextIncludeImage={isContextIncludeImage} />,
        icon: <ModelIcon model={model.name} size={16} type={'color'} />,
      }));
    }, [modelList, isContextIncludeImage]);

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
            <SelectedModelDisplay model={model} />
            <IconDown />
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
