import { memo, useMemo, useState, useCallback } from 'react';

import { Row, Col, Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';
// styles
import './index.scss';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Checked, Wait } from 'refly-icons';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useAuthStoreShallow,
} from '@refly/stores';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { SubscriptionPlanType } from '@refly/openapi-schema';

export type SubscriptionInterval = 'monthly' | 'yearly';
export type PriceSource = 'page' | 'modal';

const gridSpan = {
  xs: 24,
  sm: 24,
  md: 12,
  lg: 12,
  xl: 12,
  xxl: 12,
};

interface Feature {
  name: string;
  type?: string;
  items?: string[];
  duration?: string;
}

enum PlanPriorityMap {
  free = 0,
  plus = 1,
  starter = 1,
  maker = 2,
  enterprise = 3,
}

// Price option card for monthly/yearly selection
interface PriceOptionProps {
  type: 'monthly' | 'yearly';
  isSelected: boolean;
  price: number;
  yearlyTotal?: number;
  onSelect: (type: 'monthly' | 'yearly') => void;
}

const PriceOption = memo(({ type, isSelected, price, yearlyTotal, onSelect }: PriceOptionProps) => {
  const { t } = useTranslation('ui');

  const handleClick = useCallback(() => {
    onSelect(type);
  }, [type, onSelect]);

  return (
    <div
      className={`
        relative flex-1 p-4 rounded-xl cursor-pointer transition-all duration-200
        ${
          isSelected
            ? 'border-2 border-[#0E9F77] bg-white'
            : 'border-[1.5px] border-gray-200 bg-[#FAFAFA] hover:border-[#0E9F77]'
        }
      `}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base font-medium text-gray-900">
          {type === 'monthly' ? t('subscription.monthly') : t('subscription.yearly')}
        </span>
        {type === 'yearly' && (
          <Tag className="!m-0 !px-2 !py-0.5 !text-xs !font-medium !rounded" color="orange">
            {t('subscription.save20')}
          </Tag>
        )}
        {isSelected && (
          <div className="ml-auto w-5 h-5 bg-[#0E9F77] rounded-full flex items-center justify-center">
            <Checked size={12} color="#fff" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">${price}</span>
        <span className="text-sm text-gray-500">/month</span>
        {type === 'yearly' && yearlyTotal && (
          <span className="text-sm text-gray-500">${yearlyTotal}/year</span>
        )}
      </div>
    </div>
  );
});

PriceOption.displayName = 'PriceOption';

// Feature item component
interface FeatureItemProps {
  feature: Feature;
  isEnterprise?: boolean;
  isLast?: boolean;
}

const FeatureItem = memo(({ feature, isEnterprise, isLast }: FeatureItemProps) => {
  const parts = feature.name.split('\n');
  const name = parts[0];
  const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

  // Handle pointFreeTools type with special display logic
  if (feature.type === 'pointFreeTools' && feature.items && feature.items.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {/* Header with check icon */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Checked size={16} color="#0E9F77" />
          </div>
          <span className="text-sm leading-5 text-gray-900 font-semibold">{name}</span>
        </div>
        {/* Sub-items list */}
        <div className="ml-7 p-3 rounded-lg bg-transparent flex flex-col gap-2">
          {feature.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F77] flex-shrink-0" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
              {feature.duration && (
                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded">
                  {feature.duration}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {isEnterprise && isLast ? (
          <Wait size={16} color="rgba(28, 31, 35, 0.6)" />
        ) : (
          <Checked size={16} color="#0E9F77" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm leading-5 text-gray-900 font-semibold">
          {name}
          {description && <span className="font-normal text-gray-500"> {description}</span>}
        </span>
      </div>
    </div>
  );
});

FeatureItem.displayName = 'FeatureItem';

interface PlanItemProps {
  planType: string;
  title: string;
  description: string;
  features: Feature[];
  handleClick?: (interval: SubscriptionInterval) => void;
  loadingInfo: {
    isLoading: boolean;
    plan: string;
  };
}

const PlanItem = memo((props: PlanItemProps) => {
  const { t } = useTranslation('ui');
  const { planType, title, description, features, handleClick, loadingInfo } = props;
  const [interval, setInterval] = useState<SubscriptionInterval>('monthly');

  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const currentPlan: string = userProfile?.subscription?.planType || 'free';
  const isCurrentPlan = currentPlan === planType;
  const upgradePlan =
    PlanPriorityMap[PlanPriorityMap[currentPlan as keyof typeof PlanPriorityMap] + 1] ||
    'enterprise';
  const isUpgrade = upgradePlan === planType;
  const isDowngrade =
    PlanPriorityMap[currentPlan as keyof typeof PlanPriorityMap] >
    PlanPriorityMap[planType as keyof typeof PlanPriorityMap];
  const isButtonDisabled = (isCurrentPlan || isDowngrade) && planType !== 'enterprise';

  // Price data
  const prices = useMemo(
    () =>
      ({
        plus: { monthly: 19.9, yearly: 15.9, yearlyTotal: 190 },
        starter: { monthly: 24.9, yearly: 19.9, yearlyTotal: 238.8 },
        maker: { monthly: 49.9, yearly: 39.9, yearlyTotal: 478.8 },
      }) as const,
    [],
  );

  const priceInfo = prices[planType as keyof typeof prices];

  const handleIntervalChange = useCallback((newInterval: 'monthly' | 'yearly') => {
    setInterval(newInterval);
  }, []);

  const handleButtonClick = useCallback(() => {
    if (isButtonDisabled) return;

    // Track subscription button click event
    logEvent('subscription::price_table_click', 'settings', {
      plan_type: planType,
      interval: interval,
    });

    if (isLogin) {
      handleClick?.(interval);
    } else {
      setLoginModalOpen(true);
    }
  }, [isButtonDisabled, isLogin, planType, interval, handleClick, setLoginModalOpen]);

  const getButtonText = useCallback(() => {
    if (loadingInfo.isLoading && loadingInfo.plan === planType) {
      return (
        <div className="flex items-center justify-center gap-2">
          <Spin size="small" />
          <span>{t('common.loading')}</span>
        </div>
      );
    }
    if (isCurrentPlan) {
      return t('subscription.plans.currentPlan');
    }
    if (planType === 'free') {
      return t('subscription.plans.free.buttonText');
    }
    if (planType === 'enterprise') {
      return t('subscription.plans.enterprise.buttonText');
    }
    return (
      <span className="flex items-center justify-center gap-2">
        <IconLightning01 size={16} />
        {t('subscription.plans.upgrade', {
          planType: planType.charAt(0).toUpperCase() + planType.slice(1),
        })}
      </span>
    );
  }, [loadingInfo, planType, isCurrentPlan, t]);

  // Free plan card - simplified version
  if (planType === 'free') {
    return (
      <div
        className="w-full max-w-[532px] p-6 box-border rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)] bg-white"
        style={{
          background: 'linear-gradient(180deg, rgba(243, 244, 246, 0.6) 0%, #ffffff 30%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-semibold text-gray-900">{title}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">{description}</p>

        {/* Button */}
        <button
          type="button"
          className={`
            w-full h-11 rounded-lg text-sm font-semibold transition-all duration-200
            ${
              isButtonDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }
          `}
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
        >
          {getButtonText()}
        </button>

        {/* Features */}
        <div className="pt-5 mt-5 border-t border-black/[0.06] flex flex-col gap-4">
          <span className="text-sm font-semibold text-gray-900">
            {t('subscription.plans.memberBenefits')}
          </span>
          {features.map((feature, index) => (
            <FeatureItem key={index} feature={feature} />
          ))}
        </div>
      </div>
    );
  }

  // Paid plan card with pricing options
  return (
    <div
      className="w-full max-w-[532px] p-6 box-border rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)]"
      style={{
        background:
          isCurrentPlan || isUpgrade
            ? 'linear-gradient(180deg, rgba(14, 159, 119, 0.08) 0%, rgba(255, 255, 255, 0) 30%), #ffffff'
            : 'linear-gradient(180deg, #1FC99615, #45BEFF10),  #ffffff',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl font-semibold text-gray-900">{title}</span>
        {isCurrentPlan && (
          <Tag className="!m-0 !px-2 !py-0.5 !text-xs !font-medium !rounded !bg-gray-100 !text-gray-600 !border-gray-200">
            {t('subscription.plans.currentPlan')}
          </Tag>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      {/* Price options - Monthly/Yearly toggle inside card */}
      {priceInfo && (
        <div className="flex gap-3 mb-6">
          <PriceOption
            type="monthly"
            isSelected={interval === 'monthly'}
            price={priceInfo.monthly}
            onSelect={handleIntervalChange}
          />
          <PriceOption
            type="yearly"
            isSelected={interval === 'yearly'}
            price={priceInfo.yearly}
            yearlyTotal={priceInfo.yearlyTotal}
            onSelect={handleIntervalChange}
          />
        </div>
      )}

      {/* Button */}
      <Tooltip
        title={
          isButtonDisabled && !isCurrentPlan
            ? "Legacy plans can't be switched to Plus directly.\n\nPlease contact support@refly.ai"
            : undefined
        }
        placement="top"
      >
        <button
          type="button"
          className={`
            w-full h-11 rounded-lg text-sm font-semibold transition-all duration-200
            ${
              isButtonDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : loadingInfo.isLoading && loadingInfo.plan === planType
                  ? 'bg-gray-800 text-white cursor-not-allowed opacity-80'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
            }
          `}
          onClick={handleButtonClick}
          disabled={isButtonDisabled || (loadingInfo.isLoading && loadingInfo.plan === planType)}
        >
          {getButtonText()}
        </button>
      </Tooltip>

      {/* Features */}
      <div className="pt-5 mt-5 border-t border-black/[0.06] flex flex-col gap-4">
        <span className="text-sm font-semibold text-gray-900">
          {t('subscription.plans.memberBenefits')}
        </span>
        {features.map((feature, index) => (
          <FeatureItem
            key={index}
            feature={feature}
            isEnterprise={planType === 'enterprise'}
            isLast={index === features.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

PlanItem.displayName = 'PlanItem';

export const PriceContent = memo((props: { source: PriceSource }) => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const { source } = props;
  const { setSubscribeModalVisible: setVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const currentPlan: string = userProfile?.subscription?.planType || 'free';

  const plansData = useMemo(() => {
    const planTypes = ['free', 'plus'];
    const data: Record<string, { title: string; description: string; features: Feature[] }> = {};
    for (const planType of planTypes) {
      const rawFeatures =
        (t(`subscription.plans.${planType}.features`, { returnObjects: true }) as
          | (string | Feature)[]
          | undefined) || [];
      data[planType] = {
        title: t(`subscription.plans.${planType}.title`),
        description: t(`subscription.plans.${planType}.description`),
        features: rawFeatures.map((feature) => {
          // Handle both string and object format
          if (typeof feature === 'string') {
            return { name: feature };
          }
          return feature as Feature;
        }),
      };
    }
    return data;
  }, [t]);

  const [loadingInfo, setLoadingInfo] = useState<{
    isLoading: boolean;
    plan: string;
  }>({
    isLoading: false,
    plan: '',
  });

  const createCheckoutSession = useCallback(
    async (plan: string, interval: SubscriptionInterval) => {
      if (loadingInfo.isLoading) return;

      const planType = plan as SubscriptionPlanType;

      setLoadingInfo({ isLoading: true, plan });
      try {
        const res = await getClient().createCheckoutSession({
          body: {
            planType,
            interval: interval,
          },
        });
        if (res.data?.data?.url) {
          window.location.href = res.data.data.url;
        }
      } catch (error) {
        console.error('Failed to create checkout session:', error);
      } finally {
        setLoadingInfo({ isLoading: false, plan: '' });
      }
    },
    [loadingInfo.isLoading],
  );

  const handleContactSales = useCallback(() => {
    // Redirect to enterprise version contact form
    window.location.href = 'https://tally.so/r/nWaaav';
  }, []);

  const handleFreeClick = useCallback(() => {
    if (isLogin) {
      if (source === 'modal') {
        setVisible(false);
      } else {
        navigate('/', { replace: true });
      }
    } else {
      setLoginModalOpen(true);
    }
  }, [isLogin, source, setVisible, navigate, setLoginModalOpen]);

  const handlePlanClick = useCallback(
    (planType: string) => (interval: SubscriptionInterval) => {
      if (planType === 'free') {
        handleFreeClick();
      } else if (planType === 'enterprise') {
        handleContactSales();
      } else {
        createCheckoutSession(planType, interval);
      }
    },
    [handleFreeClick, handleContactSales, createCheckoutSession],
  );

  return (
    <div className="subscribe-content w-full">
      <Row gutter={[24, 24]} className="subscribe-content-plans" justify="center" align="stretch">
        {Object.keys(plansData)
          .map((planType) => {
            if (planType === 'free' && currentPlan !== 'free') {
              return null;
            }
            return (
              <Col {...gridSpan} key={planType} className="flex justify-center">
                <PlanItem
                  planType={planType}
                  title={plansData[planType].title}
                  description={plansData[planType].description}
                  features={plansData[planType].features}
                  handleClick={handlePlanClick(planType)}
                  loadingInfo={loadingInfo}
                />
              </Col>
            );
          })
          .filter(Boolean)}
      </Row>

      {/* <div className="credit-packs-section flex justify-center">
        <CreditPacksModal />
      </div>
      */}
      <div className="subscribe-content-description">
        {t('subscription.cancelAnytime')}{' '}
        <a href="https://docs.refly.ai/about/privacy-policy" target="_blank" rel="noreferrer">
          {t('subscription.privacy')}
        </a>{' '}
        {t('common.and')}{' '}
        <a href="https://docs.refly.ai/about/terms-of-service" target="_blank" rel="noreferrer">
          {t('subscription.terms')}
        </a>
      </div>
    </div>
  );
});

PriceContent.displayName = 'PriceContent';
