import { useState } from 'react';

import { Button, Divider, Tooltip, Row, Col } from 'antd';

// styles
import './index.scss';
import { useTranslation } from 'react-i18next';
import { FaLightbulb } from 'react-icons/fa';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CheckOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { SubscriptionPlanType } from '@refly/openapi-schema';

export type SubscriptionInterval = 'monthly' | 'yearly';
export type PriceSource = 'page' | 'modal';

const premiumModels = 'Claude 3.7 Sonnet (Thinking), DeepSeek R1, o3 Mini, GPT-4o and more';
const basicModels = 'Gemini Flash 2.0, DeepSeek V3, Claude 3.5 Haiku and more';

const gridSpan = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 6,
  xl: 5,
  xxl: 4,
};

interface ModelFeatures {
  name: string;
  count?: string;
  details?: string;
  tooltip?: string;
}

interface Capability {
  before: string;
  highlight: string;
  after: string;
}

const PlanItem = (props: {
  title: SubscriptionPlanType;
  features: ModelFeatures[];
  capabilities: Capability[];
  handleClick?: () => void;
  interval: SubscriptionInterval;
  loadingInfo: {
    isLoading: boolean;
    plan: string;
  };
}) => {
  const { t } = useTranslation();
  const { title, features, capabilities, handleClick, interval, loadingInfo } = props;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const [isHovered, setIsHovered] = useState(false);

  const getPrice = (plan: SubscriptionPlanType) => {
    switch (plan) {
      case 'max':
        return interval === 'monthly' ? 19.9 : 199;
      case 'pro':
        return interval === 'monthly' ? 12.9 : 129;
      case 'plus':
        return interval === 'monthly' ? 6.9 : 69;
      case 'free':
        return 0;
    }
  };

  const getButtonText = (plan: SubscriptionPlanType) => {
    if (isLogin) {
      switch (plan) {
        case 'max':
        case 'pro':
        case 'plus':
          return t('settings.subscription.subscribe.upgrade');
        case 'free':
          return t('settings.subscription.subscribe.continueFree');
        default:
          return t('settings.subscription.getStarted');
      }
    }
    return t('settings.subscription.getStarted');
  };

  const handleButtonClick = () => {
    if (isLogin) {
      handleClick();
    } else {
      setLoginModalOpen(true);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col ${title === 'pro' ? 'pro-plan' : ''}`}>
      <div className="h-[20px] text-center text-xs text-white font-bold">
        {title === 'pro' && t('settings.subscription.mostPopular')}
      </div>
      <div
        className={`
        subscribe-content-plans-item
        ${title === 'free' && 'item-free bg-gray-50 dark:bg-gray-800'}
        ${title === 'plus' && 'item-plus bg-[#E8F4FC] dark:bg-[#1A2A3A]'}
        ${title === 'pro' && 'item-pro bg-green-50 dark:bg-green-900'}
        ${title === 'max' && 'item-max bg-[#FFF5EB] dark:bg-[#33241A]'}
        `}
      >
        <div className="subscribe-content-plans-item-title font-extrabold dark:text-gray-100">
          {t(`settings.subscription.subscriptionStatus.${title}`)}
        </div>

        <div className="description">
          {t(`settings.subscription.subscribe.${title}.description`)}
        </div>

        <div className="h-16">
          <div className="subscribe-content-plans-item-price">
            <span className="price text-3xl dark:text-gray-100">
              {title !== 'free' ? (
                <>
                  $
                  {interval === 'monthly'
                    ? getPrice(title)
                    : Math.round((getPrice(title) / 12) * 10) / 10}
                </>
              ) : (
                t('settings.subscription.subscribe.forFree')
              )}
            </span>
            <span className="text-xs text-[#2c2929] dark:text-gray-200">
              {' '}
              /{' '}
              {title === 'free' ? (
                t('settings.subscription.subscribe.period')
              ) : (
                <span className="whitespace-nowrap">
                  {t('settings.subscription.subscribe.month')}
                </span>
              )}
            </span>
          </div>

          {interval === 'yearly' && title !== 'free' && (
            <div>
              <span className="price text-base">${getPrice(title)}</span>
              <span className="!text-xs !text-[#2c2929] dark:!text-gray-200">
                {' '}
                /{' '}
                <span className="whitespace-nowrap">
                  {t('settings.subscription.subscribe.year')}
                </span>
              </span>
            </div>
          )}
        </div>

        <Button
          className={`subscribe-btn subscribe-btn--${title}`}
          onClick={handleButtonClick}
          loading={loadingInfo.isLoading && loadingInfo.plan === title}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
            <span
              className={`
                inline-flex
                items-center
                justify-center
                w-full
                h-full
                transition-transform duration-300
                absolute
                ${isHovered ? '-translate-y-full' : 'translate-y-0'}
              `}
            >
              {getButtonText(title)}
            </span>
            <span
              className={`
                absolute
                inline-flex
                items-center
                justify-center
                w-full
                h-full
                m-auto
                transition-transform duration-300
                ${isHovered ? 'translate-y-0' : 'translate-y-full'}
              `}
            >
              {getButtonText(title)}
            </span>
          </div>
        </Button>

        <div className="plane-features">
          <Divider className="mt-2 mb-4" />
          {(features || [])?.map((feature, index) => (
            <div className="plane-features-item" key={index}>
              <div className="text-gray-500 dark:text-gray-400">
                <CheckOutlined style={{ color: 'green', strokeWidth: 6 }} /> {feature.name}
                {feature.tooltip && (
                  <Tooltip title={<div>{feature.tooltip}</div>}>
                    <QuestionCircleOutlined className="ml-1" />
                  </Tooltip>
                )}
              </div>
              {feature.count && (
                <div className="ml-4 text-sm text-black font-medium dark:text-gray-100">
                  {feature.count}
                </div>
              )}
              <div className="ml-4 text-xs text-gray-400">{feature.details}</div>
            </div>
          ))}

          <Divider className="my-4" />
          {(capabilities || [])?.map((capability, index) => (
            <div className="py-2 text-gray-600 dark:text-gray-300" key={index}>
              <FaLightbulb className="text-yellow-500 mr-1" size={12} />
              <span>{capability.before}</span>
              <span className="font-bold text-black dark:text-gray-100">
                {capability.highlight}
              </span>
              <span>{capability.after}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PriceContent = (props: { source: PriceSource }) => {
  const navigate = useNavigate();
  const { source } = props;
  const { t } = useTranslation();
  const { setSubscribeModalVisible: setVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const [interval, setInterval] = useState<SubscriptionInterval>('yearly');
  const [loadingInfo, setLoadingInfo] = useState<{
    isLoading: boolean;
    plan: string;
  }>({
    isLoading: false,
    plan: '',
  });

  const t1ModelName = t('settings.subscription.t1Requests');
  const t2ModelName = t('settings.subscription.t2Requests');
  const t1ModalTooltipContent = t('settings.subscription.t1RequestsDescription');
  const t2ModalTooltipContent = t('settings.subscription.t2RequestsDescription');
  const libraryStorage = t('settings.subscription.libraryStorage');
  const libraryTooltipContent = t('settings.subscription.libraryStorageDescription');
  const advancedFileParsing = t('settings.subscription.advancedFileParsing');
  const advancedFileParsingTooltip = t('settings.subscription.advancedFileParsingDescription');
  const fileSizeLimitName = t('settings.subscription.fileSizeLimit');

  const unlimited = t('settings.subscription.subscribe.unlimited');

  const createFeatures = (plan: 'free' | 'plus' | 'pro' | 'max'): ModelFeatures[] => {
    const configs = {
      free: {
        t1Count: 5,
        t2Count: 50,
        fileLimit: 100,
        t1Period: 'daily',
        t2Period: 'daily',
        fileParseLimit: 50,
        fileSizeLimit: 5,
      },
      plus: {
        t1Count: 100,
        t2Count: 1500,
        fileLimit: 200,
        t1Period: 'monthly',
        t2Period: 'monthly',
        fileParseLimit: 100,
        fileSizeLimit: 10,
      },
      pro: {
        t1Count: 300,
        t2Count: 3000,
        fileLimit: 500,
        t1Period: 'monthly',
        t2Period: 'monthly',
        fileParseLimit: 300,
        fileSizeLimit: 20,
      },
      max: {
        t1Count: 600,
        t2Count: 6000,
        fileLimit: 2000,
        t1Period: 'monthly',
        t2Period: 'monthly',
        fileParseLimit: 1000,
        fileSizeLimit: 30,
      },
    };

    const config = configs[plan];
    return [
      ...(config.t1Count !== 0
        ? [
            {
              name: t1ModelName,
              count:
                config.t1Count === -1
                  ? unlimited
                  : t(`settings.subscription.subscribe.${config.t1Period}Counts`, {
                      count: config.t1Count,
                    }),
              details: premiumModels,
              tooltip: t1ModalTooltipContent,
            },
          ]
        : []),
      {
        name: t2ModelName,
        count:
          config.t2Count === -1
            ? unlimited
            : t(`settings.subscription.subscribe.${config.t2Period}Counts`, {
                count: config.t2Count,
              }),
        details: basicModels,
        tooltip: t2ModalTooltipContent,
      },
      {
        name: libraryStorage,
        count: t('settings.subscription.subscribe.fileCounts', { count: config.fileLimit }),
        tooltip: libraryTooltipContent,
      },
      {
        name: advancedFileParsing,
        count: t('settings.subscription.subscribe.dailyPagesCount', {
          count: config.fileParseLimit,
        }),
        tooltip: advancedFileParsingTooltip,
      },
      {
        name: fileSizeLimitName,
        count: t('settings.subscription.subscribe.fileSizeLimit', {
          count: config.fileSizeLimit,
        }),
        tooltip: t('settings.subscription.fileSizeLimitDescription', {
          size: config.fileSizeLimit,
        }),
      },
      {
        name: t(`settings.subscription.subscribe.${plan}.serviceSupport.name`),
        count: t(`settings.subscription.subscribe.${plan}.serviceSupport.details`),
      },
    ];
  };

  const freeFeatures = createFeatures('free');
  const plusFeatures = createFeatures('plus');
  const proFeatures = createFeatures('pro');
  const maxFeatures = createFeatures('max');

  const freeCapabilities = t('priceContent.freeCapabilities', {
    returnObjects: true,
  }) as Capability[];
  const premiumCapabilities = t('priceContent.premiumCapabilities', {
    returnObjects: true,
  }) as Capability[];

  const createCheckoutSession = async (plan: SubscriptionPlanType) => {
    if (loadingInfo.isLoading) return;
    setLoadingInfo({
      isLoading: true,
      plan,
    });
    const { data } = await getClient().createCheckoutSession({
      body: {
        planType: plan,
        interval: interval,
      },
    });
    setLoadingInfo({
      isLoading: false,
      plan: '',
    });

    if (data?.data?.url) {
      window.location.href = data.data.url;
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
            <span>{t('settings.subscription.subscribe.yearly')}</span>
          </div>

          <div
            className={`subscribe-content-type-inner-item ${interval === 'monthly' ? 'active' : ''}`}
            onClick={() => setInterval('monthly')}
          >
            {t('settings.subscription.subscribe.monthly')}
          </div>
        </div>
      </div>

      <Row gutter={[4, 4]} className="subscribe-content-plans" justify="center" align="stretch">
        <Col {...gridSpan}>
          <PlanItem
            title="free"
            features={freeFeatures}
            capabilities={freeCapabilities}
            handleClick={() => {
              isLogin
                ? source === 'modal'
                  ? setVisible(false)
                  : navigate('/', { replace: true })
                : setLoginModalOpen(true);
            }}
            interval={interval}
            loadingInfo={loadingInfo}
          />
        </Col>

        <Col {...gridSpan}>
          <PlanItem
            title="plus"
            features={plusFeatures}
            capabilities={premiumCapabilities}
            handleClick={() => createCheckoutSession('plus')}
            interval={interval}
            loadingInfo={loadingInfo}
          />
        </Col>

        <Col {...gridSpan}>
          <PlanItem
            title="pro"
            features={proFeatures}
            capabilities={premiumCapabilities}
            handleClick={() => createCheckoutSession('pro')}
            interval={interval}
            loadingInfo={loadingInfo}
          />
        </Col>

        <Col {...gridSpan}>
          <PlanItem
            title="max"
            features={maxFeatures}
            capabilities={premiumCapabilities}
            handleClick={() => createCheckoutSession('max')}
            interval={interval}
            loadingInfo={loadingInfo}
          />
        </Col>
      </Row>

      {isLogin && (
        <div className="subscribe-content-description">
          {t('settings.subscription.subscribe.description')}{' '}
          <a href="https://docs.refly.ai/about/privacy-policy" target="_blank" rel="noreferrer">
            {t('settings.subscription.subscribe.privacy')}
          </a>{' '}
          {t('settings.subscription.subscribe.and')}{' '}
          <a href="https://docs.refly.ai/about/terms-of-service" target="_blank" rel="noreferrer">
            {t('settings.subscription.subscribe.terms')}
          </a>
        </div>
      )}
    </div>
  );
};
