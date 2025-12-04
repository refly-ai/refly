import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { TemplateCardSkeleton } from '@refly-packages/ai-workspace-common/components/canvas-template/template-card-skeleton';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { DocAdd, ArrowRight, Knowledge } from 'refly-icons';
import { RecentWorkflow } from './recent-workflow';
import { useListCanvasTemplateCategories } from '@refly-packages/ai-workspace-common/queries/queries';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
import { SettingsModalActiveTab } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { SiderMenuSettingList } from '../../sider-menu-setting-list';
import { Subscription, Account } from 'refly-icons';
import { Avatar, Divider } from 'antd';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

// User avatar component for displaying user profile
const UserAvatar = React.memo(
  ({
    showName = true,
    userProfile,
    avatarAlign,
  }: {
    showName?: boolean;
    userProfile?: any;
    avatarAlign: 'left' | 'right';
  }) => (
    <div
      className={
        // biome-ignore lint/style/useTemplate: <explanation>
        'flex items-center gap-2 flex-shrink min-w-0 cursor-pointer ' +
        (avatarAlign === 'left' ? 'mr-2' : 'ml-2')
      }
      title={userProfile?.nickname}
    >
      <Avatar
        size={36}
        src={userProfile?.avatar || defaultAvatar}
        icon={<Account />}
        className="flex-shrink-0 "
      />
      {showName && (
        <span className={cn('inline-block truncate font-semibold text-refly-text-0')}>
          {userProfile?.nickname}
        </span>
      )}
    </div>
  ),
);

// Subscription info component for displaying credit balance and upgrade button
const SubscriptionInfo = React.memo(
  ({
    creditBalance,
    userProfile,
    onCreditClick,
    onSubscriptionClick,
    t,
  }: {
    creditBalance: number | string;
    userProfile?: any;
    onCreditClick: (e: React.MouseEvent) => void;
    onSubscriptionClick: (e: React.MouseEvent) => void;
    t: (key: string) => string;
  }) => {
    if (!subscriptionEnabled) return null;

    return (
      <div
        onClick={onCreditClick}
        className="h-8 p-2 flex items-center gap-1.5 text-refly-text-0 text-xs cursor-pointer
        rounded-[80px] border-[1px] border-solid border-refly-Card-Border bg-refly-bg-content-z2 whitespace-nowrap flex-shrink-0
      "
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Subscription size={14} className="text-[#1C1F23] dark:text-white flex-shrink-0" />
          <span className="font-medium truncate">{creditBalance}</span>
        </div>

        {(!userProfile?.subscription?.planType ||
          userProfile?.subscription?.planType === 'free') && (
          <>
            <Divider type="vertical" className="m-0" />
            <div
              onClick={onSubscriptionClick}
              className="text-refly-primary-default text-xs font-semibold leading-4 whitespace-nowrap truncate"
            >
              {t('common.upgrade')}
            </div>
          </>
        )}
      </div>
    );
  },
);

// Setting item component for user settings
export const SettingItem = React.memo(
  ({
    showName = true,
    avatarAlign = 'left',
  }: { showName?: boolean; avatarAlign?: 'left' | 'right' }) => {
    const { userProfile } = useUserStoreShallow((state) => ({
      userProfile: state.userProfile,
    }));

    const { t } = useTranslation();

    const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();

    const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
      setSubscribeModalVisible: state.setSubscribeModalVisible,
    }));

    const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
      setShowSettingModal: state.setShowSettingModal,
      setSettingsModalActiveTab: state.setSettingsModalActiveTab,
    }));

    const handleSubscriptionClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setSubscribeModalVisible(true);
      },
      [setSubscribeModalVisible],
    );

    const handleCreditClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setSettingsModalActiveTab(SettingsModalActiveTab.Subscription);
        setShowSettingModal(true);
      },
      [setShowSettingModal, setSettingsModalActiveTab],
    );

    const renderSubscriptionInfo = useMemo(() => {
      if (!subscriptionEnabled || !isBalanceSuccess) return null;

      return (
        <SubscriptionInfo
          creditBalance={creditBalance}
          userProfile={userProfile}
          onCreditClick={handleCreditClick}
          onSubscriptionClick={handleSubscriptionClick}
          t={t}
        />
      );
    }, [
      creditBalance,
      userProfile,
      handleCreditClick,
      handleSubscriptionClick,
      t,
      isBalanceSuccess,
    ]);

    const renderUserAvatar = useMemo(
      () => <UserAvatar showName={showName} userProfile={userProfile} avatarAlign={avatarAlign} />,
      [showName, userProfile],
    );

    return (
      <div className="group w-full">
        <SiderMenuSettingList creditBalance={creditBalance}>
          <div className="flex flex-1 items-center justify-between transition-all duration-300">
            <div className="transition-all duration-300 flex-shrink-0 opacity-100 w-auto">
              {renderSubscriptionInfo}
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex-shrink-0 flex items-center">
                {avatarAlign === 'left' && renderUserAvatar}
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <div className="flex-shrink-0 flex items-center">
                {avatarAlign === 'right' && renderUserAvatar}
              </div>
            </div>
          </div>
        </SiderMenuSettingList>
      </div>
    );
  },
);

const TAB_ORDER = [
  'Featured',
  'Sales',
  'Marketing',
  'Research',
  'Support',
  'Content Creation',
  'Business',
  'Education',
  'Development',
  'Design',
] as const;

const ModuleContainer = ({
  title,
  children,
  className,
  handleTitleClick,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
  handleTitleClick?: () => void;
}) => {
  return (
    <div className={cn('flex flex-col gap-4 mb-10', className)}>
      <div className="text-[18px] leading-7 font-semibold text-refly-text-1 flex items-center gap-2 justify-between">
        {title}
        {handleTitleClick && (
          <Button className="!h-8 !w-8 p-0" type="text" size="small" onClick={handleTitleClick}>
            <ArrowRight size={20} />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
};

export const FrontPage = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getCanvasList } = useHandleSiderData();

  const { canvasList, setIsManualCollapse } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    setIsManualCollapse: state.setIsManualCollapse,
  }));
  const canvases = canvasList?.slice(0, 4);

  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas({});

  const { data, isLoading: isLoadingCategories } = useListCanvasTemplateCategories({}, undefined, {
    enabled: true,
  });

  const currentLanguage = i18n.language;
  const [templateCategoryId, setTemplateCategoryId] = useState('');

  // Sort categories according to TAB_ORDER
  const templateCategories = useMemo(() => {
    const categories = [...(data?.data ?? [])].filter((category) => category.name !== 'top_picks');
    return categories.sort((a, b) => {
      // Get English label from labelDict (try 'en' or 'en-US')
      const getEnglishLabel = (category: (typeof categories)[0]) => {
        return category.labelDict?.en ?? category.labelDict?.['en-US'] ?? category.name ?? '';
      };

      const labelA = getEnglishLabel(a);
      const labelB = getEnglishLabel(b);

      // Find index in TAB_ORDER (case-insensitive)
      const indexA = TAB_ORDER.findIndex((order) => order.toLowerCase() === labelA.toLowerCase());
      const indexB = TAB_ORDER.findIndex((order) => order.toLowerCase() === labelB.toLowerCase());

      // If both found, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A found, A comes first
      if (indexA !== -1) {
        return -1;
      }
      // If only B found, B comes first
      if (indexB !== -1) {
        return 1;
      }
      // If neither found, maintain original order
      return 0;
    });
  }, [data?.data]);

  // Set default category when categories are loaded
  useEffect(() => {
    // Only process when loading is complete
    if (!isLoadingCategories) {
      if (templateCategories.length > 0) {
        // If a category is already selected, verify it still exists in the list
        if (templateCategoryId) {
          const categoryExists = templateCategories.some(
            (category) => category.categoryId === templateCategoryId,
          );
          if (!categoryExists) {
            // Selected category no longer exists, reset to default
            setTemplateCategoryId('');
          }
        }

        // Set default category if no category is selected
        if (!templateCategoryId) {
          // Try to find Featured category first
          const featuredCategory = templateCategories.find((category) => {
            const englishLabel =
              category.labelDict?.en ?? category.labelDict?.['en-US'] ?? category.name ?? '';
            return englishLabel.toLowerCase() === 'featured';
          });

          // Helper function to get valid categoryId
          const getValidCategoryId = (category: (typeof templateCategories)[0]): string | null => {
            const id = category?.categoryId;
            // Ensure categoryId is a non-empty string
            return id && typeof id === 'string' && id.trim().length > 0 ? id : null;
          };

          if (featuredCategory) {
            const validId = getValidCategoryId(featuredCategory);
            if (validId) {
              setTemplateCategoryId(validId);
            }
          } else if (templateCategories.length === 1) {
            // If only one category exists, select it automatically
            const validId = getValidCategoryId(templateCategories[0]);
            if (validId) {
              setTemplateCategoryId(validId);
            }
          } else {
            // Select the first category as default
            const validId = getValidCategoryId(templateCategories[0]);
            if (validId) {
              setTemplateCategoryId(validId);
            }
          }
        }
      } else {
        // No categories available, ensure templateCategoryId is empty
        // This will trigger empty state display
        setTemplateCategoryId('');
      }
    }
  }, [templateCategories, templateCategoryId, isLoadingCategories]);

  const handleNewWorkflow = useCallback(() => {
    setIsManualCollapse(false);
    debouncedCreateCanvas();
  }, [debouncedCreateCanvas, setIsManualCollapse]);

  const handleTemplateCategoryClick = useCallback(
    (categoryId: string) => {
      if (categoryId === templateCategoryId) return;
      setTemplateCategoryId(categoryId);
    },
    [templateCategoryId],
  );

  const handleViewAllWorkflows = useCallback(() => {
    navigate('/workflow-list');
  }, [navigate]);

  const handleViewMarketplace = useCallback(() => {
    window.open('/workflow-marketplace', '_blank');
  }, []);

  const handleViewKnowledgeBase = useCallback(() => {
    const isChinese = i18n.language?.startsWith('zh');
    const url = isChinese
      ? 'https://powerformer.feishu.cn/wiki/KrI1wxCKiisumTkOLJbcLeY7nec?fromScene=spaceOverview'
      : 'https://reflydoc.notion.site/how-to-use-refly';
    window.open(url, '_blank');
  }, [i18n.language]);

  useEffect(() => {
    getCanvasList();
  }, []);

  return (
    <div
      className={cn(
        'w-full h-full bg-refly-bg-content-z2 overflow-y-auto p-5 rounded-xl border border-solid border-refly-Card-Border relative',
      )}
      id="front-page-scrollable-div"
    >
      <Helmet>
        <title>{t('loggedHomePage.siderMenu.home')}</title>
      </Helmet>

      <div className="absolute top-4 right-[1px] z-10">
        <SettingItem showName={false} avatarAlign={'right'} />
      </div>

      <ModuleContainer title={t('frontPage.newWorkflow.title')} className="mt-[120px]">
        <div className="flex gap-4">
          <Button
            className="w-fit h-fit flex items-center gap-2  border-[1px] border-solid border-refly-Card-Border rounded-xl p-3 cursor-pointer bg-transparent hover:bg-refly-fill-hover transition-colors"
            onClick={handleNewWorkflow}
            loading={createCanvasLoading}
          >
            <DocAdd size={42} color="var(--refly-primary-default)" />
            <div className="flex flex-col gap-1 w-[184px]">
              <div className="text-left text-base leading-[26px] font-semibold text-refly-text-0">
                {t('frontPage.newWorkflow.buttonText')}
              </div>
              <div className="text-left text-xs text-refly-text-3 leading-4 font-normal">
                {t('frontPage.newWorkflow.buttonDescription')}
              </div>
            </div>
          </Button>
          <Button
            className="w-fit h-fit flex items-center gap-2  border-[1px] border-solid border-refly-Card-Border rounded-xl p-3 cursor-pointer bg-transparent hover:bg-refly-fill-hover transition-colors"
            onClick={handleViewKnowledgeBase}
            loading={createCanvasLoading}
          >
            <Knowledge size={42} color="var(--refly-primary-default)" />
            <div className="flex flex-col gap-1 w-[184px]">
              <div className="text-left text-base leading-[26px] font-semibold text-refly-text-0">
                {t('frontPage.tutorial.buttonText')}
              </div>
              <div className="text-left text-xs text-refly-text-3 leading-4 font-normal">
                {t('frontPage.tutorial.buttonDescription')}
              </div>
            </div>
          </Button>
        </div>
      </ModuleContainer>

      {canvases?.length > 0 && (
        <ModuleContainer
          title={t('frontPage.recentWorkflows.title')}
          handleTitleClick={handleViewAllWorkflows}
        >
          <RecentWorkflow canvases={canvases} />
        </ModuleContainer>
      )}

      {canvasTemplateEnabled && (
        <ModuleContainer
          title={t('frontPage.template.title')}
          handleTitleClick={handleViewMarketplace}
        >
          {templateCategories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {templateCategories.map((category) => (
                <div
                  key={category.categoryId}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-sm leading-5 cursor-pointer rounded-[40px] transition-all duration-300 ease-in-out transform',
                    {
                      '!bg-refly-primary-default text-white font-semibold shadow-sm scale-105':
                        category.categoryId === templateCategoryId,
                      'text-refly-text-0 hover:bg-refly-tertiary-hover hover:scale-[1.02]':
                        category.categoryId !== templateCategoryId,
                    },
                  )}
                  onClick={() => handleTemplateCategoryClick(category.categoryId)}
                >
                  {category.labelDict?.[currentLanguage]}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1">
            {isLoadingCategories ? (
              // Show loading skeleton while categories are being fetched
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TemplateCardSkeleton key={index} />
                ))}
              </div>
            ) : templateCategories.length === 0 ? (
              // Show empty state when no categories are available
              <div className="mt-8 h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-refly-text-2 text-sm mb-2">{t('template.emptyList')}</div>
                  <Button
                    type="default"
                    className="!bg-refly-bg-content-z2 !border-refly-primary-default !text-refly-primary-default !border-[0.5px] !font-medium hover:!border-refly-primary-default hover:!text-refly-primary-default hover:!bg-refly-bg-content-z2 rounded-lg px-3 py-2.5"
                    onClick={handleViewMarketplace}
                  >
                    {t('template.goToMarketplace')}
                  </Button>
                </div>
              </div>
            ) : !templateCategoryId ? (
              // Show loading skeleton if categories exist but none is selected yet
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TemplateCardSkeleton key={index} />
                ))}
              </div>
            ) : templateCategoryId && templateCategoryId.trim().length > 0 ? (
              // Show template list when category is selected and valid
              <TemplateList
                source="front-page"
                scrollableTargetId="front-page-scrollable-div"
                language={currentLanguage}
                categoryId={templateCategoryId}
                className="!bg-transparent !px-0 !pt-0 -ml-2 -mt-2"
              />
            ) : (
              // Fallback: show loading skeleton if categoryId is invalid
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TemplateCardSkeleton key={index} />
                ))}
              </div>
            )}
          </div>
        </ModuleContainer>
      )}
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
