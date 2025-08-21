import { useState, useMemo, useEffect, useCallback } from 'react';
import { Avatar, Button, Divider, Layout, Skeleton } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  Project as IconProject,
  KnowledgeBase as IconKnowledgeBase,
  Subscription,
} from 'refly-icons';
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
import { SettingsModalActiveTab, SiderData, useSiderStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { SideLeft, SideRight, Account } from 'refly-icons';

import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { CreditWelcomeModal } from '@refly-packages/ai-workspace-common/components/credit-welcome-modal';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { logEvent } from '@refly/telemetry-web';

const Sider = Layout.Sider;

// Reusable section header component
const SiderSectionHeader = ({
  icon,
  title,
  onActionClick,
  actionIcon,
}: {
  icon: React.ReactNode;
  title: string;
  onActionClick?: () => void;
  actionIcon?: React.ReactNode;
}) => {
  return (
    <div
      className="h-12 flex items-center justify-between w-full text-refly-text-0 group select-none px-2 py-2 hover:bg-refly-tertiary-hover rounded-md cursor-pointer"
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
  source: 'sider' | 'popover';
  navigate?: (path: string) => void;
  collapse: boolean;
  setCollapse: (collapse: boolean) => void;
}) => {
  const { source, navigate, collapse, setCollapse } = props;

  return (
    <div className={cn('flex items-center mb-6 gap-2', source === 'sider' && 'justify-between')}>
      {source === 'popover' && (
        <Button
          type="text"
          icon={
            collapse ? (
              <SideRight size={20} className="text-refly-text-0" />
            ) : (
              <SideLeft size={20} className="text-refly-text-0" />
            )
          }
          onClick={() => setCollapse(!collapse)}
        />
      )}

      <div className="flex items-center gap-2">
        <Logo onClick={() => navigate?.('/')} />
        <GithubStar />
      </div>

      {source === 'sider' && (
        <Button
          type="text"
          icon={
            collapse ? (
              <SideRight size={20} className="text-refly-text-0" />
            ) : (
              <SideLeft size={20} className="text-refly-text-0" />
            )
          }
          onClick={() => setCollapse(!collapse)}
        />
      )}
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

export const NewCanvasButton = () => {
  const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  return (
    <div className="w-full" onClick={() => debouncedCreateCanvas()}>
      <Button
        className="w-full h-9 border-solid border-[1px] !border-refly-Card-Border bg-refly-bg-control-z1 hover:!bg-refly-tertiary-hover"
        key="newCanvas"
        loading={createCanvasLoading}
        type="default"
      >
        <span className="text-refly-text-0 font-semibold">
          {t('loggedHomePage.siderMenu.newCanvas')}
        </span>
      </Button>
    </div>
  );
};

export const CanvasListItem = ({ canvas }: { canvas: SiderData }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCanvasIdActionDropdown, setShowCanvasIdActionDropdown] = useState<string | null>(null);

  const location = useLocation();
  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);

  const handleUpdateShowStatus = useCallback((canvasId: string | null) => {
    setShowCanvasIdActionDropdown(canvasId);
  }, []);

  return (
    <div
      key={canvas.id}
      className={cn(
        'group relative my-1 px-3 rounded text-sm leading-8 text-refly-text-0 hover:bg-refly-tertiary-hover',
        {
          'font-semibold bg-refly-tertiary-hover': selectedKey === canvas.id,
        },
      )}
      onClick={() => {
        logEvent('canvas::select_existing_canvas', Date.now(), {
          canvas_id: canvas.id,
        });
        navigate(`/canvas/${canvas.id}`);
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer">
          <IconCanvas />
          <div className="w-32 truncate">{canvas?.name || t('common.untitled')}</div>
        </div>

        <div
          className={cn(
            'flex items-center transition-opacity duration-200',
            showCanvasIdActionDropdown === canvas.id
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <CanvasActionDropdown
            btnSize="small"
            canvasId={canvas.id}
            canvasName={canvas.name}
            updateShowStatus={handleUpdateShowStatus}
          />
        </div>
      </div>
    </div>
  );
};

const getSelectedKey = (pathname: string) => {
  if (pathname.startsWith('/canvas')) {
    const arr = pathname?.split('?')[0]?.split('/');
    return arr[arr.length - 1] ?? '';
  }
  return '';
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

  const {
    collapse,
    canvasList,
    setCollapse,
    setShowSettingModal,
    setShowLibraryModal,
    setShowCanvasListModal,
    setSettingsModalActiveTab,
  } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    canvasList: state.canvasList,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
    setShowLibraryModal: state.setShowLibraryModal,
    showLibraryModal: state.showLibraryModal,
    setShowCanvasListModal: state.setShowCanvasListModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const { isLoadingCanvas } = useHandleSiderData(true);

  const { t } = useTranslation();

  const location = useLocation();

  const canvasId = location.pathname.split('/').pop();
  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: null,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

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
      <div className="flex h-full flex-col gap-3 overflow-hidden p-4 pt-6">
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <SiderLogo
            source={source}
            navigate={(path) => navigate(path)}
            collapse={collapse}
            setCollapse={setCollapse}
          />

          <SearchQuickOpenBtn />

          <NewCanvasButton />

          {/* Library section */}
          <SiderSectionHeader
            icon={<IconKnowledgeBase key="library" style={{ fontSize: 20 }} />}
            title={t('loggedHomePage.siderMenu.library')}
            onActionClick={() => setShowLibraryModal(true)}
          />
          <Divider className="m-0 border-refly-Card-Border" />

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Canvas section with flexible height */}
            <div className="flex-1 flex flex-col min-h-0">
              <SiderSectionHeader
                icon={<IconProject key="canvas" style={{ fontSize: 20 }} />}
                title={t('loggedHomePage.siderMenu.canvas')}
                onActionClick={() => setShowCanvasListModal(true)}
              />

              <div className="rounded-md flex-1 min-h-20">
                <div className="h-full overflow-y-auto pl-2 py-1">
                  {isLoadingCanvas ? (
                    <Skeleton
                      key="skeleton-1"
                      active
                      title={false}
                      paragraph={{ rows: 3 }}
                      className="px-[12px] w-[200px]"
                    />
                  ) : canvasList?.length > 0 ? (
                    <div className="space-y-1">
                      {canvasList.map((canvas) => (
                        <CanvasListItem key={canvas.id} canvas={canvas} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm px-2 py-4 text-center">
                      {t('common.noData')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
      <CreditWelcomeModal />

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
