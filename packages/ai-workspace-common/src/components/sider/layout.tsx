import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { Avatar, Button, Divider, Layout } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import cn from 'classnames';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
// components
import { useTranslation } from 'react-i18next';
import { SiderMenuSettingList } from '../sider-menu-setting-list';
import { SettingModal } from '@refly-packages/ai-workspace-common/components/settings';
import { StorageExceededModal } from '@refly-packages/ai-workspace-common/components/subscription/storage-exceeded-modal';
// hooks
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { SettingsModalActiveTab, useSiderStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import {
  Account,
  File,
  Project,
  Flow,
  Subscription,
  Contact,
  SideRight,
  SideLeft,
} from 'refly-icons';
import { ContactUsPopover } from '@refly-packages/ai-workspace-common/components/contact-us-popover';

import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';

import './layout.scss';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';

import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

const Sider = Layout.Sider;

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

// Reusable section header component
const SiderSectionHeader = ({
  icon,
  title,
  onActionClick,
  actionIcon,
  isActive = false,
}: {
  icon: React.ReactNode;
  title: string;
  onActionClick?: () => void;
  actionIcon?: React.ReactNode;
  isActive?: boolean;
}) => {
  return (
    <div
      className={cn(
        'w-full h-[42px] p-2 flex items-center justify-between text-refly-text-0 group select-none rounded-xl cursor-pointer',
        isActive ? 'bg-refly-tertiary-hover' : 'hover:bg-refly-tertiary-hover',
      )}
      onClick={!actionIcon ? onActionClick : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon}
        <span className={cn('truncate', isActive ? 'font-semibold' : 'font-normal')}>{title}</span>
      </div>
      {actionIcon && onActionClick && (
        <Button
          type="text"
          size="small"
          className="box-border px-1 text-refly-text-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          icon={actionIcon}
          onClick={(e) => {
            e.stopPropagation();
            onActionClick();
          }}
        />
      )}
    </div>
  );
};

export const SiderLogo = (props: {
  navigate?: (path: string) => void;
  showCollapseButton?: boolean;
  onCollapseClick?: () => void;
}) => {
  const { navigate, showCollapseButton = false, onCollapseClick } = props;

  return (
    <div className={cn('flex items-center mb-6 gap-2 justify-between')}>
      <div className="flex items-center gap-2">
        <Logo onClick={() => navigate?.('/')} />
        <GithubStar />
      </div>
      {showCollapseButton && (
        <Button
          type="text"
          size="small"
          className="text-refly-text-0 hover:bg-refly-tertiary-hover"
          icon={<SideLeft size={16} />}
          onClick={onCollapseClick}
        />
      )}
    </div>
  );
};

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
          <div className="flex flex-1 items-center justify-between">
            {avatarAlign === 'left' && (
              <>
                {renderUserAvatar}
                {renderSubscriptionInfo}
              </>
            )}

            {avatarAlign === 'right' && (
              <>
                {renderSubscriptionInfo}
                {renderUserAvatar}
              </>
            )}
          </div>
        </SiderMenuSettingList>
      </div>
    );
  },
);

const SiderLoggedIn = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateLibraryModalActiveKey } = useKnowledgeBaseStoreShallow((state) => ({
    updateLibraryModalActiveKey: state.updateLibraryModalActiveKey,
  }));

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const {
    collapse,
    setCollapse,
    setShowSettingModal,
    setShowLibraryModal,
    setSettingsModalActiveTab,
  } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
    setShowLibraryModal: state.setShowLibraryModal,
    showLibraryModal: state.showLibraryModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  useHandleSiderData(true);

  const [openContactUs, setOpenContactUs] = useState(false);

  const { t } = useTranslation();

  const location = useLocation();

  const canvasId = location.pathname.split('/').pop();

  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: null,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

  const getActiveKey = useCallback(() => {
    const path = location.pathname;
    if (path.startsWith('/canvas/empty')) {
      return 'home';
    }
    if (path.startsWith('/workflow-list')) {
      return 'canvas';
    }
    if (path.startsWith('/app-manager')) {
      return 'appManager';
    }
    return 'home';
  }, [location.pathname]);

  // Menu items configuration
  const menuItems = useMemo(
    () => [
      {
        icon: <File key="home" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.home'),
        onActionClick: () => navigate('/'),
        key: 'home',
      },
      {
        icon: <Flow key="canvas" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.canvas'),
        onActionClick: () => navigate('/workflow-list'),
        key: 'canvas',
      },
      {
        icon: <Project key="appManager" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.appManager'),
        onActionClick: () => navigate('/app-manager'),
        key: 'appManager',
      },
    ],
    [t, navigate, setShowLibraryModal],
  );

  const bottomMenuItems = useMemo(
    () => [
      {
        icon: <Contact key="contactUs" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.contactUs'),
        key: 'contactUs',
        onActionClick: undefined,
      },
    ],
    [t],
  );

  // Handle library modal opening from URL parameter
  useEffect(() => {
    const shouldOpenLibrary = searchParams.get('openLibrary');
    const shouldOpenSettings = searchParams.get('openSettings');
    const settingsTab = searchParams.get('settingsTab');

    if (shouldOpenLibrary === 'true' && userProfile?.uid) {
      if (canvasId && canvasId !== 'empty') {
        setShowLibraryModal(true);
      } else {
        debouncedCreateCanvas();
      }

      // Remove the parameter from URL
      searchParams.delete('openLibrary');
      const newSearch = searchParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      updateLibraryModalActiveKey('resource');
    }

    if (shouldOpenSettings === 'true' && userProfile?.uid) {
      setShowSettingModal(true);
      // Remove the parameter from URL
      searchParams.delete('openSettings');
      searchParams.delete('settingsTab');
      const newSearch = searchParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      if (settingsTab) {
        setSettingsModalActiveTab(settingsTab as SettingsModalActiveTab);
      }
    }
  }, [
    searchParams,
    userProfile?.uid,
    setShowLibraryModal,
    setShowSettingModal,
    setSettingsModalActiveTab,
    debouncedCreateCanvas,
    canvasId,
    updateLibraryModalActiveKey,
  ]);

  return (
    <Sider
      width={source === 'sider' ? (collapse ? 0 : 248) : 248}
      className={cn(
        'bg-transparent',
        source === 'sider'
          ? ''
          : 'rounded-lg border-r border-solid border-[1px] border-refly-Card-Border bg-refly-bg-Glass-content backdrop-blur-md shadow-[0_6px_60px_0px_rgba(0,0,0,0.08)]',
      )}
      style={{
        height: source === 'sider' ? 'var(--screen-height)' : 'calc(var(--screen-height) - 16px)',
      }}
    >
      <div className="flex h-full flex-col gap-3 overflow-hidden p-4 pr-2 pt-6">
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <SiderLogo
            navigate={(path) => navigate(path)}
            showCollapseButton={source === 'sider'}
            onCollapseClick={() => setCollapse(true)}
          />

          {/* Main menu items */}
          {menuItems.map((item, index) => (
            <SiderSectionHeader
              key={index}
              icon={item.icon}
              title={item.title}
              onActionClick={item.onActionClick}
              isActive={item.key === getActiveKey()} // First item (home) is active when on /canvas/empty
            />
          ))}

          <Divider className="m-0 border-refly-Card-Border" />

          {/* Bottom menu items */}
          {bottomMenuItems.map((item, index) => {
            if (item.key === 'contactUs') {
              return (
                <ContactUsPopover
                  key={`bottom-${index}`}
                  open={openContactUs}
                  setOpen={setOpenContactUs}
                >
                  <SiderSectionHeader
                    icon={item.icon}
                    title={item.title}
                    onActionClick={item.onActionClick}
                    isActive={openContactUs}
                  />
                </ContactUsPopover>
              );
            }
            return (
              <SiderSectionHeader
                key={`bottom-${index}`}
                icon={item.icon}
                title={item.title}
                onActionClick={item.onActionClick}
                isActive={item.key === getActiveKey()}
              />
            );
          })}
        </div>

        {!!userProfile?.uid && (
          <div
            className="flex h-12 items-center justify-between cursor-pointer hover:bg-refly-tertiary-hover rounded-md px-2"
            data-cy="settings-menu-item"
          >
            <SettingItem />
          </div>
        )}
      </div>
    </Sider>
  );
};

// Floating expand button component for when sider is collapsed
const FloatingExpandButton = React.memo(() => {
  const { setCollapse } = useSiderStoreShallow((state) => ({
    setCollapse: state.setCollapse,
  }));

  return (
    <div className="fixed left-4 top-6 z-50">
      <Button
        type="text"
        size="small"
        className="bg-white dark:bg-gray-800 shadow-lg border border-refly-Card-Border text-refly-text-0 hover:bg-refly-tertiary-hover"
        icon={<SideRight size={16} className="" />}
        onClick={() => setCollapse(false)}
      />
    </div>
  );
});

export const SiderLayout = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { collapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
  }));
  const pathParams = useMatch('/canvas/:canvasId');
  const isWorkflowDetail = pathParams?.params?.canvasId && pathParams?.params?.canvasId !== 'empty';

  const { showSettingModal, setShowSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    setShowSettingModal: state.setShowSettingModal,
  }));

  return (
    <>
      <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      <StorageExceededModal />
      <CanvasTemplateModal />

      {/* Show floating expand button when sider is collapsed and user is logged in */}
      {isLogin && source === 'sider' && collapse && !isWorkflowDetail && <FloatingExpandButton />}

      {isLogin ? <SiderLoggedIn source={source} /> : <SiderLoggedOut source={source} />}
    </>
  );
};
