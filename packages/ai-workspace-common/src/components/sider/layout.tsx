import { useState, useMemo, useEffect, useCallback } from 'react';
import { Avatar, Button, Layout, Skeleton } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import {
  IconCanvas,
  IconSettings,
  IconLightMode,
  IconDarkMode,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import cn from 'classnames';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
// components
import { SearchQuickOpenBtn } from '@refly-packages/ai-workspace-common/components/search-quick-open-btn';
import { useTranslation } from 'react-i18next';
import { SiderMenuSettingList } from '@refly-packages/ai-workspace-common/components/sider-menu-setting-list';
import { SettingModal } from '@refly-packages/ai-workspace-common/components/settings';
import { TourModal } from '@refly-packages/ai-workspace-common/components/tour-modal';
import { SettingsGuideModal } from '@refly-packages/ai-workspace-common/components/settings-guide';
import { StorageExceededModal } from '@refly-packages/ai-workspace-common/components/subscription/storage-exceeded-modal';
// hooks
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import {
  SiderData,
  useSiderStoreShallow,
  type SettingsModalActiveTab,
} from '@refly-packages/ai-workspace-common/stores/sider';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
// icons
import { IconLibrary, IconRight } from '@refly-packages/ai-workspace-common/components/common/icon';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { AiOutlineMenuFold, AiOutlineUser } from 'react-icons/ai';
import { SubscriptionHint } from '@refly-packages/ai-workspace-common/components/subscription/hint';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';
import { LuList } from 'react-icons/lu';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/githubStar';
import { useThemeStoreShallow } from '@refly-packages/ai-workspace-common/stores/theme';

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
    <div className="h-12 flex items-center justify-between w-full text-gray-600 group select-none dark:text-gray-300 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      {actionIcon && onActionClick && (
        <Button
          type="text"
          size="small"
          className="box-border px-1 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 dark:text-gray-400"
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
  navigate: (path: string) => void;
  setCollapse: (collapse: boolean) => void;
}) => {
  const { navigate, setCollapse } = props;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Logo onClick={() => navigate('/')} />
        <GithubStar />
      </div>

      <div>
        <Button
          type="text"
          icon={<AiOutlineMenuFold size={16} className="text-gray-500 dark:text-gray-400" />}
          onClick={() => setCollapse(true)}
        />
      </div>
    </div>
  );
};

const SettingItem = () => {
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const { isDarkMode, setThemeMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    setThemeMode: state.setThemeMode,
  }));
  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  return (
    <div className="group w-full">
      <SiderMenuSettingList>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar size={32} src={userProfile?.avatar} icon={<AiOutlineUser />} />
            <span
              className={cn(
                'ml-2 max-w-[180px] truncate font-semibold text-gray-600 dark:text-gray-300',
                {
                  'max-w-[80px]': subscriptionEnabled,
                },
              )}
            >
              {userProfile?.nickname}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="text"
              icon={isDarkMode ? <IconDarkMode size={16} /> : <IconLightMode size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                setThemeMode(isDarkMode ? 'light' : 'dark');
              }}
            />
            <Button
              type="text"
              icon={<IconSettings size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingModal(true);
              }}
            />
          </div>
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
      <Button className="w-full h-9" key="newCanvas" loading={createCanvasLoading} type="default">
        <span className="hover:text-green-600 dark:hover:text-green-300">
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
        'group relative my-1 px-3 rounded text-sm leading-8 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-950',
        {
          '!bg-gray-100 font-medium !text-green-600': selectedKey === canvas.id,
          'dark:!bg-gray-800 dark:!text-green-300': selectedKey === canvas.id, // 新增的dark模式选中状态
        },
      )}
      onClick={() => {
        navigate(`/canvas/${canvas.id}`);
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCanvas
            className={cn({ 'text-green-600 dark:text-green-300': selectedKey === canvas.id })}
          />
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

const ViewAllButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <Button
      className="group w-full px-2 text-gray-500 text-xs mb-2 !bg-transparent hover:!text-green-600 dark:text-gray-400 dark:hover:!text-green-300"
      type="text"
      size="small"
      onClick={onClick}
      iconPosition="end"
      icon={
        <IconRight className="flex items-center text-gray-500 hover:text-green-600 group-hover:text-green-600 dark:text-gray-400 dark:hover:!text-green-300" />
      }
    >
      {t('common.viewAll')}
    </Button>
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
  const planType = userProfile?.subscription?.planType || 'free';

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
          : 'h-[calc(100vh-100px)] rounded-r-lg ring-1 ring-gray-200 shadow-sm',
      )}
    >
      <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <SiderLogo navigate={(path) => navigate(path)} setCollapse={setCollapse} />

          <SearchQuickOpenBtn />

          <NewCanvasButton />

          {/* Library section */}
          <SiderSectionHeader
            icon={<IconLibrary key="library" style={{ fontSize: 20 }} />}
            title={t('loggedHomePage.siderMenu.library')}
            onActionClick={() => setShowLibraryModal(true)}
            actionIcon={
              <LuList
                size={16}
                className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
              />
            }
          />

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Canvas section with flexible height */}
            <div className="flex-1 flex flex-col min-h-0">
              <SiderSectionHeader
                icon={<IconCanvas key="canvas" style={{ fontSize: 20 }} />}
                title={t('loggedHomePage.siderMenu.canvas')}
                onActionClick={() => setShowCanvasListModal(true)}
                actionIcon={
                  <LuList
                    size={16}
                    className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
                  />
                }
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
                      <ViewAllButton onClick={() => setShowCanvasListModal(true)} />
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

        {subscriptionEnabled && planType === 'free' && <SubscriptionHint />}

        {!!userProfile?.uid && (
          <div
            className="flex h-12 items-center justify-between cursor-pointer hover:bg-gray-100 rounded-md px-2 dark:text-gray-300 dark:hover:bg-gray-800"
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
