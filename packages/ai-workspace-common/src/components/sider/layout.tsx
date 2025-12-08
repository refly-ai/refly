import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Button, Layout, Divider } from 'antd';
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import cn from 'classnames';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
// components
import { useTranslation } from 'react-i18next';
import { SettingModal } from '@refly-packages/ai-workspace-common/components/settings';
import { InvitationModal } from '@refly-packages/ai-workspace-common/components/settings/invitation-modal';
import { StorageExceededModal } from '@refly-packages/ai-workspace-common/components/subscription/storage-exceeded-modal';
// hooks
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { SettingsModalActiveTab, useSiderStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useGetAuthConfig } from '@refly-packages/ai-workspace-common/queries';
import {
  File,
  Project,
  Flow,
  Contact,
  SideRight,
  SideLeft,
  Settings,
  MarketPlace,
} from 'refly-icons';
import { ContactUsPopover } from '@refly-packages/ai-workspace-common/components/contact-us-popover';
import InviteIcon from '@refly-packages/ai-workspace-common/assets/invite-sider.svg';
import GiftPromotionIcon from '@refly-packages/ai-workspace-common/assets/community.svg';
import { useKnowledgeBaseStoreShallow, useUserStoreShallow } from '@refly/stores';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';

import './layout.scss';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { RightOutlined, ArrowRightOutlined } from '@ant-design/icons';
const Sider = Layout.Sider;

// Reusable section header component
const SiderSectionHeader = ({
  icon,
  title,
  onActionClick,
  actionIcon,
  isActive = false,
  collapsed = false,
}: {
  icon: React.ReactNode;
  title: string;
  onActionClick?: () => void;
  actionIcon?: React.ReactNode;
  isActive?: boolean;
  collapsed?: boolean;
}) => {
  return (
    <div
      className={cn(
        'w-full h-[42px] p-2 flex items-center justify-between text-refly-text-0 group select-none rounded-xl cursor-pointer transition-all duration-300',
        isActive ? 'bg-refly-tertiary-hover' : 'hover:bg-refly-tertiary-hover',
      )}
      onClick={!actionIcon ? onActionClick : undefined}
      title={collapsed ? title : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex-shrink-0 flex items-center">{icon}</div>
        <span
          className={cn(
            'truncate transition-all duration-300',
            isActive ? 'font-semibold' : 'font-normal',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
          )}
        >
          {title}
        </span>
      </div>
      {actionIcon && onActionClick && (
        <Button
          type="text"
          size="small"
          className={cn(
            'box-border px-1 text-refly-text-0 transition-opacity duration-200',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-0 group-hover:opacity-100',
          )}
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
  onCollapseClick?: (nextCollapsed: boolean) => void;
  collapsed?: boolean;
}) => {
  const { navigate, showCollapseButton = false, onCollapseClick, collapsed = false } = props;

  return (
    <div className={cn('flex items-center mb-6 gap-2 justify-between transition-all duration-300')}>
      <div className="flex items-center gap-2 px-1 flex-shrink-0">
        {collapsed && showCollapseButton ? (
          <div className="group relative w-8 h-8">
            <div className="group-hover:opacity-0 transition-opacity duration-200">
              <Logo
                onClick={() => navigate?.('/')}
                logoProps={{ show: true }}
                textProps={{ show: false }}
              />
            </div>
            <Button
              type="text"
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-refly-text-0 hover:bg-refly-tertiary-hover"
              icon={<SideRight size={20} />}
              onClick={() => onCollapseClick?.(false)}
            />
          </div>
        ) : (
          <Logo
            onClick={() => navigate?.('/')}
            logoProps={collapsed ? { show: true } : undefined}
            textProps={collapsed ? { show: false } : undefined}
          />
        )}
        <div
          className={cn(
            'transition-all duration-300',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
          )}
        >
          {!collapsed && <GithubStar />}
        </div>
      </div>
      {showCollapseButton && !collapsed && (
        <div className="transition-all duration-300 flex-shrink-0">
          <Button
            type="text"
            className="w-8 h-8 text-refly-text-0 hover:bg-refly-tertiary-hover"
            icon={<SideLeft size={20} />}
            onClick={() => onCollapseClick?.(true)}
          />
        </div>
      )}
    </div>
  );
};

export const PromotionItem = React.memo(
  ({
    collapsed = false,
    promotionUrl,
  }: {
    collapsed?: boolean;
    promotionUrl: string;
  }) => {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
      window.open(promotionUrl, '_blank', 'noopener,noreferrer');
    }, [promotionUrl]);

    if (collapsed) {
      return null;
    }

    return (
      <div
        className={cn(
          'w-[240px] flex flex-col cursor-pointer rounded-[20px] bg-gradient-to-b from-[#9810FA] to-[#FFFFFF] p-4 transition-all duration-500 shadow-lg',
        )}
        onClick={handleClick}
        data-cy="promotion-menu-item"
      >
        {/* Header with gift icon and title */}
        <div className="flex items-center gap-1">
          <div className="flex-shrink-0">
            <img src={GiftPromotionIcon} className="w-12 h-15" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline flex-wrap">
              <span className="text-[20px] font-regular text-white">
                {t('common.promotion.title')}
              </span>
              <span className="text-[25px] font-regular text-[#FFE066]">
                {t('common.promotion.discount')}
              </span>
              <span className="text-[20px] font-regular text-white">
                {t('common.promotion.titleSuffix')}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-white/80 mb-2 leading-relaxed">
          {t('common.promotion.description')}
        </p>

        {/* Tags */}
        <div className="flex gap-2 mb-3">
          <span className="py-1 px-2 rounded-full bg-black/5 text-[12px] font-medium text-white">
            {t('common.promotion.tag1')}
          </span>
          <span className="py-1 px-2 rounded-full bg-black/5 text-[12px] font-medium text-white">
            {t('common.promotion.tag2')}
          </span>
        </div>

        {/* CTA Button */}
        <Button className="w-32 py-2.5 bg-white dark:bg-white !text-[#9810FA] dark:hover:!text-[#9810FA] font-semibold text-sm flex items-center justify-center gap-1 dark:hover:!bg-black/10 transition-colors">
          {t('common.promotion.button')}
          <ArrowRightOutlined />
        </Button>
      </div>
    );
  },
);

export const InvitationItem = React.memo(
  ({
    collapsed = false,
    onClick,
  }: {
    collapsed?: boolean;
    onClick: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <>
        {!collapsed && (
          <div
            className={cn(
              'w-full h-[64px] flex items-center justify-between cursor-pointer rounded-[20px] bg-gradient-to-r from-[#02AE8E] to-[#008AA6] px-1.5 transition-all duration-300',
            )}
            onClick={onClick}
            data-cy="invite-friends-menu-item"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex-shrink-0 flex items-center">
                <img src={InviteIcon} alt="Invite" className="w-7 h-7" />
              </div>
              <div
                className={cn(
                  'flex flex-col leading-tight transition-all duration-300',
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
                )}
              >
                <span className="text-xs font-semibold text-white truncate">
                  {t('common.inviteFriends')}
                </span>
                <span className="text-xs text-white/80 truncate">
                  {t('common.inviteRewardText')}
                </span>
              </div>
            </div>
            <span
              className={cn(
                'text-white text-xs font-semibold leading-none transition-all duration-300',
                collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
              )}
            >
              <RightOutlined />
            </span>
          </div>
        )}
      </>
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
  const { setShowInvitationModal } = useSiderStoreShallow((state) => ({
    setShowInvitationModal: state.setShowInvitationModal,
  }));

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const {
    collapseState,
    setCollapse,
    setShowSettingModal,
    setShowLibraryModal,
    setSettingsModalActiveTab,
    setIsManualCollapse,
  } = useSiderStoreShallow((state) => ({
    collapseState: state.collapseState,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
    setShowLibraryModal: state.setShowLibraryModal,
    showLibraryModal: state.showLibraryModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
    setIsManualCollapse: state.setIsManualCollapse,
  }));

  // Get auth config to determine if invitation feature should be shown
  const { data: authConfig } = useGetAuthConfig();

  const handleCollapseToggle = useCallback(
    (nextCollapsed: boolean) => {
      setCollapse(nextCollapsed);
      setIsManualCollapse(nextCollapsed);
    },
    [setCollapse, setIsManualCollapse],
  );

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
    if (path.startsWith('/canvas/empty') || path === '/workspace') {
      return 'home';
    }
    if (path.startsWith('/workflow-list')) {
      return 'canvas';
    }
    if (path.startsWith('/app-manager')) {
      return 'appManager';
    }
    if (path.startsWith('/marketplace')) {
      return 'marketplace';
    }
    return 'home';
  }, [location.pathname]);

  // Handle invitation button click - show modal directly, codes will be loaded lazily
  const handleInvitationClick = useCallback(() => {
    setShowInvitationModal(true);
  }, [setShowInvitationModal]);

  // Handle settings button click
  const handleSettingsClick = useCallback(() => {
    setShowSettingModal(true);
  }, [setShowSettingModal]);

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
      {
        icon: <MarketPlace key="marketplace" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.marketplace'),
        onActionClick: () => navigate('/marketplace'),
        key: 'marketplace',
      },
    ],
    [t, navigate],
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

  const isCollapsed = useMemo(() => collapseState !== 'expanded', [collapseState]);
  const isHidden = useMemo(() => collapseState === 'hidden', [collapseState]);
  const siderWidth = useMemo(() => {
    if (source !== 'sider') {
      return 248;
    }
    if (isHidden) {
      return 0;
    }
    return isCollapsed ? 48 : 248;
  }, [isCollapsed, isHidden, source]);

  return (
    <div
      className="transition-all duration-500 ease-in-out overflow-hidden"
      style={{
        width: siderWidth,
        height: source === 'sider' ? 'var(--screen-height)' : 'calc(var(--screen-height) - 16px)',
      }}
    >
      <Sider
        width="100%"
        className={cn(
          'bg-transparent',
          source === 'sider'
            ? ''
            : 'rounded-lg border-r border-solid border-[1px] border-refly-Card-Border bg-refly-bg-Glass-content backdrop-blur-md shadow-[0_6px_60px_0px_rgba(0,0,0,0.08)]',
        )}
        style={{
          height: '100%',
          overflow: isHidden ? 'hidden' : undefined,
        }}
      >
        <div className="flex h-full flex-col gap-3 overflow-hidden p-2 pr-0 pt-6">
          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <SiderLogo
              navigate={(path) => navigate(path)}
              showCollapseButton={source === 'sider'}
              onCollapseClick={handleCollapseToggle}
              collapsed={isCollapsed}
            />

            {/* Main menu items */}
            {menuItems.map((item, index) => (
              <SiderSectionHeader
                key={index}
                icon={item.icon}
                title={item.title}
                onActionClick={item.onActionClick}
                isActive={item.key === getActiveKey()} // First item (home) is active when on /canvas/empty
                collapsed={isCollapsed}
              />
            ))}

            <Divider className="m-0 border-refly-Card-Border" />
          </div>

          {/* Promotion entry - show above invitation */}
          <div className="flex flex-col gap-2">
            {!isCollapsed && (
              <PromotionItem
                collapsed={isCollapsed}
                promotionUrl={`${window.location.origin}/activities`}
              />
            )}

            {!!userProfile?.uid &&
              authConfig?.data?.some((item) => item.provider === 'invitation') && (
                <InvitationItem collapsed={isCollapsed} onClick={handleInvitationClick} />
              )}
          </div>

          <div className="p-2 pr-0">
            {/* Contact in collapsed state - above Settings */}
            {isCollapsed &&
              bottomMenuItems.map((item, index) => {
                if (item.key === 'contactUs') {
                  return (
                    <ContactUsPopover
                      key={`bottom-${index}`}
                      open={openContactUs}
                      setOpen={setOpenContactUs}
                    >
                      <div className="h-[26px] pl-0 pr-2 flex items-center cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 mb-2">
                        <Contact key="contactUs" style={{ fontSize: 20 }} />
                      </div>
                    </ContactUsPopover>
                  );
                }
                return null;
              })}

            {/* Settings and Contact in expanded state */}
            <div className="flex items-center gap-2">
              <div
                className="h-[26px] pl-0 pr-2 flex items-center cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                onClick={handleSettingsClick}
                data-cy="settings-menu-item"
              >
                <Settings
                  size={24}
                  className="text-gray-800 dark:text-gray-200"
                  style={{ strokeWidth: '2.5' }}
                />
              </div>
              {!isCollapsed &&
                bottomMenuItems.map((item, index) => {
                  if (item.key === 'contactUs') {
                    return (
                      <ContactUsPopover
                        key={`bottom-${index}`}
                        open={openContactUs}
                        setOpen={setOpenContactUs}
                      >
                        <div className="h-[26px] pl-0 pr-2 flex items-center cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300">
                          <Contact key="contactUs" style={{ fontSize: 20 }} />
                        </div>
                      </ContactUsPopover>
                    );
                  }
                  return null;
                })}
            </div>
          </div>
        </div>
      </Sider>
    </div>
  );
};

export const SiderLayout = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const { showSettingModal, setShowSettingModal, showInvitationModal, setShowInvitationModal } =
    useSiderStoreShallow((state) => ({
      showSettingModal: state.showSettingModal,
      setShowSettingModal: state.setShowSettingModal,
      showInvitationModal: state.showInvitationModal,
      setShowInvitationModal: state.setShowInvitationModal,
    }));

  return (
    <>
      <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      <InvitationModal visible={showInvitationModal} setVisible={setShowInvitationModal} />
      <StorageExceededModal />
      <CanvasTemplateModal />

      {isLogin ? <SiderLoggedIn source={source} /> : <SiderLoggedOut source={source} />}
    </>
  );
};
