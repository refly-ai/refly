"use client"
import { useTranslation } from "react-i18next"
import { useEffect, useRef, useState } from "react"
import cn from "classnames"
import {
  RiAccountCircleFill,
  RiAccountCircleLine,
  RiApps2AddFill,
  RiApps2AddLine,
  RiBox3Fill,
  RiBox3Line,
  RiCloseLine,
  RiColorFilterFill,
  RiColorFilterLine,
  RiDatabase2Fill,
  RiDatabase2Line,
  RiGroup2Fill,
  RiGroup2Line,
  RiMoneyDollarCircleFill,
  RiMoneyDollarCircleLine,
  RiPuzzle2Fill,
  RiPuzzle2Line,
  RiTranslate2,
} from "@remixicon/react"
import AccountPage from "./account-page"
import MembersPage from "./members-page"
import IntegrationsPage from "./Integrations-page"
import LanguagePage from "./language-page"
import ApiBasedExtensionPage from "./api-based-extension-page"
import DataSourcePage from "./data-source-page"
import ModelProviderPage from "./model-provider-page"
import s from "./index.module.css"
import BillingPage from "@/components/billing/billing-page"
import CustomPage from "@/components/custom/custom-page"
import Modal from "@/components/base/modal"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"
import { useProviderContext } from "@/context/provider-context"

const iconClassName = `
  w-4 h-4 ml-3 mr-2
`

const scrolledClassName = `
  border-b shadow-xs bg-white/[.98]
`

type IAccountSettingProps = {
  onCancel: () => void
  activeTab?: string
}

type GroupItem = {
  key: string
  name: string
  description?: string
  icon: JSX.Element
  activeIcon: JSX.Element
}

export default function AccountSetting({
  onCancel,
  activeTab = "account",
}: IAccountSettingProps) {
  const [activeMenu, setActiveMenu] = useState(activeTab)
  const { t } = useTranslation()
  const { enableBilling, enableReplaceWebAppLogo } = useProviderContext()

  const workplaceGroupItems = (() => {
    return [
      {
        key: "provider",
        name: t("common.settings.provider"),
        icon: <RiBox3Line className={iconClassName} />,
        activeIcon: <RiBox3Fill className={iconClassName} />,
      },
      {
        key: "members",
        name: t("common.settings.members"),
        icon: <RiGroup2Line className={iconClassName} />,
        activeIcon: <RiGroup2Fill className={iconClassName} />,
      },
      {
        // Use key false to hide this item
        key: enableBilling ? "billing" : false,
        name: t("common.settings.billing"),
        description: t("billing.plansCommon.receiptInfo"),
        icon: <RiMoneyDollarCircleLine className={iconClassName} />,
        activeIcon: <RiMoneyDollarCircleFill className={iconClassName} />,
      },
      {
        key: "data-source",
        name: t("common.settings.dataSource"),
        icon: <RiDatabase2Line className={iconClassName} />,
        activeIcon: <RiDatabase2Fill className={iconClassName} />,
      },
      {
        key: "api-based-extension",
        name: t("common.settings.apiBasedExtension"),
        icon: <RiPuzzle2Line className={iconClassName} />,
        activeIcon: <RiPuzzle2Fill className={iconClassName} />,
      },
      {
        key: enableReplaceWebAppLogo || enableBilling ? "custom" : false,
        name: t("custom.custom"),
        icon: <RiColorFilterLine className={iconClassName} />,
        activeIcon: <RiColorFilterFill className={iconClassName} />,
      },
    ].filter(item => !!item.key) as GroupItem[]
  })()

  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const menuItems = [
    {
      key: "workspace-group",
      name: t("common.settings.workplaceGroup"),
      items: workplaceGroupItems,
    },
    {
      key: "account-group",
      name: t("common.settings.accountGroup"),
      items: [
        {
          key: "account",
          name: t("common.settings.account"),
          icon: <RiAccountCircleLine className={iconClassName} />,
          activeIcon: <RiAccountCircleFill className={iconClassName} />,
        },
        {
          key: "integrations",
          name: t("common.settings.integrations"),
          icon: <RiApps2AddLine className={iconClassName} />,
          activeIcon: <RiApps2AddFill className={iconClassName} />,
        },
        {
          key: "language",
          name: t("common.settings.language"),
          icon: <RiTranslate2 className={iconClassName} />,
          activeIcon: <RiTranslate2 className={iconClassName} />,
        },
      ],
    },
  ]
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const targetElement = scrollRef.current
    const scrollHandle = (e: Event) => {
      const userScrolled = (e.target as HTMLDivElement).scrollTop > 0
      setScrolled(userScrolled)
    }
    targetElement?.addEventListener("scroll", scrollHandle)
    return () => {
      targetElement?.removeEventListener("scroll", scrollHandle)
    }
  }, [])

  const activeItem = [...menuItems[0].items, ...menuItems[1].items].find(
    item => item.key === activeMenu,
  )

  return (
    <Modal
      isShow
      onClose={() => {}}
      className={s.modal}
      wrapperClassName="pt-[60px]">
      <div className="flex">
        <div className="sm:shrink-1 flex w-[44px] shrink-0 flex-col items-center border border-gray-100 px-[1px] py-4 sm:w-[200px] sm:items-start sm:p-4">
          <div className="mb-8 ml-0 text-sm font-medium leading-6 text-gray-900 sm:ml-2 sm:text-base">
            {t("common.userProfile.settings")}
          </div>
          <div className="w-full">
            {menuItems.map(menuItem => (
              <div key={menuItem.key} className="mb-4">
                <div className="mb-[6px] px-2 text-[10px] font-medium text-gray-500 sm:text-xs">
                  {menuItem.name}
                </div>
                <div>
                  {menuItem.items.map(item => (
                    <div
                      key={item.key}
                      className={`mb-[2px] flex h-[37px] cursor-pointer items-center rounded-lg text-sm ${activeMenu === item.key ? "text-primary-600 bg-primary-50 font-semibold" : "font-light text-gray-700"} `}
                      title={item.name}
                      onClick={() => setActiveMenu(item.key)}>
                      {activeMenu === item.key ? item.activeIcon : item.icon}
                      {!isMobile && <div className="truncate">{item.name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="relative h-[720px] w-[824px] overflow-y-auto pb-4">
          <div
            className={cn(
              "sticky top-0 z-20 mb-4 flex h-14 items-center bg-white px-6 py-4 text-base font-medium text-gray-900",
              scrolled && scrolledClassName,
            )}>
            <div className="shrink-0">{activeItem?.name}</div>
            {activeItem?.description && (
              <div className="ml-2 shrink-0 text-xs text-gray-600">
                {activeItem?.description}
              </div>
            )}
            <div className="flex grow justify-end">
              <div
                className="-mr-4 flex h-6 w-6 cursor-pointer items-center justify-center"
                onClick={onCancel}>
                <RiCloseLine className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
          <div className="px-4 pt-2 sm:px-8">
            {activeMenu === "account" && <AccountPage />}
            {activeMenu === "members" && <MembersPage />}
            {activeMenu === "billing" && <BillingPage />}
            {activeMenu === "integrations" && <IntegrationsPage />}
            {activeMenu === "language" && <LanguagePage />}
            {activeMenu === "provider" && <ModelProviderPage />}
            {activeMenu === "data-source" && <DataSourcePage />}
            {activeMenu === "api-based-extension" && <ApiBasedExtensionPage />}
            {activeMenu === "custom" && <CustomPage />}
          </div>
        </div>
      </div>
    </Modal>
  )
}
