import { useMemo, useEffect, useCallback } from 'react';
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
import { SearchQuickOpenBtn } from '@refly-packages/ai-workspace-common/components/search-quick-open-btn';
import { useTranslation } from 'react-i18next';
import { SiderMenuSettingList } from '../sider-menu-setting-list';
import { SettingModal } from '@refly-packages/ai-workspace-common/components/settings';
import { TourModal } from '@refly-packages/ai-workspace-common/components/tour-modal';
import { SettingsGuideModal } from '@refly-packages/ai-workspace-common/components/settings-guide';
import { StorageExceededModal } from '@refly-packages/ai-workspace-common/components/subscription/storage-exceeded-modal';
// hooks
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { SettingsModalActiveTab, useSiderStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { Account, File, Project, Flow, KnowledgeBase, Subscription, Contact } from 'refly-icons';

import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';

const Sider = Layout.Sider;

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
      onClick={!actionIcon && onActionClick ? onActionClick : undefined}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-normal">{title}</span>
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
}) => {
  const { navigate } = props;

  return (
    <div className={cn('flex items-center mb-6 gap-2 justify-between')}>
      <div className="flex items-center gap-2">
        <Logo onClick={() => navigate?.('/')} />
        <GithubStar />
      </div>
    </div>
  );
};

const SettingItem = () => {
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
    [setSubscribeModalVisible],
  );

  return (
    <div className="group w-full">
      <SiderMenuSettingList creditBalance={creditBalance}>
        <div className="flex flex-1 items-center justify-between">
          <div
            className="flex items-center gap-2 mr-2 flex-shrink min-w-0"
            title={userProfile?.nickname}
          >
            <Avatar
              size={36}
              src={userProfile?.avatar}
              icon={<Account />}
              className="flex-shrink-0"
            />
            <span className={cn('inline-block truncate font-semibold text-refly-text-0')}>
              {userProfile?.nickname}
            </span>
          </div>

          {subscriptionEnabled && isBalanceSuccess && (
            <div
              onClick={handleCreditClick}
              className="h-8 p-2 flex items-center gap-1.5 text-refly-text-0 text-xs cursor-pointer
            rounded-[80px] border-[1px] border-solid border-refly-Card-Border bg-refly-bg-content-z2 whitespace-nowrap flex-shrink-0
            "
            >
              <div className="flex items-center gap-1">
                <Subscription size={14} className="text-[#1C1F23] dark:text-white" />
                <span className="font-medium">{creditBalance}</span>
              </div>

              {(!userProfile?.subscription?.planType ||
                userProfile?.subscription?.planType === 'free') && (
                <>
                  <Divider type="vertical" className="m-0" />

                  <div
                    onClick={handleSubscriptionClick}
                    className="text-[color:var(--primary---refly-primary-default,#0E9F77)] text-xs font-semibold leading-4 whitespace-nowrap"
                  >
                    {t('common.upgrade')}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </SiderMenuSettingList>
    </div>
  );
};

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

  const { collapse, setShowSettingModal, setShowLibraryModal, setSettingsModalActiveTab } =
    useSiderStoreShallow((state) => ({
      collapse: state.collapse,
      setShowSettingModal: state.setShowSettingModal,
      setShowLibraryModal: state.setShowLibraryModal,
      showLibraryModal: state.showLibraryModal,
      setSettingsModalActiveTab: state.setSettingsModalActiveTab,
    }));

  useHandleSiderData(true);

  const { t } = useTranslation();

  const location = useLocation();

  const canvasId = location.pathname.split('/').pop();

  // Check if current route matches /canvas/empty
  const isCanvasEmpty = !!useMatch('/canvas/empty');
  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: null,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

  // Menu items configuration
  const menuItems = useMemo(
    () => [
      {
        icon: <File key="home" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.home'),
        onActionClick: () => navigate('/'),
      },
      {
        icon: <Flow key="canvas" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.canvas'),
        onActionClick: () => navigate('/workflow-list'),
      },
      {
        icon: <Project key="appManager" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.appManager'),
        onActionClick: () => navigate('/app-manager'),
      },
      {
        icon: <KnowledgeBase key="library" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.library'),
        onActionClick: () => setShowLibraryModal(true),
      },
    ],
    [t, navigate, setShowLibraryModal],
  );

  const bottomMenuItems = useMemo(
    () => [
      {
        icon: <Contact key="contactUs" style={{ fontSize: 20 }} />,
        title: t('loggedHomePage.siderMenu.contactUs'),
        onActionClick: () => setShowLibraryModal(true),
      },
    ],
    [t, setShowLibraryModal],
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
          ? 'h-[100vh]'
          : 'h-[calc(100vh-16px)] rounded-lg border-r border-solid border-[1px] border-refly-Card-Border bg-refly-bg-Glass-content backdrop-blur-md shadow-[0_6px_60px_0px_rgba(0,0,0,0.08)]',
      )}
    >
      <div className="flex h-full flex-col gap-3 overflow-hidden p-4 pr-2 pt-6">
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <SiderLogo navigate={(path) => navigate(path)} />

          <SearchQuickOpenBtn className="mb-1" />

          {/* Main menu items */}
          {menuItems.map((item, index) => (
            <SiderSectionHeader
              key={index}
              icon={item.icon}
              title={item.title}
              onActionClick={item.onActionClick}
              isActive={index === 0 && isCanvasEmpty} // First item (home) is active when on /canvas/empty
            />
          ))}

          <Divider className="m-0 border-refly-Card-Border" />

          {/* Bottom menu items */}
          {bottomMenuItems.map((item, index) => (
            <SiderSectionHeader
              key={`bottom-${index}`}
              icon={item.icon}
              title={item.title}
              onActionClick={item.onActionClick}
            />
          ))}
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

export const SiderLayout = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const isProject = useMatch('/project/:projectId');
  const projectId = location.pathname.split('/').pop();
  const { showSettingModal, setShowSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    setShowSettingModal: state.setShowSettingModal,
  }));

  return (
    <>
      <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      <SettingsGuideModal />
      <TourModal />
      <StorageExceededModal />
      <CanvasTemplateModal />

      {isLogin ? (
        isProject ? (
          <ProjectDirectory projectId={projectId} source={source} />
        ) : (
          <SiderLoggedIn source={source} />
        )
      ) : (
        <SiderLoggedOut source={source} />
      )}
    </>
  );
};
