import React, { useState, useMemo } from "react"
import { Menu } from "@arco-design/web-react"
import { Alert, Avatar, Button, Layout, Skeleton, Divider, Tag } from "antd"
import {
  useLocation,
  useNavigate,
} from "@refly-packages/ai-workspace-common/utils/router"

import {
  IconCanvas,
  IconPlus,
} from "@refly-packages/ai-workspace-common/components/common/icon"
import cn from "classnames"

import Logo from "@/assets/logo.svg"
import { useUserStoreShallow } from "@refly-packages/ai-workspace-common/stores/user"
// components
import { SearchQuickOpenBtn } from "@refly-packages/ai-workspace-common/components/search-quick-open-btn"
import { useTranslation } from "react-i18next"
import { SiderMenuSettingList } from "@refly-packages/ai-workspace-common/components/sider-menu-setting-list"
import { SettingModal } from "@refly-packages/ai-workspace-common/components/settings"
// hooks
import { useHandleSiderData } from "@refly-packages/ai-workspace-common/hooks/use-handle-sider-data"
import {
  SiderData,
  useSiderStoreShallow,
} from "@refly-packages/ai-workspace-common/stores/sider"
import { useCreateCanvas } from "@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas"
// icons
import { IconLibrary } from "@refly-packages/ai-workspace-common/components/common/icon"
import { CanvasActionDropdown } from "@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown"
import { AiOutlineMenuFold, AiOutlineUser } from "react-icons/ai"

const Sider = Layout.Sider
const MenuItem = Menu.Item
const SubMenu = Menu.SubMenu

const SiderLogo = (props: {
  source: "sider" | "popover"
  navigate: (path: string) => void
  setCollapse: (collapse: boolean) => void
}) => {
  const { navigate, setCollapse, source } = props
  return (
    <div className="flex items-center justify-between p-3">
      <div
        className="flex cursor-pointer flex-row items-center gap-2"
        onClick={() => navigate("/")}>
        <img src={Logo} alt="Refly" className="h-8 w-8" />
        <span className="text-xl font-bold text-black" translate="no">
          Refly{" "}
        </span>
        <Tag color="green" className="text-[10px] leading-4">
          Beta
        </Tag>
      </div>
      {source === "sider" && (
        <div>
          <Button
            type="text"
            icon={<AiOutlineMenuFold size={16} className="text-gray-500" />}
            onClick={() => setCollapse(true)}
          />
        </div>
      )}
    </div>
  )
}

const MenuItemTooltipContent = (props: { title: string }) => {
  return <div>{props.title}</div>
}

const SettingItem = () => {
  const userStore = useUserStoreShallow(state => ({
    userProfile: state.userProfile,
  }))
  const { t } = useTranslation()

  return (
    <div className="group w-full">
      <SiderMenuSettingList>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center">
            <Avatar
              size={32}
              src={userStore?.userProfile?.avatar}
              icon={<AiOutlineUser />}
            />
            <span className="ml-2 max-w-[80px] truncate font-semibold text-gray-600">
              {userStore?.userProfile?.nickname}
            </span>
          </div>

          <div className="flex h-6 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium group-hover:bg-white">
            {t(
              `settings.subscription.subscriptionStatus.${userStore?.userProfile?.subscription?.planType || "free"}`,
            )}
          </div>
        </div>
      </SiderMenuSettingList>
    </div>
  )
}

const MenuItemContent = (props: {
  icon?: React.ReactNode
  title?: string
  type: string
  collapse?: boolean
  position?: "left" | "right"
}) => {
  const { position = "left", type } = props

  const { setShowLibraryModal, setShowCanvasListModal } = useSiderStoreShallow(
    state => ({
      setShowLibraryModal: state.setShowLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
    }),
  )

  const handleNavClick = () => {
    if (type === "Canvas") {
      setShowCanvasListModal(true)
    } else if (type === "Library") {
      setShowLibraryModal(true)
    }
  }
  return (
    <div
      className="relative flex items-center"
      style={{
        zIndex: 2,
      }}
      onClick={() => handleNavClick()}>
      <div className="flex flex-1 flex-nowrap items-center">
        {position === "left" && props.icon}
        <span className="sider-menu-title">{props.title}</span>
        {position === "right" && props.icon}
      </div>
    </div>
  )
}

const NewCanvasItem = () => {
  const { t } = useTranslation()
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } =
    useCreateCanvas()

  return (
    <MenuItem
      key="newCanvas"
      className="ml-2.5 flex h-8 items-center"
      onClick={debouncedCreateCanvas}>
      <Button
        loading={createCanvasLoading}
        type="text"
        icon={<IconPlus className="text-green-600" />}
      />

      <span className="text-green-600">
        {t("loggedHomePage.siderMenu.newCanvas")}
      </span>
    </MenuItem>
  )
}

const CanvasListItem = ({ canvas }: { canvas: SiderData }) => {
  const navigate = useNavigate()
  const [showCanvasIdActionDropdown, setShowCanvasIdActionDropdown] = useState<
    string | null
  >(null)

  const location = useLocation()
  const selectedKey = useMemo(
    () => getSelectedKey(location.pathname),
    [location.pathname],
  )

  return (
    <MenuItem
      key={canvas.id}
      className={cn(
        "group relative ml-4 h-8 rounded text-sm leading-8 hover:bg-gray-50",
        {
          "!bg-gray-100 font-medium !text-green-600": selectedKey === canvas.id,
        },
      )}
      onClick={() => {
        navigate(`/canvas/${canvas.id}`)
      }}>
      <div className="flex h-8 w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCanvas
            className={cn({ "text-green-600": selectedKey === canvas.id })}
          />
          <div className="w-28 truncate">{canvas?.name ?? ""}</div>
        </div>

        <div
          className={cn(
            "flex items-center transition-opacity duration-200",
            showCanvasIdActionDropdown === canvas.id
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100",
          )}>
          <CanvasActionDropdown
            canvasId={canvas.id}
            canvasName={canvas.name}
            updateShowStatus={canvasId => {
              setShowCanvasIdActionDropdown(canvasId)
            }}
          />
        </div>
      </div>
    </MenuItem>
  )
}

const getSelectedKey = (pathname: string) => {
  if (pathname.startsWith("/canvas")) {
    const arr = pathname?.split("?")[0]?.split("/")
    return arr[arr.length - 1] ?? ""
  }
  return ""
}

export const SiderLayout = (props: { source: "sider" | "popover" }) => {
  const { source = "sider" } = props
  const {
    collapse,
    canvasList,
    setCollapse,
    showSettingModal,
    setShowSettingModal,
  } = useSiderStoreShallow(state => ({
    showSettingModal: state.showSettingModal,
    collapse: state.collapse,
    canvasList: state.canvasList,
    setCollapse: state.setCollapse,
    setShowSettingModal: state.setShowSettingModal,
  }))

  const navigate = useNavigate()
  const userStore = useUserStoreShallow(state => ({
    userProfile: state.userProfile,
  }))

  const { isLoadingCanvas } = useHandleSiderData(true)

  const { t } = useTranslation()

  const location = useLocation()

  const selectedKey = useMemo(
    () => getSelectedKey(location.pathname),
    [location.pathname],
  )

  const defaultOpenKeys = useMemo(() => ["Canvas", "Library"], [])

  interface SiderCenterProps {
    key: string
    name: string
    icon: React.ReactNode
    showDivider?: boolean
    onClick?: () => void
  }

  const siderSections: SiderCenterProps[][] = [
    [],
    [
      {
        key: "Canvas",
        name: "canvas",
        icon: (
          <IconCanvas
            key="canvas"
            className="arco-icon"
            style={{ fontSize: 20 }}
          />
        ),
      },
      {
        key: "Library",
        name: "library",
        icon: (
          <IconLibrary
            key="library"
            className="arco-icon"
            style={{ fontSize: 20 }}
          />
        ),
      },
    ],
  ]

  return (
    <Sider
      width={source === "sider" ? (collapse ? 0 : 220) : 220}
      className={cn(
        "border border-solid border-gray-100 bg-white shadow-sm",
        source === "sider"
          ? "h-[calc(100vh)]"
          : "h-[calc(100vh-100px)] rounded-r-lg",
      )}>
      <div className="flex h-full flex-col overflow-y-auto">
        <SiderLogo
          source={source}
          navigate={path => navigate(path)}
          setCollapse={setCollapse}
        />

        <SearchQuickOpenBtn />

        <Menu
          className="flex-1 border-r-0 bg-transparent"
          openKeys={defaultOpenKeys}
          selectedKeys={selectedKey ? [selectedKey] : []}
          defaultSelectedKeys={selectedKey ? [selectedKey] : []}>
          <div className="flex h-full flex-col justify-between">
            <div className="flex-1 overflow-y-auto">
              {siderSections.map((section, index) => (
                <div key={`section-${index}`} className="sider-section">
                  {section.map((item, itemIndex) => (
                    <React.Fragment key={item.key}>
                      <SubMenu
                        key={item.key}
                        className="[&_.arco-menu-icon-suffix_.arco-icon-down]:z-[1] [&_.arco-menu-icon-suffix_.arco-icon-down]:rotate-90 [&_.arco-menu-inline-header]:pr-0"
                        title={
                          <MenuItemContent
                            type={item.key}
                            icon={item.icon}
                            title={t(`loggedHomePage.siderMenu.${item.name}`)}
                          />
                        }>
                        {item.key === "Canvas" && (
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
                              canvasList.map(canvas => (
                                <CanvasListItem
                                  key={canvas.id}
                                  canvas={canvas}
                                />
                              ))
                            )}
                          </>
                        )}
                      </SubMenu>
                      {itemIndex < siderSections.length - 1 && (
                        <Divider
                          key={`divider-${itemIndex}`}
                          style={{
                            margin: "8px 0",
                          }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <div className="mb-2 flex flex-col gap-2">
                <Alert
                  message={
                    <div className="flex cursor-pointer items-center justify-center">
                      <a
                        href="https://powerformer.feishu.cn/wiki/Syrsw7DJxiaExSkoSiXcTF1inBg?from=canvas"
                        target="_blank">
                        👉{"    "}
                        <span>
                          {t("loggedHomePage.siderMenu.joinFeedback")}
                        </span>
                      </a>
                    </div>
                  }
                  type="success"
                  closable
                />
                <Alert
                  message={
                    <div className="flex cursor-pointer items-center justify-center">
                      <a
                        href="https://powerformer.feishu.cn/wiki/Syrsw7DJxiaExSkoSiXcTF1inBg"
                        target="_blank">
                        📖{"    "}
                        <span>
                          {t("loggedHomePage.siderMenu.viewTutorial")}
                        </span>
                      </a>
                    </div>
                  }
                  type="info"
                  closable
                />
              </div>
              {!!userStore.userProfile?.uid && (
                <MenuItem
                  key="Settings"
                  className="flex h-10 items-center justify-between"
                  renderItemInTooltip={() => (
                    <MenuItemTooltipContent
                      title={t("loggedHomePage.siderMenu.settings")}
                    />
                  )}>
                  <SettingItem />
                </MenuItem>
              )}
            </div>
          </div>
        </Menu>

        <SettingModal
          visible={showSettingModal}
          setVisible={setShowSettingModal}
        />
      </div>
    </Sider>
  )
}
