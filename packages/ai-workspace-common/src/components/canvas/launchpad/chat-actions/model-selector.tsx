import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, Progress, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconDown } from '@arco-design/web-react/icon';
import classNames from 'classnames';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';

import { PiWarningCircleBold } from 'react-icons/pi';
import { ModelInfo, TokenUsageMeter } from '@refly/openapi-schema';
import { IconModel, ModelProviderIcons } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useGetSubscriptionUsage, useListModels } from '@refly-packages/ai-workspace-common/queries';
import { IconSubscription } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuInfinity } from 'react-icons/lu';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';

interface ModelSelectorProps {
  model: ModelInfo | null;
  setModel: (model: ModelInfo | null) => void;
  briefMode?: boolean;
  placement?: DropdownProps['placement'];
  trigger?: DropdownProps['trigger'];
}

const UsageProgress = memo(
  ({ used, quota, setDropdownOpen }: { used: number; quota: number; setDropdownOpen: (open: boolean) => void }) => {
    const { t } = useTranslation();
    const setShowSettingModal = useSiderStoreShallow((state) => state.setShowSettingModal);

    const handleShowSettingModal = useCallback(() => {
      setDropdownOpen(false);
      setShowSettingModal(true);
    }, [setDropdownOpen, setShowSettingModal]);

    const formattedUsed = useMemo(() => used?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '0', [used]);
    const formattedQuota = useMemo(() => quota?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '0', [quota]);

    return (
      <div className="flex items-center gap-1 cursor-pointer" onClick={handleShowSettingModal}>
        <Progress
          type="circle"
          percent={(used / quota) * 100}
          strokeColor={used >= quota ? '#EF4444' : '#46C0B2'}
          strokeWidth={20}
          size={14}
          format={() =>
            used >= quota
              ? t(`copilot.modelSelector.quotaExceeded`)
              : t('copilot.modelSelector.tokenUsed', {
                  used: formattedUsed,
                  quota: formattedQuota,
                })
          }
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.used === nextProps.used && prevProps.quota === nextProps.quota;
  },
);

UsageProgress.displayName = 'UsageProgress';

export const ModelSelector = memo(
  ({ placement = 'bottomLeft', trigger = ['click'], briefMode = false, model, setModel }: ModelSelectorProps) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));
    const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
      setSubscribeModalVisible: state.setSubscribeModalVisible,
    }));

    const { data: modelListData, isLoading: isModelListLoading } = useListModels({}, [], {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    });

    const { data: tokenUsageData, isLoading: isTokenUsageLoading } = useGetSubscriptionUsage({}, [], {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000, // Consider data fresh for 1 minute
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const modelList = useMemo(() => modelListData?.data, [modelListData?.data]);
    const tokenUsage = useMemo(() => tokenUsageData?.data?.token, [tokenUsageData?.data?.token]);
    const t1Disabled = useMemo(
      () => tokenUsage?.t1TokenUsed >= tokenUsage?.t1TokenQuota,
      [tokenUsage?.t1TokenUsed, tokenUsage?.t1TokenQuota],
    );
    const t2Disabled = useMemo(
      () => tokenUsage?.t2TokenUsed >= tokenUsage?.t2TokenQuota,
      [tokenUsage?.t2TokenUsed, tokenUsage?.t2TokenQuota],
    );

    const planTier = useMemo(
      () => userProfile?.subscription?.planType || 'free',
      [userProfile?.subscription?.planType],
    );

    const t1Models = useMemo(
      () =>
        modelList
          ?.filter((model) => model.tier === 't1')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((model) => ({
            key: model.name,
            icon: <img className="w-4 h-4 mr-2" src={ModelProviderIcons[model.provider]} alt={model.provider} />,
            label: <span className="text-xs">{model.label}</span>,
            disabled: t1Disabled,
          })),
      [modelList, t1Disabled],
    );

    const t2Models = useMemo(
      () =>
        modelList
          ?.filter((model) => model.tier === 't2')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((model) => ({
            key: model.name,
            icon: <img className="w-4 h-4 mr-2" src={ModelProviderIcons[model.provider]} alt={model.provider} />,
            label: <span className="text-xs">{model.label}</span>,
            disabled: t2Disabled,
          })),
      [modelList, t2Disabled],
    );

    const freeModels = useMemo(
      () =>
        modelList
          ?.filter((model) => model.tier === 'free')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((model) => ({
            key: model.name,
            icon: <img className="w-4 h-4 mr-2" src={ModelProviderIcons[model.provider]} alt={model.provider} />,
            label: <span className="text-xs">{model.label}</span>,
          })),
      [modelList],
    );

    const droplist: MenuProps['items'] = useMemo(() => {
      const items = [];

      if (t1Models?.length > 0) {
        items.push({
          key: 't1',
          type: 'group',
          label: (
            <div className="flex justify-between items-center">
              <span className="text-sm">{t('copilot.modelSelector.premium')}</span>
              {planTier === 'free' && tokenUsage?.t1TokenQuota === 0 ? (
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
                  {t(`copilot.modelSelector.upgrade`)}
                </Button>
              ) : (
                <UsageProgress
                  used={tokenUsage?.t1TokenUsed}
                  quota={tokenUsage?.t1TokenQuota}
                  setDropdownOpen={setDropdownOpen}
                />
              )}
            </div>
          ),
          children: t1Models,
        });
      }

      if (t2Models?.length > 0) {
        items.push({
          key: 't2',
          type: 'group',
          label: (
            <div className="flex justify-between items-center">
              <div className="text-sm">{t('copilot.modelSelector.standard')}</div>
              <UsageProgress
                used={tokenUsage?.t2TokenUsed}
                quota={tokenUsage?.t2TokenQuota}
                setDropdownOpen={setDropdownOpen}
              />
            </div>
          ),
          children: t2Models,
        });
      }

      if (freeModels?.length > 0) {
        items.push({
          key: 'free',
          type: 'group',
          label: (
            <div className="flex justify-between items-center">
              <span className="text-sm">{t('copilot.modelSelector.free')}</span>
              <LuInfinity className="text-sm" />
            </div>
          ),
          children: freeModels,
        });
      }

      return items;
    }, [t1Models, t2Models, freeModels, planTier, tokenUsage, t, setDropdownOpen, setSubscribeModalVisible]);

    const isModelDisabled = useCallback((meter: TokenUsageMeter, model: ModelInfo) => {
      if (meter && model) {
        if (model.tier === 't1') {
          return meter.t1TokenUsed >= meter.t1TokenQuota;
        } else if (model.tier === 't2') {
          return meter.t2TokenUsed >= meter.t2TokenQuota;
        }
      }
      return false;
    }, []);

    useEffect(() => {
      if (!model || isModelDisabled(tokenUsage, model)) {
        const availableModel = modelList?.find((model) => !isModelDisabled(tokenUsage, model));
        if (availableModel) {
          setModel(availableModel);
        } else {
          setModel(null);
        }
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

    if (isModelListLoading || isTokenUsageLoading) {
      return <Skeleton className="w-28" active paragraph={false} />;
    }

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
      >
        {!briefMode ? (
          <span className={classNames('model-selector', 'chat-action-item')}>
            {model ? (
              <>
                <img className="w-3 h-3 mx-1" src={ModelProviderIcons[model?.provider]} alt={model?.provider} />
                {model?.label}
              </>
            ) : (
              <>
                <PiWarningCircleBold className="text-yellow-600" />
                <span className="text-yellow-600">{t('copilot.modelSelector.noModelAvailable')}</span>
              </>
            )}
            <IconDown />
          </span>
        ) : (
          <IconModel className="w-3.5 h-3.5" />
        )}
      </Dropdown>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.placement === nextProps.placement &&
      prevProps.briefMode === nextProps.briefMode &&
      prevProps.model === nextProps.model &&
      JSON.stringify(prevProps.trigger) === JSON.stringify(nextProps.trigger)
    );
  },
);

ModelSelector.displayName = 'ModelSelector';
