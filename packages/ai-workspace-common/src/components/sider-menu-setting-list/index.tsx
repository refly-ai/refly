import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Divider, Avatar } from 'antd';
import { useUserStore } from '@refly/stores';
import { useSiderStoreShallow } from '@refly/stores';
import { useLogout } from '@refly-packages/ai-workspace-common/hooks/use-logout';
import { useThemeStoreShallow } from '@refly/stores';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsModalActiveTab } from '@refly/stores';
import { FaDiscord } from 'react-icons/fa6';
import {
  Settings,
  Subscription,
  InterfaceDark,
  InterfaceLight,
  ArrowRight,
  Exit,
  Parse,
  Account,
} from 'refly-icons';
import './index.scss';
import React from 'react';
import { TFunction } from 'i18next';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { UserSettings } from '@refly/openapi-schema';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

// Reusable dropdown item component
const DropdownItem = React.memo(
  ({
    icon,
    children,
  }: {
    icon: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </div>
  ),
);

// Subscription card component
const SubscriptionCard = React.memo(
  ({
    planType,
    creditBalance,
    t,
    setOpen,
    handleSubscriptionClick,
  }: {
    planType: string;
    creditBalance: number;
    t: TFunction;
    setOpen: (open: boolean) => void;
    handleSubscriptionClick: () => void;
  }) => {
    const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
      setSubscribeModalVisible: state.setSubscribeModalVisible,
    }));

    return (
      <div className="subscription-card p-3 shadow-refly-m rounded-lg border-solid border-[1px] border-refly-Card-Border bg-refly-bg-float-z3">
        <div className="flex items-center justify-between gap-2 text-refly-text-0 text-xs leading-4 font-semibold">
          {planType === 'free'
            ? t('subscription.subscriptionManagement.planNames.freePlan')
            : t(`subscription.plans.${planType}.title`)}
          {planType === 'free' && (
            <Button
              type="primary"
              size="small"
              className="h-5 py-0.5 px-2 text-xs leading-4"
              onClick={() => {
                setOpen(false);
                setSubscribeModalVisible(true);
              }}
            >
              {t('subscription.subscriptionManagement.upgradePlan')}
            </Button>
          )}
        </div>
        <Divider className="my-2" />
        <div className="flex items-center justify-between gap-2 text-refly-text-0 text-xs leading-4">
          <div className="flex items-center gap-1">
            <Subscription size={14} />
            {t('subscription.subscriptionManagement.remainingCredits')}
          </div>
          <Button
            type="text"
            size="small"
            className="h-5 py-0.5 px-1 text-xs leading-4"
            onClick={handleSubscriptionClick}
          >
            {creditBalance}
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>
    );
  },
);

interface UserInfoProps {
  userProfile: UserSettings;
  t: TFunction;
  handleSubscriptionClick: () => void;
  setOpen: (open: boolean) => void;
  creditBalance: number;
}

// User info component
const UserInfo = React.memo(
  ({ userProfile, t, handleSubscriptionClick, setOpen, creditBalance }: UserInfoProps) => {
    const planType = userProfile?.subscription?.planType || 'free';
    const nickname = userProfile?.nickname || 'No nickname';
    const email = userProfile?.email || 'No email';

    return (
      <div className="py-2 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Avatar icon={<Account />} src={userProfile?.avatar || defaultAvatar} size={36} />

          <div>
            <div className="max-w-40 text-sm font-semibold text-refly-text-0 leading-5 truncate">
              {nickname}
            </div>
            <div className="max-w-40 text-xs text-refly-text-2 leading-4 truncate">
              {email ?? 'No email provided'}
            </div>
          </div>
        </div>
        <SubscriptionCard
          planType={planType}
          creditBalance={creditBalance}
          t={t}
          setOpen={setOpen}
          handleSubscriptionClick={handleSubscriptionClick}
        />
      </div>
    );
  },
);

// Theme appearance item component
const ThemeAppearanceItem = React.memo(({ themeMode, t }: { themeMode: string; t: TFunction }) => (
  <div className="flex items-center gap-2">
    {themeMode === 'dark' ? <InterfaceDark size={18} /> : <InterfaceLight size={18} />}
    <div className="flex flex-1 items-center justify-between gap-1">
      <span>{t('loggedHomePage.siderMenu.systemTheme')}</span>
      <ArrowRight size={16} />
    </div>
  </div>
));

interface SiderMenuSettingListProps {
  creditBalance: number;
  children: React.ReactNode;
}

export const SiderMenuSettingList = (props: SiderMenuSettingListProps) => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  // Check if user is logged in by checking if userProfile exists and has email
  const isLoggedIn = !!userStore?.userProfile?.email;

  const [open, setOpen] = useState(false);
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));
  const { handleLogout, contextHolder } = useLogout();
  const { themeMode, setThemeMode, setLoggedIn, initTheme } = useThemeStoreShallow((state) => ({
    themeMode: state.themeMode,
    setThemeMode: state.setThemeMode,
    setLoggedIn: state.setLoggedIn,
    initTheme: state.initTheme,
  }));

  // Initialize theme based on login status
  useEffect(() => {
    setLoggedIn(isLoggedIn);
    initTheme();
  }, [isLoggedIn, setLoggedIn, initTheme]);

  // Handle menu item clicks
  const handleSettingsClick = useCallback(() => {
    setShowSettingModal(true);
  }, [setShowSettingModal]);

  const handleSubscriptionClick = useCallback(() => {
    setOpen(false);
    setSettingsModalActiveTab(SettingsModalActiveTab.Subscription);
    setShowSettingModal(true);
  }, [setSettingsModalActiveTab, setShowSettingModal]);

  const handleLogoutClick = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const handleDiscordClick = useCallback(() => {
    window.open('https://discord.gg/YVuYFjFvRC', '_blank');
  }, []);

  // Theme mode options
  const themeOptions = useMemo(
    () => [
      {
        key: 'light',
        label: t('settings.appearance.lightMode'),
        icon: <InterfaceLight size={18} />,
        active: themeMode === 'light',
      },
      {
        key: 'dark',
        label: t('settings.appearance.darkMode'),
        icon: <InterfaceDark size={18} />,
        active: themeMode === 'dark',
      },
      {
        key: 'system',
        label: t('settings.appearance.systemMode'),
        icon: <Parse size={18} />,
        active: themeMode === 'system',
      },
    ],
    [themeMode, t],
  );

  const handleThemeModeChange = useCallback(
    (mode: 'light' | 'dark' | 'system') => {
      setThemeMode(mode);
    },
    [setThemeMode],
  );

  // Theme dropdown items
  const themeDropdownItems = useMemo(
    () => [
      {
        key: 'theme-submenu',
        type: 'group' as const,
        className: 'theme-dropdown-submenu',
        children: themeOptions.map((option) => ({
          key: option.key,
          label: <DropdownItem icon={option.icon}>{option.label}</DropdownItem>,
          onClick: () => handleThemeModeChange(option.key as 'light' | 'dark' | 'system'),
          className: option.active ? 'bg-refly-bg-content-z1' : '',
        })),
      },
    ],
    [themeOptions, handleThemeModeChange],
  );

  // Main dropdown items
  const dropdownItems = useMemo(
    () => [
      {
        key: 'user-info',
        type: 'group' as const,
        children: [
          {
            key: 'user-header',
            className: 'user-header',
            label: (
              <UserInfo
                userProfile={userStore?.userProfile}
                t={t}
                handleSubscriptionClick={handleSubscriptionClick}
                setOpen={setOpen}
                creditBalance={props.creditBalance}
              />
            ),
            disabled: true,
          },
        ],
      },

      {
        key: 'settings',
        label: (
          <DropdownItem icon={<Settings size={18} />}>
            {t('loggedHomePage.siderMenu.settings')}
          </DropdownItem>
        ),
        onClick: handleSettingsClick,
      },
      {
        key: 'appearance',
        type: 'submenu' as const,
        label: <ThemeAppearanceItem themeMode={themeMode} t={t} />,
        children: themeDropdownItems,
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'discord',
        label: (
          <DropdownItem icon={<FaDiscord size={18} />}>
            {t('landingPage.footer.contactUs.joinDiscordGroup')}
          </DropdownItem>
        ),
        onClick: handleDiscordClick,
      },
      {
        key: 'logout',
        label: (
          <DropdownItem icon={<Exit size={18} />}>
            {t('loggedHomePage.siderMenu.logout')}
          </DropdownItem>
        ),
        onClick: handleLogoutClick,
      },
    ],
    [
      userStore?.userProfile,
      props.creditBalance,
      t,
      handleSettingsClick,
      themeMode,
      themeDropdownItems,
      handleDiscordClick,
      handleLogoutClick,
    ],
  );

  return (
    <div>
      <Dropdown
        menu={{ items: dropdownItems }}
        trigger={['click']}
        placement="bottom"
        overlayClassName="sider-menu-setting-list-dropdown"
        arrow={false}
        open={open}
        onOpenChange={setOpen}
        align={{
          offset: [-8, 4],
        }}
      >
        {props.children}
      </Dropdown>
      {contextHolder}
    </div>
  );
};
