import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { DocAdd, ArrowRight } from 'refly-icons';
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

  const { data } = useListCanvasTemplateCategories({}, undefined, {
    enabled: true,
  });
  const showTemplateCategories = false;
  const templateCategories = [
    { categoryId: '', labelDict: { en: 'All', 'zh-CN': '全部' } },
    ...(data?.data ?? []),
  ];

  const templateLanguage = i18n.language;
  const [templateCategoryId, setTemplateCategoryId] = useState('');

  const handleNewWorkflow = useCallback(() => {
    setIsManualCollapse(false);
    debouncedCreateCanvas();
  }, [debouncedCreateCanvas, setIsManualCollapse]);

  const handleTemplateCategoryClick = useCallback(
    (categoryId: string) => {
      setTemplateCategoryId(categoryId);
    },
    [setTemplateCategoryId],
  );

  const handleViewAllWorkflows = useCallback(() => {
    navigate('/workflow-list');
  }, [navigate]);

  const handleViewMarketplace = useCallback(() => {
    window.open('/workflow-marketplace', '_blank');
  }, []);

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

      <div className="absolute top-4 right-4 z-10">
        <SettingItem showName={false} avatarAlign={'right'} />
      </div>

      <ModuleContainer title={t('frontPage.newWorkflow.title')} className="mt-[120px]">
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
          {showTemplateCategories && templateCategories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              {templateCategories.map((category) => (
                <div
                  key={category.categoryId}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-sm text-refly-text-0 leading-5 cursor-pointer rounded-[40px] hover:bg-refly-tertiary-hover',
                    {
                      '!bg-refly-primary-default text-white font-semibold':
                        category.categoryId === templateCategoryId,
                    },
                  )}
                  onClick={() => handleTemplateCategoryClick(category.categoryId)}
                >
                  {category.labelDict?.[templateLanguage]}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1">
            <TemplateList
              source="front-page"
              scrollableTargetId="front-page-scrollable-div"
              language={templateLanguage}
              categoryId={templateCategoryId}
              className="!bg-transparent !px-0 !pt-0 -ml-2 -mt-2"
            />
          </div>
        </ModuleContainer>
      )}
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
