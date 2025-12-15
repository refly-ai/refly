import { memo, useMemo, useState, useCallback, useEffect } from 'react';

import { Row, Col, Tag, Tooltip, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';
// styles
import './index.scss';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Checked, Subscription, Wait } from 'refly-icons';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useAuthStoreShallow,
} from '@refly/stores';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { SubscriptionPlanType, Voucher } from '@refly/openapi-schema';
import { SUBSCRIPTION_PRICES } from '@refly-packages/ai-workspace-common/constants/pricing';

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

// Voucher discount tag - orange style
const VoucherTag = memo(
  ({ discountPercent, validDays }: { discountPercent: number; validDays: number }) => {
    const { t } = useTranslation('ui');
    return (
      <div className="flex items-center gap-1.5 bg-[#FC8800] text-[#FEF2CF] px-3 py-1.5 rounded text-sm font-medium">
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path
            d="M13.5 4.5L6.5 11.5L2.5 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {discountPercent}% {t('voucher.off', 'OFF')}
        </span>
        <span className="text-white/40 mx-0.5">|</span>
        <span>{t('voucher.validForDays', 'Valid for {{days}} days', { days: validDays })}</span>
      </div>
    );
  },
);

VoucherTag.displayName = 'VoucherTag';

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
        relative flex-1 px-4 py-2 rounded-xl cursor-pointer transition-all duration-200
        ${
          isSelected
            ? 'border-2 !border-solid !border-black bg-white'
            : 'border-2 !border-solid !border-gray-200 bg-[#FAFAFA] hover:border-[#0E9F77]'
        }
      `}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {type === 'monthly' ? t('subscription.monthly') : t('subscription.yearly')}
        </span>
        {type === 'yearly' && (
          <Tag
            className="!m-0 !px-1.5 !py-0.5 !text-xs !font-medium !rounded-full !border-0"
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
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-normal text-refly-text-0">${price}</span>
        <span className="text-xs text-gray-500">/month</span>
        {type === 'yearly' && yearlyTotal && (
          <span className="text-xs text-gray-500">${yearlyTotal}/year</span>
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
  planType?: string;
  featureIndex?: number;
}

const FeatureItem = memo(
  ({ feature, isEnterprise, isLast, planType, featureIndex }: FeatureItemProps) => {
    const parts = feature.name.split('\n');
    const name = parts[0];
    const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

    // For plus plan, make the 2nd and 3rd description green
    const isGreenDescription =
      planType === 'plus' &&
      featureIndex !== undefined &&
      (featureIndex === 1 || featureIndex === 2);

    // Handle pointFreeTools type with special display logic
    if (feature.type === 'pointFreeTools' && feature.items && feature.items.length > 0) {
      return (
        <div className="flex flex-col gap-2">
          {/* Header with check icon */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Checked size={16} color="#0E9F77" />
            </div>
            <span className="text-sm leading-5 text-gray-900 font-regular">{name}</span>
          </div>
          {/* Sub-items list */}
          <div className="ml-7 rounded-lg bg-transparent flex flex-col gap-2">
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
          <span className="text-sm leading-5 text-refly-text-0 font-normal">
            {name}
            {description && (
              <span
                className={`font-normal ${isGreenDescription ? 'text-green-600' : 'text-refly-text-0'}`}
              >
                : {description}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  },
);

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
  voucher?: Voucher | null;
  voucherValidDays?: number;
}

const PlanItem = memo((props: PlanItemProps) => {
  const { t } = useTranslation('ui');
  const {
    planType,
    title,
    description,
    features,
    handleClick,
    loadingInfo,
    voucher,
    voucherValidDays,
  } = props;
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
  const [isHovered, setIsHovered] = useState(false);
  const isDowngrade =
    PlanPriorityMap[currentPlan as keyof typeof PlanPriorityMap] >
    PlanPriorityMap[planType as keyof typeof PlanPriorityMap];
  const isButtonDisabled = (isCurrentPlan || isDowngrade) && planType !== 'enterprise';

  const priceInfo = SUBSCRIPTION_PRICES[planType as keyof typeof SUBSCRIPTION_PRICES];

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
      return (
        <span className={`text-base font-medium ${isHovered ? 'text-refly-text-2' : ''}`}>
          {t('subscription.plans.currentPlan')}
        </span>
      );
    }
    if (planType === 'free') {
      return t('subscription.plans.free.buttonText');
    }
    if (planType === 'enterprise') {
      return t('subscription.plans.enterprise.buttonText');
    }
    return (
      <span className="flex items-center justify-center gap-2 font-medium">
        <IconLightning01 size={20} color="#0E9F77" />
        {t('subscription.plans.upgrade', {
          planType: planType.charAt(0).toUpperCase() + planType.slice(1),
        })}
      </span>
    );
  }, [loadingInfo, planType, isCurrentPlan, isHovered, t]);

  // Free plan card - simplified version
  if (planType === 'free') {
    return (
      <div
        className="w-full max-w-[532px] p-6 box-border border-1 border-solid border-gray-200 rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)] bg-white"
        style={{
          background: isHovered
            ? 'rgba(244, 244, 244, 0.8)'
            : 'linear-gradient(180deg, rgba(243, 244, 246, 0.6) 0%, #ffffff 30%)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-normal text-refly-text-0">{title}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">{description}</p>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-normal text-refly-text-0">$0</span>
          <span className="text-sm text-gray-500">/month</span>
        </div>

        {/* Button */}
        <button
          type="button"
          className={`
            w-full h-11 rounded-lg text-sm font-semibold transition-all duration-200 !border-[1px] !border-solid !border-gray-200
            ${
              isButtonDisabled
                ? 'bg-gray-100 text-refly-text-0 cursor-pointer'
                : 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer'
            }
          `}
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
        >
          {getButtonText()}
        </button>

        {/* Features */}
        <div className="pt-5 mt-5 border-t border-black/[0.06] flex flex-col gap-4">
          <span className="text-sm font-normal text-refly-text-0">
            {t('subscription.plans.memberBenefits')}
          </span>
          {features.map((feature, index) => (
            <FeatureItem key={index} feature={feature} planType={planType} featureIndex={index} />
          ))}
        </div>
      </div>
    );
  }

  // Paid plan card with pricing options
  return (
    <div
      className="w-full max-w-[532px] p-6 box-border border-1 border-solid border-gray-200 rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)]"
      style={{
        background:
          isCurrentPlan || isUpgrade
            ? 'linear-gradient(180deg, rgba(14, 159, 119, 0.08) 0%, rgba(255, 255, 255, 0) 30%), #ffffff'
            : isHovered
              ? 'linear-gradient(180deg, #A4FFF6, #CFFFD3),  #ffffff'
              : '#ffffff',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Subscription size={20} className="text-gray-900" />
          <span className="text-xl font-normal text-refly-text-0">{title}</span>
          {isCurrentPlan && (
            <Tag className="!m-0 !px-2 !py-0.5 !text-sm !font-light !rounded !bg-gray-100 !text-refly-text-2 !border-gray-200">
              {t('subscription.plans.currentPlan')}
            </Tag>
          )}
        </div>
        {voucher && !isCurrentPlan && voucherValidDays && (
          <VoucherTag discountPercent={voucher.discountPercent} validDays={voucherValidDays} />
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
            w-full h-11 rounded-lg text-sm font-semibold transition-all duration-200 hover:cursor-pointer
            flex items-center justify-center gap-2
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
        <span className="text-sm font-normal text-refly-text-0">
          {t('subscription.plans.memberBenefits')}
        </span>
        {features.map((feature, index) => (
          <FeatureItem
            key={index}
            feature={feature}
            isEnterprise={planType === 'enterprise'}
            isLast={index === features.length - 1}
            planType={planType}
            featureIndex={index}
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
  const {
    setSubscribeModalVisible: setVisible,
    availableVoucher,
    setAvailableVoucher,
    setVoucherLoading,
    userType,
  } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
    availableVoucher: state.availableVoucher,
    setAvailableVoucher: state.setAvailableVoucher,
    setVoucherLoading: state.setVoucherLoading,
    userType: state.userType,
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

  // Calculate voucher valid days
  const voucherValidDays = useMemo(() => {
    if (!availableVoucher?.expiresAt) return 7;
    return Math.max(
      1,
      Math.ceil(
        (new Date(availableVoucher.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
  }, [availableVoucher]);

  // Fetch available vouchers when component mounts
  useEffect(() => {
    if (!isLogin) return;

    const fetchVouchers = async () => {
      setVoucherLoading(true);
      try {
        const response = await getClient().getAvailableVouchers();
        if (response.data?.success && response.data.data?.bestVoucher) {
          setAvailableVoucher(response.data.data.bestVoucher);
        } else {
          setAvailableVoucher(null);
        }
      } catch (error) {
        console.error('Failed to fetch available vouchers:', error);
        setAvailableVoucher(null);
      } finally {
        setVoucherLoading(false);
      }
    };

    fetchVouchers();
  }, [isLogin, setAvailableVoucher, setVoucherLoading]);

  // Report pricing view event when component mounts
  useEffect(() => {
    logEvent('pricing_view', Date.now(), {
      user_plan: currentPlan,
      has_voucher: !!availableVoucher,
      voucher_discount: availableVoucher?.discountPercent,
    });
  }, [currentPlan, availableVoucher]);

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
        // Include voucherId if available
        const body: {
          planType: SubscriptionPlanType;
          interval: SubscriptionInterval;
          voucherId?: string;
        } = {
          planType,
          interval: interval,
        };

        // Validate voucher before creating checkout session
        if (availableVoucher?.voucherId) {
          const validateRes = await getClient().validateVoucher({
            body: { voucherId: availableVoucher.voucherId },
          });

          if (validateRes.data?.data?.valid) {
            body.voucherId = availableVoucher.voucherId;

            // Log voucher applied event
            logEvent('voucher_applied', null, {
              voucher_value: Math.round((100 - availableVoucher.discountPercent) / 10),
              entry_point: 'pricing_page',
              user_type: userType,
            });
          } else {
            // Voucher is invalid - show message and clear it
            const reason = validateRes.data?.data?.reason || 'Voucher is no longer valid';
            message.warning(
              t('voucher.validation.invalid', {
                reason,
                defaultValue: `Your coupon cannot be applied: ${reason}`,
              }),
            );

            // Clear the invalid voucher from store
            setAvailableVoucher(null);

            // Log voucher validation failed event
            logEvent('voucher_validation_failed', null, {
              voucherId: availableVoucher.voucherId,
              reason,
              planType,
              interval,
            });

            // Continue without voucher - user can still proceed with full price
          }
        }

        const res = await getClient().createCheckoutSession({
          body,
        });
        if (res.data?.data?.url) {
          window.location.href = res.data.data.url;
        }
      } catch (error) {
        console.error('Failed to create checkout session:', error);
        message.error(
          t('subscription.checkoutFailed', 'Failed to start checkout. Please try again.'),
        );
      } finally {
        setLoadingInfo({ isLoading: false, plan: '' });
      }
    },
    [loadingInfo.isLoading, availableVoucher, source, setAvailableVoucher, t, userType],
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
                  voucher={availableVoucher}
                  voucherValidDays={voucherValidDays}
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
