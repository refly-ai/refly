import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Menu } from '@arco-design/web-react';
import { Avatar, Button, Layout, Skeleton, Divider, Tag } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import {
  IconCanvas,
  IconPlus,
  IconTemplate,
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
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { AiOutlineMenuFold, AiOutlineUser } from 'react-icons/ai';
import { SubscriptionHint } from '@refly-packages/ai-workspace-common/components/subscription/hint';
import { HoverCard, HoverContent } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { FaGithub } from 'react-icons/fa6';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useCanvasTemplateModal } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';

const Sider = Layout.Sider;
const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;

export const SiderLogo = (props: {
  source: 'sider' | 'popover';
  navigate: (path: string) => void;
  setCollapse: (collapse: boolean) => void;
}) => {
  const { navigate, setCollapse, source } = props;
  const [starCount, setStarCount] = useState('913');

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
          <span className="text-xl font-bold text-black" translate="no">
            Refly
          </span>
        </div>

        <Button
          type="default"
          icon={<FaGithub className="h-3.5 w-3.5" />}
          onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
          className="flex h-6 items-center gap-0.5 bg-white px-1.5 text-xs font-bold"
        >
          {starCount}
        </Button>
      </div>

      {source === 'sider' && (
        <div>
          <Button
            type="text"
            icon={<AiOutlineMenuFold size={16} className="text-gray-500" />}
            onClick={() => setCollapse(true)}
          />
        </div>
      )}
    </div>
  );
};

const MenuItemTooltipContent = (props: { title: string }) => {
  return <div>{props.title}</div>;
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
              className={cn('ml-2 max-w-[180px] truncate font-semibold text-gray-600', {
                'max-w-[80px]': subscriptionEnabled,
              })}
            >
              {userProfile?.nickname}
            </span>
          </div>

          {subscriptionEnabled && (
            <div className="flex h-6 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium group-hover:bg-white">
              {t(`settings.subscription.subscriptionStatus.${planType}`)}
            </div>
          )}
        </div>
      </SiderMenuSettingList>
    </div>
  );
};

const MenuItemContent = (props: {
  icon?: React.ReactNode;
  title?: string;
  type: string;
  collapse?: boolean;
  position?: 'left' | 'right';
  hoverContent?: HoverContent;
  canvasId?: string;
}) => {
  const { position = 'left', type, hoverContent } = props;
  const { hoverCardEnabled } = useHoverCard();

  const { setShowLibraryModal, setShowCanvasListModal } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
    setShowCanvasListModal: state.setShowCanvasListModal,
  }));

  const { setVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));

  const handleNavClick = () => {
    if (type === 'Canvas') {
      setShowCanvasListModal(true);
    } else if (type === 'Library') {
      setShowLibraryModal(true);
    } else if (type === 'Template') {
      setVisible(true);
    }
  };

  const content = (
    <div
      className="relative flex items-center"
      style={{
        zIndex: 2,
      }}
      onClick={() => handleNavClick()}
    >
      <div className="flex flex-1 flex-nowrap items-center">
        {position === 'left' && props.icon}
        <span className="sider-menu-title">{props.title}</span>
        {position === 'right' && props.icon}
      </div>
    </div>
  );

  if (hoverContent && hoverCardEnabled) {
    return (
      <HoverCard
        title={hoverContent?.title}
        description={hoverContent?.description}
        videoUrl={hoverContent?.videoUrl}
        placement={hoverContent?.placement || 'right'}
      >
        {content}
      </HoverCard>
    );
  }

  return content;
};

export const NewCanvasItem = () => {
  const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  return (
    <MenuItem
      key="newCanvas"
      className="ml-2.5 flex h-8 items-center"
      onClick={debouncedCreateCanvas}
    >
      <Button
        loading={createCanvasLoading}
        type="text"
        icon={<IconPlus className="text-green-600" />}
      />

      <span className="text-green-600">{t('loggedHomePage.siderMenu.newCanvas')}</span>
    </MenuItem>
  );
};

export const NewProjectItem = () => {
  const { t } = useTranslation();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { loadSiderData } = useHandleSiderData();

  return (
    <>
      <MenuItem
        key="newProject"
        className="ml-2.5 flex h-8 items-center"
        onClick={() => setCreateProjectModalVisible(true)}
      >
        <Button type="text" icon={<IconPlus className="text-green-600" />} />

        <span className="text-green-600">{t('project.create')}</span>
      </MenuItem>
      <CreateProjectModal
        mode="create"
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={() => {
          loadSiderData(true);
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
    <MenuItem
      key={canvas.id}
      className={cn('group relative ml-4 h-8 rounded text-sm leading-8 hover:bg-gray-50', {
        '!bg-gray-100 font-medium !text-green-600': selectedKey === canvas.id,
      })}
      onClick={() => {
        navigate(`/canvas/${canvas.id}`);
      }}
    >
      <div className="flex h-8 w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCanvas className={cn({ 'text-green-600': selectedKey === canvas.id })} />
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
    </MenuItem>
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
    <MenuItem
      key={project.id}
      className="group relative ml-4 h-8 rounded text-sm leading-8 hover:bg-gray-50"
      onClick={handleProjectClick}
    >
      <div className="flex h-8 w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconProject className="text-gray-500" />
          <div className="w-28 truncate">{project?.name || t('common.untitled')}</div>
        </div>
      </div>
    </MenuItem>
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

  const { setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
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
  } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    collapse: state.collapse,
    canvasList: state.canvasList,
    projectsList: state.projectsList,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
    setShowLibraryModal: state.setShowLibraryModal,
    showLibraryModal: state.showLibraryModal,
  }));

  const { isLoadingCanvas, isLoadingProjects } = useHandleSiderData(true);

  const { t } = useTranslation();

  const location = useLocation();

  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);

  const defaultOpenKeys = useMemo(() => ['Canvas', 'Library', 'Template'], []);

  const canvasId = location.pathname.split('/').pop();
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
    showDivider?: boolean;
    onClick?: () => void;
    hoverContent?: HoverContent;
  }

  const siderSections: SiderCenterProps[] = [
    {
      key: 'Template',
      name: 'template',
      icon: <IconTemplate key="template" className="arco-icon" style={{ fontSize: 20 }} />,
    },
    {
      key: 'Canvas',
      name: 'canvas',
      icon: <IconCanvas key="canvas" className="arco-icon" style={{ fontSize: 20 }} />,
      hoverContent: {
        title: t('loggedHomePage.siderMenu.canvasTitle'),
        description: t('loggedHomePage.siderMenu.canvasDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/siderMenu/siderMenu-canvas.webm',
        placement: 'rightBottom',
      },
    },
    {
      key: 'Library',
      name: 'library',
      icon: <IconLibrary key="library" className="arco-icon" style={{ fontSize: 20 }} />,
      hoverContent: {
        title: t('loggedHomePage.siderMenu.libraryTitle'),
        description: t('loggedHomePage.siderMenu.libraryDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/siderMenu/siderMenu-knowledgebase.webm',
      },
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
  ]);

  return (
    <Sider
      width={source === 'sider' ? (collapse ? 0 : 220) : 220}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <SiderLogo source={source} navigate={(path) => navigate(path)} setCollapse={setCollapse} />

        <SearchQuickOpenBtn />

        <Menu
          className="flex-1 border-r-0 bg-transparent"
          openKeys={defaultOpenKeys}
          selectedKeys={selectedKey ? [selectedKey] : []}
          defaultSelectedKeys={selectedKey ? [selectedKey] : []}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex-1 overflow-y-auto">
              <div className="sider-section">
                {siderSections.map((item, itemIndex) => (
                  <React.Fragment key={item.key}>
                    <SubMenu
                      key={item.key}
                      className="[&_.arco-menu-icon-suffix_.arco-icon-down]:z-[1] [&_.arco-menu-icon-suffix_.arco-icon-down]:rotate-90 [&_.arco-menu-inline-header]:pr-0"
                      title={
                        <MenuItemContent
                          canvasId={canvasId}
                          type={item.key}
                          icon={item.icon}
                          title={t(`loggedHomePage.siderMenu.${item.name}`)}
                          hoverContent={item.hoverContent}
                        />
                      }
                    >
                      {item.key === 'Canvas' && (
                        <>
                          <NewCanvasItem />

                          {isLoadingCanvas ? (
                            <>
                              <Skeleton.Input
                                key="skeleton-1"
                                active
                                size="small"
                                style={{ width: 204 }}
                              />
                              <Skeleton.Input
                                key="skeleton-2"
                                active
                                size="small"
                                style={{ marginTop: 8, width: 204 }}
                              />
                              <Skeleton.Input
                                key="skeleton-3"
                                active
                                size="small"
                                style={{ marginTop: 8, width: 204 }}
                              />
                            </>
                          ) : (
                            canvasList.map((canvas) => (
                              <CanvasListItem key={canvas.id} canvas={canvas} />
                            ))
                          )}
                        </>
                      )}

                      {item.key === 'Library' && (
                        <>
                          <NewProjectItem />

                          {isLoadingProjects ? (
                            <>
                              <Skeleton.Input
                                key="skeleton-1"
                                active
                                size="small"
                                style={{ width: 204 }}
                              />
                              <Skeleton.Input
                                key="skeleton-2"
                                active
                                size="small"
                                style={{ marginTop: 8, width: 204 }}
                              />
                              <Skeleton.Input
                                key="skeleton-3"
                                active
                                size="small"
                                style={{ marginTop: 8, width: 204 }}
                              />
                            </>
                          ) : (
                            projectsList.map((project) => (
                              <ProjectListItem key={project.id} project={project} />
                            ))
                          )}
                        </>
                      )}
                    </SubMenu>
                    {itemIndex < siderSections.length - 1 && (
                      <Divider
                        key={`divider-${item.key}`}
                        style={{
                          margin: '8px 0',
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <Divider style={{ margin: '8px 0' }} />

              {subscriptionEnabled && planType === 'free' && (
                <div className="mb-2 flex flex-col gap-2">
                  <SubscriptionHint />
                </div>
              )}

              <span
                onClick={() =>
                  window.open('https://github.com/refly-ai/refly/releases/tag/v0.5.0', '_blank')
                }
                className="mb-2 flex items-start text-[#00968F] hover:bg-gray-50 whitespace-normal h-auto cursor-pointer"
              >
                <span className="flex items-start gap-2 leading-6 w-full ">
                  <Tag
                    color="green"
                    className="w-full whitespace-normal !h-auto !py-1 !mr-0 text-center"
                  >
                    {t('landingPage.simpleMessageText')}
                  </Tag>
                </span>
              </span>

              {!!userProfile?.uid && (
                <MenuItem
                  key="Settings"
                  className="flex h-12 items-center justify-between"
                  data-cy="settings-menu-item"
                  renderItemInTooltip={() => (
                    <MenuItemTooltipContent title={t('loggedHomePage.siderMenu.settings')} />
                  )}
                >
                  <SettingItem />
                </MenuItem>
              )}
            </div>
          </div>
        </Menu>

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
