import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Avatar, Button, Layout, Skeleton, Divider, Tag, Menu } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import {
  IconCanvas,
  IconHome,
  IconPlus,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import cn from 'classnames';

import Logo from '@/assets/logo.svg';
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
import {
  IconLibrary,
  IconProject,
  IconRight,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { AiOutlineMenuFold, AiOutlineUser } from 'react-icons/ai';
import { SubscriptionHint } from '@refly-packages/ai-workspace-common/components/subscription/hint';
import { FaGithub } from 'react-icons/fa6';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';
import { LuList } from 'react-icons/lu';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';

const Sider = Layout.Sider;
const SubMenu = Menu.SubMenu;

export const SiderLogo = (props: {
  source: 'sider' | 'popover';
  navigate: (path: string) => void;
  setCollapse: (collapse: boolean) => void;
}) => {
  const { navigate, setCollapse, source } = props;
  const [starCount, setStarCount] = useState('');

  useEffect(() => {
    // Fetch GitHub star count
    fetch('https://api.github.com/repos/refly-ai/refly')
      .then((res) => res.json())
      .then((data) => {
        const stars = data.stargazers_count;
        setStarCount(stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString());
      })
      .catch(() => {
        // Keep default value if fetch fails
      });
  }, []);

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-2">
        <div
          className="flex cursor-pointer flex-row items-center gap-1.5"
          onClick={() => navigate('/')}
        >
          <img src={Logo} alt="Refly" className="h-8 w-8" />
          <span
            className="text-xl font-bold text-black dark:text-gray-100 dark:text-gray-100"
            translate="no"
          >
            Refly
          </span>
        </div>

        {starCount && (
          <Button
            type="default"
            icon={<FaGithub className="h-3.5 w-3.5" />}
            onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
            className="flex h-6 items-center gap-0.5 bg-white px-1.5 text-xs font-bold dark:bg-gray-900"
          >
            {starCount}
          </Button>
        )}
      </div>
      {source === 'sider' && (
        <div>
          <Button
            type="text"
            icon={<AiOutlineMenuFold size={16} className="text-gray-500 dark:text-gray-400" />}
            onClick={() => setCollapse(true)}
          />
        </div>
      )}
    </div>
  );
};

const SettingItem = () => {
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const planType = userProfile?.subscription?.planType || 'free';

  const { t } = useTranslation();

  return (
    <div className="group w-full">
      <SiderMenuSettingList>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center">
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

          {subscriptionEnabled && (
            <div className="flex h-6 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium group-hover:bg-white dark:bg-gray-800 dark:group-hover:bg-black">
              {t(`settings.subscription.subscriptionStatus.${planType}`)}
            </div>
          )}
        </div>
      </SiderMenuSettingList>
    </div>
  );
};

export const NewCanvasItem = () => {
  const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  return (
    <div className="w-full" onClick={() => debouncedCreateCanvas()}>
      <Button
        className="w-full justify-start px-2"
        key="newCanvas"
        loading={createCanvasLoading}
        type="text"
        icon={<IconPlus className="text-green-600 dark:text-green-300" />}
      >
        <span className="text-green-600 dark:text-green-300">
          {t('loggedHomePage.siderMenu.newCanvas')}
        </span>
      </Button>
    </div>
  );
};

export const NewProjectItem = () => {
  const { t } = useTranslation();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { getProjectsList } = useHandleSiderData();

  return (
    <>
      <div key="newProject" className="w-full" onClick={() => setCreateProjectModalVisible(true)}>
        <Button
          type="text"
          icon={<IconPlus className="text-green-600 dark:text-green-300" />}
          className="w-full justify-start px-2"
        >
          <span className="text-green-600 dark:text-green-300">{t('project.create')}</span>
        </Button>
      </div>

      <CreateProjectModal
        mode="create"
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={() => {
          getProjectsList(true);
        }}
      />
    </>
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
        'group relative my-1 px-2 rounded text-sm leading-8 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-950',
        {
          '!bg-gray-100 font-medium !text-green-600': selectedKey === canvas.id,
          'dark:!bg-gray-800 dark:!text-green-300': selectedKey === canvas.id, // 新增的dark模式选中状态
        },
      )}
      onClick={() => {
        navigate(`/canvas/${canvas.id}`);
      }}
    >
      <div className="flex w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCanvas
            className={cn({ 'text-green-600 dark:text-green-300': selectedKey === canvas.id })}
          />
          <div className="w-28 truncate">{canvas?.name || t('common.untitled')}</div>
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

export const ProjectListItem = ({ project }: { project: SiderData }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleProjectClick = async () => {
    // Navigate to the project page
    navigate(`/project/${project.id}?canvasId=empty`);
  };

  return (
    <div
      key={project.id}
      className="group relative my-1 px-2 rounded text-sm leading-8 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-950"
      onClick={handleProjectClick}
    >
      <div className="flex w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconProject className="text-gray-500 dark:text-gray-400" />
          <div className="w-28 truncate">{project?.name || t('common.untitled')}</div>
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
    projectsList,
    setCollapse,
    showSettingModal,
    setShowSettingModal,
    setShowLibraryModal,
    setShowCanvasListModal,
    setSettingsModalActiveTab,
  } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    collapse: state.collapse,
    canvasList: state.canvasList,
    projectsList: state.projectsList,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
    setShowLibraryModal: state.setShowLibraryModal,
    showLibraryModal: state.showLibraryModal,
    setShowCanvasListModal: state.setShowCanvasListModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const { isLoadingCanvas, isLoadingProjects } = useHandleSiderData(true);

  const { t } = useTranslation();

  const location = useLocation();

  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);

  const defaultOpenKeys = useMemo(() => ['Canvas', 'Library'], []);

  const canvasId = location.pathname.split('/').pop();
  const isHome = useMatch('/canvas/:canvasId') && canvasId === 'empty';
  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: null,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

  interface SiderCenterProps {
    key: string;
    name: string;
    icon: React.ReactNode;
    actionIcon?: React.ReactNode;
    actionHandler?: () => void;
    showDivider?: boolean;
    onClick?: () => void;
  }

  const siderSections: SiderCenterProps[] = [
    {
      key: 'Canvas',
      name: 'canvas',
      icon: <IconCanvas key="canvas" style={{ fontSize: 20 }} />,
      actionIcon: (
        <LuList
          size={16}
          className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
        />
      ),
      actionHandler: () => setShowCanvasListModal(true),
    },
    {
      key: 'Library',
      name: 'library',
      icon: <IconLibrary key="library" style={{ fontSize: 20 }} />,
      actionIcon: (
        <LuList
          size={16}
          className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
        />
      ),
      actionHandler: () => setShowLibraryModal(true),
    },
  ];

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
      width={source === 'sider' ? (collapse ? 0 : 220) : 220}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <SiderLogo source={source} navigate={(path) => navigate(path)} setCollapse={setCollapse} />

        <SearchQuickOpenBtn />

        <div
          className={cn(
            'flex-shrink-0 h-10 my-1 mx-2 flex items-center justify-between pl-6 pr-3 text-gray-600 hover:bg-gray-100 cursor-pointer rounded-lg dark:text-gray-400 dark:bg-gray-900 dark:hover:bg-gray-700',
            {
              'bg-gray-100 dark:bg-gray-700': isHome,
            },
          )}
          onClick={() => navigate('/')}
        >
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <IconHome key="home" style={{ fontSize: 20 }} />
              <span>{t('loggedHomePage.siderMenu.home')}</span>
            </div>
          </div>
        </div>

        {/* Main menu section with flexible layout */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-[250px]">
          <Menu
            className="flex-1 !border-none bg-transparent overflow-hidden flex flex-col"
            mode="inline"
            defaultOpenKeys={defaultOpenKeys}
            selectedKeys={selectedKey ? [selectedKey] : []}
            style={{ height: '100%' }}
          >
            {siderSections.map((section) => {
              const sectionTitle = (
                <div className="flex items-center justify-between w-full text-gray-600 group select-none dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span>{t(`loggedHomePage.siderMenu.${section.name}`)}</span>
                  </div>
                  {section.actionIcon && (
                    <Button
                      type="text"
                      size="small"
                      className="px-1 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 dark:text-gray-400"
                      icon={section.actionIcon}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (section.actionHandler) {
                          section.actionHandler();
                        }
                      }}
                    />
                  )}
                </div>
              );

              const sectionContent = (
                <div className="flex-1 overflow-hidden flex flex-col bg-white select-none dark:bg-gray-900">
                  <div className="flex-none pl-5 pr-2">
                    {section.key === 'Canvas' && <NewCanvasItem />}
                    {section.key === 'Library' && <NewProjectItem />}
                  </div>

                  <div className="flex-1 overflow-y-auto pl-5 pr-2 min-h-0">
                    {section.key === 'Canvas' &&
                      (isLoadingCanvas ? (
                        <Skeleton
                          key="skeleton-1"
                          active
                          title={false}
                          paragraph={{ rows: 3 }}
                          className="px-[12px] w-[200px]"
                        />
                      ) : canvasList?.length > 0 ? (
                        <div>
                          {canvasList.map((canvas) => (
                            <CanvasListItem key={canvas.id} canvas={canvas} />
                          ))}
                          <ViewAllButton onClick={() => setShowCanvasListModal(true)} />
                        </div>
                      ) : null)}

                    {section.key === 'Library' &&
                      (isLoadingProjects ? (
                        <Skeleton
                          key="skeleton-1"
                          active
                          title={false}
                          paragraph={{ rows: 3 }}
                          className="px-[12px] w-[200px]"
                        />
                      ) : projectsList?.length > 0 ? (
                        <div>
                          {projectsList.map((project) => (
                            <ProjectListItem key={project.id} project={project} />
                          ))}

                          <ViewAllButton onClick={() => setShowLibraryModal(true)} />
                        </div>
                      ) : null)}
                  </div>
                </div>
              );

              return (
                <SubMenu
                  key={section.key}
                  title={sectionTitle}
                  className="ant-menu-submenu-adaptive overflow-hidden border-t-1 border-b-0 border-x-0 border-solid border-gray-100 !rounded-none mx-2 dark:border-gray-800"
                  onTitleClick={() => {
                    if (section.onClick) section.onClick();
                  }}
                >
                  {sectionContent}
                </SubMenu>
              );
            })}
          </Menu>
        </div>

        <div className="sider-footer mt-auto px-2 pb-2">
          <Divider style={{ margin: '6px 0' }} />
          {subscriptionEnabled && planType === 'free' && (
            <div className="mb-2 flex flex-col gap-2">
              <SubscriptionHint />
            </div>
          )}

          <div
            onClick={() =>
              window.open('https://github.com/refly-ai/refly/releases/tag/v0.6.0', '_blank')
            }
            className="mb-2 flex items-start text-[#00968F] hover:bg-gray-50 rounded-md whitespace-normal h-auto cursor-pointer dark:text-gray-300"
          >
            <span className="flex items-start gap-2 leading-6 w-full ">
              <Tag
                color="green"
                className="w-full whitespace-normal !h-auto !py-1 !mr-0 text-center"
              >
                {t('landingPage.simpleMessageText')}
              </Tag>
            </span>
          </div>

          {!!userProfile?.uid && (
            <div
              className="flex h-12 items-center justify-between cursor-pointer hover:bg-gray-100 rounded-md px-2 dark:text-gray-300 dark:hover:bg-gray-800"
              data-cy="settings-menu-item"
            >
              <SettingItem />
            </div>
          )}
        </div>

        <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
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

  return (
    <>
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
