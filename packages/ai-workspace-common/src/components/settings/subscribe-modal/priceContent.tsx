import { useMemo, useState } from 'react';

import { Row, Col, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';
// styles
import './index.scss';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Checked, Wait } from 'refly-icons';
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
  sm: 12,
  md: 12,
  lg: 6,
  xl: 6,
  xxl: 6,
};

interface Feature {
  name: string;
  type?: string;
}

enum PlanPriorityMap {
  free = 0,
  plus = 1,
  starter = 1,
  maker = 2,
  enterprise = 3,
}

const PlanItem = (props: {
  planType: string;
  title: string;
  description: string;
  features: Feature[];
  handleClick?: () => void;
  interval: SubscriptionInterval;
  loadingInfo: {
    isLoading: boolean;
    plan: string;
  };
}) => {
  const { t, i18n } = useTranslation('ui');
  const { planType, title, description, features, handleClick, interval, loadingInfo } = props;
  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const currentPlan: string = userProfile?.subscription?.planType || 'free';

  const getPrice = () => {
    if (planType === 'free') {
      return (
        <div className="yearly-price-container">
          <span className="price-monthly">&nbsp;</span>
          <span className="price-yearly">&nbsp;</span>
        </div>
      );
    }

    if (planType === 'enterprise') {
      return (
        <div className="yearly-price-container">
          <span className="price-monthly">&nbsp;</span>
          <span className="price-yearly">&nbsp;</span>
        </div>
      );
    }

    const prices = {
      plus: { monthly: 19.9, yearly: 15.9, yearlyTotal: 190.8 },
      starter: { monthly: 24.9, yearly: 19.9, yearlyTotal: 238.8 },
      maker: { monthly: 49.9, yearly: 39.9, yearlyTotal: 478.8 },
    } as const;

    const priceInfo = prices[planType as keyof typeof prices];

    if (interval === 'monthly') {
      return (
        <div className="yearly-price-container">
          <span className="price-monthly">
            {t('subscription.plans.priceMonthly', { price: priceInfo.monthly })}
          </span>
          <span className="price-yearly">&nbsp;</span>
        </div>
      );
    }

    return (
      <div className="yearly-price-container">
        <span className="price-monthly">
          {t('subscription.plans.priceYearly', { price: priceInfo.yearly })}
        </span>
        <span className="price-yearly">
          {t('subscription.plans.priceYearlyTotal', { price: priceInfo.yearlyTotal })}
        </span>
      </div>
    );
  };

  const isCurrentPlan = currentPlan === planType;
  const upgradePlan =
    PlanPriorityMap[PlanPriorityMap[currentPlan as keyof typeof PlanPriorityMap] + 1] ||
    'enterprise';

  const isUpgrade = upgradePlan === planType;
  const isDowngrade =
    PlanPriorityMap[currentPlan as keyof typeof PlanPriorityMap] >
    PlanPriorityMap[planType as keyof typeof PlanPriorityMap];
  const isButtonDisabled = (isCurrentPlan || isDowngrade) && planType !== 'enterprise';

  const isHighlight =
    (planType === 'starter' && currentPlan === 'free') ||
    (planType === currentPlan && currentPlan !== 'free');

  const handleButtonClick = () => {
    if (isButtonDisabled) return;

    // Track subscription button click event
    logEvent('subscription::price_table_click', 'settings', {
      plan_type: planType,
      interval: interval,
    });

    if (isLogin) {
      handleClick?.();
    } else {
      setLoginModalOpen(true);
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col ${isHighlight ? 'pro-plan bg-[var(--bg-control---refly-bg-control-z0,_#F6F6F6)]' : ''}`}
    >
      <div
        className={
          'pt-1 h-[24px] text-center text-xs font-bold text-[color:var(--primary---refly-primary-default,#0E9F77)] leading-4'
        }
      >
        {isHighlight &&
          (currentPlan === 'free'
            ? t('subscription.mostPopular')
            : t('subscription.plans.currentPlan'))}
      </div>
      <div className={`subscribe-content-plans-item item-${planType}`}>
        <div className="subscribe-content-plans-item-title">
          {planType === 'free' ? <>{t('subscription.plans.free.title')} </> : <>{title}</>}
        </div>

        <div
          className={`description ${i18n.language === 'en' || i18n.language.startsWith('en-') ? 'description-en' : ''}`}
        >
          {description}
        </div>

        <div className="price-section">{getPrice()}</div>

        <div
          className={`subscribe-btn cursor-pointer subscribe-btn--${planType} ${planType === 'starter' && 'subscribe-btn--most-popular'} ${isUpgrade && 'subscribe-btn--upgrade'} ${isButtonDisabled && 'subscribe-btn--disabled'} ${loadingInfo.isLoading && loadingInfo.plan === planType && 'subscribe-btn--loading'}`}
          onClick={handleButtonClick}
        >
          {loadingInfo.isLoading && loadingInfo.plan === planType ? (
            <div className="flex items-center justify-center gap-2">
              <Spin size="small" />
              <span>{t('common.loading')}</span>
            </div>
          ) : isCurrentPlan ? (
            t('subscription.plans.currentPlan')
          ) : planType === 'free' ? (
            t('subscription.plans.free.buttonText')
          ) : planType === 'enterprise' ? (
            t('subscription.plans.enterprise.buttonText')
          ) : (
            t('subscription.plans.upgrade', {
              planType: planType.charAt(0).toUpperCase() + planType.slice(1),
            })
          )}
        </div>

        <div className="plane-features">
          {features.map((feature, index) => {
            const parts = feature.name.split('\n');
            const name = parts[0];
            const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

            return (
              <div className="plane-features-item" key={index}>
                <div style={{ marginTop: !description ? 2 : 0 }}>
                  {planType === 'enterprise' && index === features.length - 1 ? (
                    <Wait size={16} color="rgba(28, 31, 35, 0.6)" />
                  ) : (
                    <Checked size={16} color="#0E9F77" />
                  )}
                </div>
                <div className="plane-features-item-text">
                  <span className={!description ? 'feature-description' : 'feature-name'}>
                    {name}
                  </span>
                  {description && <span className="feature-description">{description}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const PriceContent = (props: { source: PriceSource }) => {
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
    const planTypes = ['free', 'plus', 'starter', 'maker', 'enterprise'];
    const data: Record<string, { title: string; description: string; features: Feature[] }> = {};
    for (const planType of planTypes) {
      data[planType] = {
        title: t(`subscription.plans.${planType}.title`),
        description: t(`subscription.plans.${planType}.description`),
        features: (
          (t(`subscription.plans.${planType}.features`, { returnObjects: true }) as string[]) || []
        ).map((name) => ({ name })),
      };
    }
    return data;
  }, [t]);

  const [interval, setInterval] = useState<SubscriptionInterval>('yearly');
  const [loadingInfo, setLoadingInfo] = useState<{
    isLoading: boolean;
    plan: string;
  }>({
    isLoading: false,
    plan: '',
  });

  const createCheckoutSession = async (plan: string) => {
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
  };

  const handleContactSales = () => {
    // Redirect to enterprise version contact form
    window.location.href = 'https://tally.so/r/nWaaav';
  };

  const handleFreeClick = () => {
    if (isLogin) {
      if (source === 'modal') {
        setVisible(false);
      } else {
        navigate('/', { replace: true });
      }
    } else {
      setLoginModalOpen(true);
    }
  };

  return (
    <div className="subscribe-content w-full">
      <div className="subscribe-content-type">
        <div className="subscribe-content-type-inner">
          <div
            className={`subscribe-content-type-inner-item ${interval === 'yearly' ? 'active' : ''}`}
            onClick={() => setInterval('yearly')}
          >
            <span>{t('subscription.yearly')}</span>{' '}
            <Tag color="orange">{t('subscription.save20')}</Tag>
          </div>

          <div
            className={`subscribe-content-type-inner-item ${interval === 'monthly' ? 'active' : ''}`}
            onClick={() => setInterval('monthly')}
          >
            {t('subscription.monthly')}
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]} className="subscribe-content-plans" justify="center" align="stretch">
        {Object.keys(plansData)
          .map((planType) => {
            if (planType === 'free' && currentPlan !== 'free') {
              return null;
            }
            return (
              <Col {...gridSpan} key={planType}>
                <PlanItem
                  planType={planType}
                  title={plansData[planType].title}
                  description={plansData[planType].description}
                  features={plansData[planType].features}
                  handleClick={() => {
                    if (planType === 'free') {
                      handleFreeClick();
                    } else if (planType === 'enterprise') {
                      handleContactSales();
                    } else {
                      createCheckoutSession(planType);
                    }
                  }}
                  interval={interval}
                  loadingInfo={loadingInfo}
                />
              </Col>
            );
          })
          .filter(Boolean)}
      </Row>

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
};
