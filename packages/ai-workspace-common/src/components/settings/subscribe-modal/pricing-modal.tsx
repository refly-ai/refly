import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Button } from 'antd';
import { logEvent } from '@refly/telemetry-web';
import { Checked, Subscription } from 'refly-icons';
import { IconLightning01 } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useAuthStoreShallow,
} from '@refly/stores';
import { SubscriptionPlanType } from '@refly/openapi-schema';

export type SubscriptionInterval = 'monthly' | 'yearly';

interface PricingModalProps {
  mode?: 'modal' | 'page';
  onCancel?: () => void;
}

interface Feature {
  name: string;
  type?: string;
  items?: string[];
  duration?: string;
}

// Feature item component with checkmark
const FeatureItem = memo(
  ({
    children,
    green,
    highlightCredits,
  }: {
    children: React.ReactNode;
    green?: boolean;
    highlightCredits?: boolean;
  }) => {
    // Function to highlight credit numbers in text
    const renderContent = () => {
      if (!highlightCredits || typeof children !== 'string') {
        return children;
      }

      // Match patterns like "2,000 points" or "2,000 bonus credits"
      const regex = /([\d,]+\s*(?:points|bonus credits|积分))/gi;
      const parts = children.split(regex);

      return parts.map((part, index) => {
        // Check if this part matches the pattern
        if (/([\d,]+\s*(?:points|bonus credits|积分))/i.test(part)) {
          return (
            <span key={index} className="text-[#00968F]">
              {part}
            </span>
          );
        }
        return part;
      });
    };

    return (
      <div className="flex items-start gap-2">
        <Checked size={20} color="#0E9F77" className="flex-shrink-0 mt-0.5" />
        <span
          className={`text-[14px] font-semibold leading-[21px] text-[#1C1F23] ${green ? 'text-[#0E9F77]' : ''}`}
        >
          {renderContent()}
        </span>
      </div>
    );
  },
);

FeatureItem.displayName = 'FeatureItem';

// Point-free tool item
const PointFreeToolItem = memo(({ name, days }: { name: string; days: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="w-[5px] h-[5px] rounded-full bg-[#0E9F77]" />
        <span className="text-sm text-[#0A0A0A]">{name}</span>
      </div>
      <span className="text-xs text-[#1C1F23] bg-[#EAF4FF] px-2.5 py-1 rounded font-medium">
        {days} {t('subscription.days', 'DAYS')}
      </span>
    </div>
  );
});

PointFreeToolItem.displayName = 'PointFreeToolItem';

// Voucher discount tag
const VoucherTag = memo(
  ({ discountPercent, validDays }: { discountPercent: number; validDays: number }) => {
    const { t } = useTranslation();
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

// Billing option button
interface BillingOptionProps {
  type: 'monthly' | 'yearly';
  isSelected: boolean;
  price: number;
  originalPrice?: number;
  yearlyPrice?: number;
  discountPercent?: number;
  onSelect: (type: 'monthly' | 'yearly') => void;
}

const BillingOption = memo(
  ({
    type,
    isSelected,
    price,
    originalPrice,
    yearlyPrice,
    discountPercent,
    onSelect,
  }: BillingOptionProps) => {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
      onSelect(type);
    }, [type, onSelect]);

    // Calculate discounted price if voucher exists
    const displayPrice = discountPercent ? price * (1 - discountPercent / 100) : price;

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex-1 rounded-xl p-4 text-left transition-all bg-white cursor-pointer ${
          isSelected ? 'border-[1.5px] border-[#1C1F23]' : 'border border-black/10'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold leading-[21px] text-[#0A0A0A]">
              {type === 'monthly'
                ? t('subscription.monthly', 'Monthly')
                : t('subscription.yearly', 'Yearly')}
            </span>
            {type === 'yearly' && (
              <span className="bg-[#FEF2CF] text-[#FC8800] text-xs px-2 py-0.5 rounded-full font-medium">
                {t('subscription.save20', 'Save 20%')}
              </span>
            )}
          </div>
          {isSelected && (
            <div className="w-[18px] h-[18px] rounded-full bg-[#0E9F77] flex items-center justify-center">
              <Checked size={12} color="#fff" />
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold ${isSelected ? 'text-[#FC8800]' : 'text-[#1C1F23]'}`}
          >
            ${displayPrice.toFixed(1)}
          </span>
          {type === 'monthly' && originalPrice && (
            <span className="text-[#1C1F23]/60 line-through text-sm">
              ${originalPrice}/{t('subscription.monthUnit', 'month')}
            </span>
          )}
          {type === 'yearly' && (
            <>
              <span className="text-[#1C1F23]/60 text-sm">
                /{t('subscription.monthUnit', 'month')}
              </span>
              {yearlyPrice && (
                <span className="text-[#1C1F23]/60 line-through text-sm">
                  ${yearlyPrice}/{t('subscription.yearUnit', 'year')}
                </span>
              )}
            </>
          )}
        </div>
      </button>
    );
  },
);

BillingOption.displayName = 'BillingOption';

export const PricingModal = memo(({ mode = 'modal', onCancel }: PricingModalProps) => {
  const { t } = useTranslation();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const {
    setSubscribeModalVisible,
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

  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));

  const currentPlan = userProfile?.subscription?.planType || 'free';

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

  // Price data
  const prices = useMemo(
    () => ({
      monthly: 19.9,
      yearly: 15.9,
      yearlyTotal: 190,
    }),
    [],
  );

  // Point-free tools data
  const pointFreeTools = useMemo(
    () => [
      { name: 'Gemini 3.0 Nano Banana pro', days: 356 },
      { name: 'Seedream 4.0', days: 356 },
      { name: 'Seedance 1.5', days: 356 },
      { name: 'VibeVoice', days: 356 },
      { name: 'Instagram', days: 356 },
      { name: 'TikTok', days: 356 },
      { name: 'Reddit', days: 356 },
      { name: 'X', days: 356 },
    ],
    [],
  );

  // Features list
  const features = useMemo(() => {
    const rawFeatures =
      (t('subscription.plans.plus.features', { returnObjects: true }) as
        | (string | Feature)[]
        | undefined) || [];
    return rawFeatures.map((feature) => {
      if (typeof feature === 'string') {
        return { name: feature };
      }
      return feature as Feature;
    });
  }, [t]);

  const handleBillingChange = useCallback((type: 'monthly' | 'yearly') => {
    setBillingPeriod(type);
  }, []);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      setSubscribeModalVisible(false);
    }
  }, [onCancel, setSubscribeModalVisible]);

  const handleGetPlus = useCallback(async () => {
    if (isLoading) return;

    // Track subscription button click event
    logEvent('subscription::price_table_click', 'settings', {
      plan_type: 'plus',
      interval: billingPeriod,
      has_voucher: !!availableVoucher,
    });

    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const body: {
        planType: SubscriptionPlanType;
        interval: SubscriptionInterval;
        voucherId?: string;
      } = {
        planType: 'plus',
        interval: billingPeriod,
      };

      // Validate voucher before creating checkout session
      if (availableVoucher?.voucherId) {
        const validateRes = await getClient().validateVoucher({
          body: { voucherId: availableVoucher.voucherId },
        });

        if (validateRes.data?.data?.valid) {
          body.voucherId = availableVoucher.voucherId;

          logEvent('voucher_applied', null, {
            voucher_value: Math.round((100 - availableVoucher.discountPercent) / 10),
            entry_point: 'pricing_page',
            user_type: userType,
          });
        } else {
          const reason = validateRes.data?.data?.reason || 'Voucher is no longer valid';
          message.warning(
            t('voucher.validation.invalid', {
              reason,
              defaultValue: `Your coupon cannot be applied: ${reason}`,
            }),
          );
          setAvailableVoucher(null);

          logEvent('voucher_validation_failed', null, {
            voucherId: availableVoucher.voucherId,
            reason,
            planType: 'plus',
            interval: billingPeriod,
          });
        }
      }

      const res = await getClient().createCheckoutSession({ body });
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      message.error(
        t('subscription.checkoutFailed', 'Failed to start checkout. Please try again.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    isLogin,
    billingPeriod,
    availableVoucher,
    mode,
    setLoginModalOpen,
    setAvailableVoucher,
    t,
  ]);

  // Page mode - full pricing page with Free and Plus cards
  if (mode === 'page') {
    return (
      <div className="w-full max-w-[1100px] mx-auto px-6 py-12">
        {/* Page Header */}
        <h1 className="text-3xl font-bold text-[#1C1F23] text-center mb-10">
          {t('subscription.pageTitle', 'Upgrade your plan to get more points')}
        </h1>

        {/* Cards Container */}
        <div className="flex gap-6 justify-center flex-wrap lg:flex-nowrap">
          {/* Free Plan Card */}
          {currentPlan === 'free' && (
            <div className="w-full max-w-[400px] rounded-[20px] bg-white p-8 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-black/5">
              {/* Free Plan Header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-semibold text-[#1C1F23]">
                  {t('subscription.plans.free.title', 'Free')}
                </span>
                <span className="text-xs text-[#1C1F23] bg-white border border-black/10 px-2.5 py-1 rounded font-medium">
                  {t('subscription.plans.currentPlan', 'Your Current Plan')}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-[#1C1F23]/60 mb-6">
                {t(
                  'subscription.plans.free.description',
                  'Ideal for beginners exploring workflow automation',
                )}
              </p>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-[#1C1F23]">$0</span>
                <span className="text-[#1C1F23]/60">/ month</span>
              </div>

              {/* Current Plan Button */}
              <Button
                disabled
                className="!w-full !py-4 !h-auto !rounded-xl !bg-[#F6F6F6] !text-[#1C1F23] !border !border-black/[0.14] !cursor-default !mb-8 !font-medium"
              >
                {t('subscription.plans.currentPlan', 'Your Current Plan')}
              </Button>

              {/* Member Benefits */}
              <div>
                <h3 className="text-sm font-medium text-[#1C1F23]/60 mb-4">
                  {t('subscription.plans.memberBenefits', 'Member Benefits')}
                </h3>
                <FeatureItem>
                  {t('subscription.plans.free.dailyCredits', 'Daily new credits: 100 points')}
                </FeatureItem>
              </div>
            </div>
          )}

          {/* Plus Plan Card */}
          <div className="w-full max-w-[520px] rounded-[20px] bg-white p-8 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-black/5">
            {/* Plus Plan Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Subscription size={20} className="text-[#1C1F23]" />
                <span className="text-xl font-semibold text-[#1C1F23]">
                  {t('subscription.plans.plus.title', 'Plus')}
                </span>
              </div>
              {availableVoucher && (
                <VoucherTag
                  discountPercent={availableVoucher.discountPercent}
                  validDays={voucherValidDays}
                />
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-[#1C1F23]/60 mb-5">
              {t(
                'subscription.plans.plus.description',
                'Suitable for running a high volume of automation tasks',
              )}
            </p>

            {/* Billing Toggle */}
            <div className="flex gap-3 mb-5">
              <BillingOption
                type="monthly"
                isSelected={billingPeriod === 'monthly'}
                price={prices.monthly}
                originalPrice={availableVoucher ? prices.monthly : undefined}
                discountPercent={availableVoucher?.discountPercent}
                onSelect={handleBillingChange}
              />
              <BillingOption
                type="yearly"
                isSelected={billingPeriod === 'yearly'}
                price={prices.yearly}
                yearlyPrice={prices.yearlyTotal}
                onSelect={handleBillingChange}
              />
            </div>

            {/* Get Plus Button */}
            <button
              type="button"
              onClick={handleGetPlus}
              disabled={isLoading}
              className={`
                w-full h-12 rounded-xl text-sm font-medium transition-all duration-200
                flex items-center justify-center gap-2
                ${isLoading ? 'bg-[#1C1F23] text-white opacity-70 cursor-not-allowed' : 'bg-[#1C1F23] text-white hover:bg-[#1C1F23]/90 cursor-pointer'}
                mb-6
              `}
            >
              {isLoading ? (
                <>
                  <Spin size="small" />
                  <span>{t('common.loading', 'Loading...')}</span>
                </>
              ) : (
                <>
                  <IconLightning01 size={20} color="#0E9F77" />
                  {t('subscription.plans.getPlus', 'Get Plus')}
                </>
              )}
            </button>

            {/* Member Benefits */}
            <div>
              <h3 className="text-sm font-medium text-[#1C1F23]/60 mb-4">
                {t('subscription.plans.memberBenefits', 'Member Benefits')}
              </h3>
              <div className="space-y-3 mb-5">
                {features.slice(0, 5).map((feature, index) => (
                  <FeatureItem key={index}>{feature.name}</FeatureItem>
                ))}
              </div>

              {/* Point-free Tools List */}
              <div className="space-y-2.5 mb-5 pl-7">
                {pointFreeTools.map((tool) => (
                  <PointFreeToolItem key={tool.name} name={tool.name} days={tool.days} />
                ))}
              </div>

              <FeatureItem>
                {t(
                  'subscription.plans.plus.support',
                  'Service support: High-priority email support',
                )}
              </FeatureItem>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[#1C1F23]/60 mt-10">
          {t('subscription.cancelAnytime', 'Cancel anytime.')}{' '}
          <a
            href="https://docs.refly.ai/about/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="text-[#0E9F77] hover:underline"
          >
            {t('subscription.privacy', 'Privacy')}
          </a>{' '}
          {t('common.and', 'and')}{' '}
          <a
            href="https://docs.refly.ai/about/terms-of-service"
            target="_blank"
            rel="noreferrer"
            className="text-[#0E9F77] hover:underline"
          >
            {t('subscription.terms', 'Terms')}
          </a>
        </p>
      </div>
    );
  }

  // Modal mode - compact "Insufficient Credits" modal
  return (
    <div
      className="w-full rounded-[20px] p-10 shadow-[0_6px_60px_rgba(0,0,0,0.08)] backdrop-blur-[20px] border border-black/10"
      style={{ background: 'rgba(255, 255, 255, 0.90)' }}
    >
      {/* Header */}
      <h1 className="text-2xl font-semibold text-[#1C1F23] mb-6">
        {t('subscription.insufficientCredits', 'Insufficient Credits')}
      </h1>

      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          borderRadius: '16px',
          border: '0.5px solid rgba(0, 0, 0, 0.10)',
          background: 'linear-gradient(180deg, rgba(217, 255, 254, 0.50) 0%, #FFF 12.74%)',
        }}
      >
        {/* Plan Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Subscription size={20} className="text-[#1C1F23]" />
            <span className="text-[18px] font-semibold leading-[27px] text-[#1C1F23]">
              {t('subscription.plans.plus.title', 'Plus Plan')}
            </span>
          </div>
          {availableVoucher && (
            <VoucherTag
              discountPercent={availableVoucher.discountPercent}
              validDays={voucherValidDays}
            />
          )}
        </div>

        {/* Billing Toggle */}
        <div className="flex gap-3 mb-6">
          <BillingOption
            type="monthly"
            isSelected={billingPeriod === 'monthly'}
            price={prices.monthly}
            originalPrice={availableVoucher ? prices.monthly : undefined}
            discountPercent={availableVoucher?.discountPercent}
            onSelect={handleBillingChange}
          />
          <BillingOption
            type="yearly"
            isSelected={billingPeriod === 'yearly'}
            price={prices.yearly}
            yearlyPrice={prices.yearlyTotal}
            onSelect={handleBillingChange}
          />
        </div>

        {/* Features List */}
        <div className="space-y-3 mb-6">
          {features.slice(0, 5).map((feature, index) => (
            <FeatureItem key={index} highlightCredits={index === 1 || index === 2}>
              {feature.name}
            </FeatureItem>
          ))}
        </div>

        {/* Point-free Tools List */}
        <div className="space-y-2 mb-6 pl-7">
          {pointFreeTools.map((tool) => (
            <PointFreeToolItem key={tool.name} name={tool.name} days={tool.days} />
          ))}
        </div>

        {/* Service Support */}
        <div>
          <FeatureItem>
            {t('subscription.plans.plus.support', 'Service support: High-priority email support')}
          </FeatureItem>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleCancel}
          className="!w-[166px] !h-9 !rounded-full !text-[#1C1F23] !bg-[#F6F6F6] !border !border-black/[0.14] hover:!bg-[#EBEBEB] !transition-colors !font-medium"
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="primary"
          onClick={handleGetPlus}
          disabled={isLoading}
          className="!w-[166px] !h-9 !rounded-full !bg-[#1C1F23] !text-white hover:!bg-[#1C1F23]/90 !transition-colors !font-medium disabled:!opacity-70 !flex !items-center !justify-center !gap-2"
        >
          {isLoading ? (
            <>
              <Spin size="small" />
              <span>{t('common.loading', 'Loading...')}</span>
            </>
          ) : (
            t('subscription.buyNow', 'Buy Now')
          )}
        </Button>
      </div>
    </div>
  );
});

PricingModal.displayName = 'PricingModal';

export default PricingModal;
