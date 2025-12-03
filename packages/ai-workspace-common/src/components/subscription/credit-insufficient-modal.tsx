import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useAuthStoreShallow,
} from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  IconLightning01,
  IconSubscription,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Checked } from 'refly-icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SubscriptionPlanType } from '@refly/openapi-schema';

type SubscriptionInterval = 'monthly' | 'yearly';

interface Feature {
  name: string;
  type?: string;
  items?: string[];
  duration?: string;
}

interface CreditPackOption {
  id: string;
  price: string;
  credits: string;
}

// Price option card for monthly/yearly selection (compact version)
interface PriceOptionProps {
  type: 'monthly' | 'yearly';
  isSelected: boolean;
  price: number;
  yearlyTotal?: number;
  onSelect: (id: string) => void;
}

const PriceOption = memo(({ type, isSelected, price, yearlyTotal, onSelect }: PriceOptionProps) => {
  const { t } = useTranslation('ui');

  const handleClick = useCallback(() => {
    onSelect(type);
  }, [type, onSelect]);

  return (
    <div
      className={`
        relative flex-1 p-3 rounded-lg cursor-pointer transition-all duration-200
        ${
          isSelected
            ? 'border-2 border-[#0E9F77] bg-white shadow-[0px_2px_8px_rgba(14,159,119,0.12)]'
            : 'border-[1.5px] border-gray-200 bg-[#FAFAFA] hover:border-[#0E9F77]'
        }
      `}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm font-medium text-gray-900">
          {type === 'monthly' ? t('subscription.monthly') : t('subscription.yearly')}
        </span>
        {type === 'yearly' && (
          <Tag
            className="!m-0 !px-1.5 !py-0 !text-[10px] !font-medium !rounded !leading-4"
            color="orange"
          >
            {t('subscription.save20')}
          </Tag>
        )}
        {isSelected && (
          <div className="ml-auto w-4 h-4 bg-[#0E9F77] rounded-full flex items-center justify-center">
            <Checked size={10} color="#fff" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-gray-900">${price}</span>
        <span className="text-xs text-gray-500">/month</span>
        {type === 'yearly' && yearlyTotal && (
          <span className="text-xs text-gray-500">${yearlyTotal}/year</span>
        )}
      </div>
    </div>
  );
});

PriceOption.displayName = 'PriceOption';

// Feature item component (compact version)
interface FeatureItemProps {
  feature: Feature | string;
}

const FeatureItem = memo(({ feature }: FeatureItemProps) => {
  const featureObj = typeof feature === 'string' ? { name: feature } : feature;
  const parts = featureObj.name.split('\n');
  const name = parts[0];
  const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

  // Handle pointFreeTools type with special display logic
  if (featureObj.type === 'pointFreeTools' && featureObj.items && featureObj.items.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <Checked size={14} color="#0E9F77" />
          </div>
          <span className="text-xs leading-4 text-gray-900 font-semibold">{name}</span>
        </div>
        <div className="ml-5 p-0 rounded-md bg-transparent flex flex-col gap-1">
          {featureObj.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#0E9F77] flex-shrink-0" />
                <span className="text-xs text-gray-700">{item}</span>
              </div>
              {featureObj.duration && (
                <span className="text-[10px] font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded">
                  {featureObj.duration}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <Checked size={14} color="#0E9F77" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs leading-4 text-gray-900 font-semibold">
          {name}
          {description && <span className="font-normal text-gray-500"> {description}</span>}
        </span>
      </div>
    </div>
  );
});

FeatureItem.displayName = 'FeatureItem';

// Credit pack card component (compact version)
interface CreditPackCardProps {
  pack: CreditPackOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CreditPackCard = memo(({ pack, isSelected, onSelect }: CreditPackCardProps) => {
  const handleClick = useCallback(() => {
    onSelect(pack.id);
  }, [pack.id, onSelect]);

  return (
    <div
      className={`
        relative flex items-center justify-between p-3 px-4 bg-white 
        rounded-lg cursor-pointer transition-all duration-200 min-h-[72px]
        ${
          isSelected
            ? 'border-2 border-[#0E9F77] shadow-[0px_2px_8px_rgba(14,159,119,0.12)]'
            : 'border-[1.5px] border-gray-200 hover:border-[#0E9F77]'
        }
      `}
      onClick={handleClick}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-900 leading-none">{pack.price}</span>
        <span className="text-xs font-normal text-gray-500 leading-none">{pack.credits}</span>
      </div>
      {isSelected && (
        <div className="absolute top-3 right-4 w-4 h-4 bg-[#0E9F77] rounded-full flex items-center justify-center">
          <Checked size={10} color="#fff" />
        </div>
      )}
    </div>
  );
});

CreditPackCard.displayName = 'CreditPackCard';

// Credit packs feature item (compact version)
interface CreditPacksFeatureItemProps {
  feature: string;
}

const CreditPacksFeatureItem = memo(({ feature }: CreditPacksFeatureItemProps) => {
  const parts = feature.split('\n');
  const title = parts[0];
  const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <Checked size={14} color="#0E9F77" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-gray-900 leading-4">{title}</span>
        {description && (
          <span className="text-[11px] font-normal text-gray-500 leading-4">{description}</span>
        )}
      </div>
    </div>
  );
});

CreditPacksFeatureItem.displayName = 'CreditPacksFeatureItem';

// Plus Plan Card Component
const PlusPlanCard = memo(
  ({
    selectedId,
    onSelect,
  }: {
    selectedId: string;
    onSelect: (id: string) => void;
  }) => {
    const { t } = useTranslation('ui');

    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));

    const currentPlan = userProfile?.subscription?.planType || 'free';
    const isCurrentPlan = currentPlan === 'plus';

    const priceInfo = useMemo(
      () => ({
        monthly: 19.9,
        yearly: 15.9,
        yearlyTotal: 190,
      }),
      [],
    );

    const features = useMemo(() => {
      return (
        (t('subscription.plans.plus.features', { returnObjects: true }) as (string | Feature)[]) ??
        []
      );
    }, [t]);

    return (
      <div
        className="flex-1 p-5 box-border rounded-xl shadow-[0px_4px_16px_rgba(0,0,0,0.06)] flex flex-col"
        style={{
          background: 'linear-gradient(180deg,  #1FC99615, #45BEFF10), #ffffff',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <IconLightning01 size={18} className="text-[#0E9F77]" />
          <span className="text-base font-semibold text-gray-900">
            {t('subscription.plans.plus.title')}
          </span>
          {isCurrentPlan && (
            <Tag className="!m-0 !px-1.5 !py-0 !text-[10px] !font-medium !rounded !bg-gray-100 !text-gray-600 !border-gray-200">
              {t('subscription.plans.currentPlan')}
            </Tag>
          )}
        </div>

        {/* Price options */}
        <div className="flex gap-2 mb-4 mt-3">
          <PriceOption
            type="monthly"
            isSelected={selectedId === 'monthly'}
            price={priceInfo.monthly}
            onSelect={onSelect}
          />
          <PriceOption
            type="yearly"
            isSelected={selectedId === 'yearly'}
            price={priceInfo.yearly}
            yearlyTotal={priceInfo.yearlyTotal}
            onSelect={onSelect}
          />
        </div>

        {/* Features */}
        <div className="pt-4 border-t border-black/[0.06] flex flex-col gap-2.5 flex-1 overflow-y-auto">
          {features.map((feature, index) => (
            <FeatureItem key={index} feature={feature} />
          ))}
        </div>
      </div>
    );
  },
);

PlusPlanCard.displayName = 'PlusPlanCard';

// Credit Packs Card Component
const CreditPacksCard = memo(
  ({
    selectedId,
    onSelect,
  }: {
    selectedId: string;
    onSelect: (id: string) => void;
  }) => {
    const { t } = useTranslation('ui');

    const creditPackOptions: CreditPackOption[] = useMemo(
      () => [
        {
          id: 'credit_pack_100',
          price: t('subscription.creditPacks.credit_pack_100.price'),
          credits: t('subscription.creditPacks.credit_pack_100.credits'),
        },
        {
          id: 'credit_pack_1000',
          price: t('subscription.creditPacks.credit_pack_1000.price'),
          credits: t('subscription.creditPacks.credit_pack_1000.credits'),
        },
        {
          id: 'credit_pack_500',
          price: t('subscription.creditPacks.credit_pack_500.price'),
          credits: t('subscription.creditPacks.credit_pack_500.credits'),
        },
        {
          id: 'credit_pack_2000',
          price: t('subscription.creditPacks.credit_pack_2000.price'),
          credits: t('subscription.creditPacks.credit_pack_2000.credits'),
        },
      ],
      [t],
    );

    const features = useMemo(() => {
      return (t('subscription.creditPacks.features', { returnObjects: true }) as string[]) ?? [];
    }, [t]);

    return (
      <div
        className="flex-1 p-5 box-border rounded-xl shadow-[0px_4px_16px_rgba(0,0,0,0.06)]"
        style={{
          background: 'linear-gradient(180deg, #FEC04C25, rgba(255, 255, 255, 0) 80%), #ffffff',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <IconSubscription className="w-[18px] h-[18px] text-gray-900" />
          <span className="text-base font-semibold text-gray-900">
            {t('subscription.creditPacks.title')}
          </span>
        </div>

        {/* Credit pack options - 2x2 grid */}
        <Row gutter={[8, 8]} className="mb-4">
          {creditPackOptions.map((pack) => (
            <Col span={12} key={pack.id}>
              <CreditPackCard pack={pack} isSelected={selectedId === pack.id} onSelect={onSelect} />
            </Col>
          ))}
        </Row>

        {/* Features list */}
        <div className="pt-4 border-t border-black/[0.06] flex flex-col gap-5 max-h-[220px] overflow-y-auto">
          {features.map((feature, index) => (
            <CreditPacksFeatureItem key={index} feature={feature} />
          ))}
        </div>
      </div>
    );
  },
);

CreditPacksCard.displayName = 'CreditPacksCard';

// Selection ID: monthly, yearly, or credit pack id
type SelectionId = 'monthly' | 'yearly' | string;

export const CreditInsufficientModal = memo(() => {
  const { t } = useTranslation('ui');

  const {
    creditInsufficientModalVisible,
    setCreditInsufficientModalVisible,
    creditInsufficientTriggeredFrom,
  } = useSubscriptionStoreShallow((state) => ({
    creditInsufficientModalVisible: state.creditInsufficientModalVisible,
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
    creditInsufficientTriggeredFrom: state.creditInsufficientTriggeredFrom,
  }));

  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));

  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  // Determine if user has a paid subscription
  const currentPlan = userProfile?.subscription?.planType || 'free';
  const hasPaidSubscription = currentPlan !== 'free';

  // If triggered from canvas and user is free, don't show credit packs
  const isTriggeredFromCanvas = creditInsufficientTriggeredFrom === 'canvas';
  const shouldShowCreditPacks = !isTriggeredFromCanvas || hasPaidSubscription;

  // Determine if showing both cards (free user not from canvas) or single card
  const showBothCards = !hasPaidSubscription && shouldShowCreditPacks;

  // Determine popup type based on display logic
  const popupType = useMemo(() => {
    if (!shouldShowCreditPacks) return 'plus_only';
    if (hasPaidSubscription) return 'credit_pack_only';
    return 'plus_and_package';
  }, [shouldShowCreditPacks, hasPaidSubscription]);

  // Report insufficient_credit_popup_view event when modal opens
  useEffect(() => {
    if (creditInsufficientModalVisible) {
      logEvent('insufficient_credit_popup_view', Date.now(), {
        user_plan: currentPlan,
        popup_type: popupType,
        source: creditInsufficientTriggeredFrom || 'canvas',
      });
    }
  }, [creditInsufficientModalVisible, currentPlan, popupType, creditInsufficientTriggeredFrom]);

  // Single selection state - can be 'monthly', 'yearly', or a credit pack id
  const [selectedId, setSelectedId] = useState<SelectionId>(
    hasPaidSubscription && shouldShowCreditPacks ? 'credit_pack_1000' : 'yearly',
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = useCallback((id: SelectionId) => {
    setSelectedId(id);
  }, []);

  const handleClose = useCallback(() => {
    setCreditInsufficientModalVisible(false);
  }, [setCreditInsufficientModalVisible]);

  // Determine if selected item is a plan or credit pack
  const isPlanSelected = selectedId === 'monthly' || selectedId === 'yearly';

  const handleBuyNow = useCallback(async () => {
    if (isLoading) return;

    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }

    setIsLoading(true);

    try {
      if (isPlanSelected) {
        // Buy Plus Plan
        const interval = selectedId as SubscriptionInterval;
        logEvent('subscription::upgrade_click', 'credit_insufficient_modal', {
          plan_type: 'plus',
          interval: interval,
        });

        const res = await getClient().createCheckoutSession({
          body: {
            planType: 'plus' as SubscriptionPlanType,
            interval: interval,
          },
        });
        if (res.data?.data?.url) {
          window.location.href = res.data.data.url;
        }
      } else {
        // Buy Credit Pack
        logEvent('subscription::credit_pack_click', 'credit_insufficient_modal', {
          pack_id: selectedId,
        });

        const res = await getClient().createCreditPackCheckoutSession({
          body: {
            packId: selectedId,
          },
        });
        if (res.data?.data?.url) {
          window.location.href = res.data.data.url;
        }
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLogin, isPlanSelected, selectedId, setLoginModalOpen]);

  return (
    <Modal
      open={creditInsufficientModalVisible}
      centered
      footer={null}
      width={showBothCards ? 820 : 410}
      onCancel={handleClose}
      title={
        <span className="text-xl font-semibold text-gray-900">
          {t('canvas.skillResponse.creditInsufficient.title', 'Insufficient Credits')}
        </span>
      }
      className="credit-insufficient-modal"
    >
      <div className="flex flex-col gap-5 pt-2">
        {/* Show cards based on user subscription and trigger source */}
        <div
          className={`flex gap-4 ${hasPaidSubscription || !shouldShowCreditPacks ? 'justify-center' : ''}`}
        >
          {(!hasPaidSubscription || !shouldShowCreditPacks) && (
            <PlusPlanCard selectedId={selectedId} onSelect={handleSelect} />
          )}
          {shouldShowCreditPacks && (
            <CreditPacksCard selectedId={selectedId} onSelect={handleSelect} />
          )}
        </div>

        {/* Action buttons */}
        <div
          className={`flex gap-3 pt-4 border-t border-black/[0.06] mx-auto ${showBothCards ? 'w-1/2' : 'w-full'}`}
        >
          <Button
            className="flex-1 h-11 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:!bg-gray-50 hover:!border-gray-300 hover:!text-gray-900"
            onClick={handleClose}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            className="flex-1 h-11 text-sm font-semibold rounded-lg bg-gray-900 border-none text-white hover:!bg-gray-800"
            onClick={handleBuyNow}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Spin size="small" />
                <span>{t('common.loading')}</span>
              </div>
            ) : (
              t('subscription.creditPacks.buyNow')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

CreditInsufficientModal.displayName = 'CreditInsufficientModal';
