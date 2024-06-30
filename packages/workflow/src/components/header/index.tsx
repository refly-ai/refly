"use client"
import { useCallback, useEffect } from "react"
import Link from "next/link"
import { useBoolean } from "ahooks"
import { Bars3Icon } from "@heroicons/react/20/solid"
import HeaderBillingBtn from "../billing/header-billing-btn"
import AccountDropdown from "./account-dropdown"
import AppNav from "./app-nav"
import DatasetNav from "./dataset-nav"
import EnvNav from "./env-nav"
import ExploreNav from "./explore-nav"
import ToolsNav from "./tools-nav"
import GithubStar from "./github-star"
import { WorkspaceProvider } from "@/context/workspace-context"
import { useAppContext } from "@/context/app-context"
import LogoSite from "@/components/base/logo/logo-site"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"
import { useProviderContext } from "@/context/provider-context"
import { useModalContext } from "@/context/modal-context"
import { useSelectedLayoutSegment } from "@/hooks/use-selected-layout-segment"

const navClassName = `
  flex items-center relative mr-0 sm:mr-3 px-3 h-8 rounded-xl
  font-medium text-sm
  cursor-pointer
`

const Header = () => {
  const { isCurrentWorkspaceEditor } = useAppContext()

  const selectedSegment = useSelectedLayoutSegment()
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile
  const [isShowNavMenu, { toggle, setFalse: hideNavMenu }] = useBoolean(false)
  const { enableBilling, plan } = useProviderContext()
  const { setShowPricingModal, setShowAccountSettingModal } = useModalContext()
  const isFreePlan = plan.type === "sandbox"
  const handlePlanClick = useCallback(() => {
    if (isFreePlan) setShowPricingModal()
    else setShowAccountSettingModal({ payload: "billing" })
  }, [isFreePlan, setShowAccountSettingModal, setShowPricingModal])

  useEffect(() => {
    hideNavMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment])
  return (
    <div className="flex items-center justify-between flex-1 px-4">
      <div className="flex items-center">
        {isMobile && (
          <div
            className="flex items-center justify-center w-8 h-8 cursor-pointer"
            onClick={toggle}>
            <Bars3Icon className="w-4 h-4 text-gray-500" />
          </div>
        )}
        {!isMobile && (
          <>
            <Link href="/apps" className="flex items-center mr-4">
              <LogoSite className="object-contain" />
            </Link>
            <GithubStar />
          </>
        )}
      </div>
      {isMobile && (
        <div className="flex">
          <Link href="/apps" className="flex items-center mr-4">
            <LogoSite />
          </Link>
          <GithubStar />
        </div>
      )}
      {!isMobile && (
        <div className="flex items-center">
          <ExploreNav className={navClassName} />
          <AppNav />
          {isCurrentWorkspaceEditor && <DatasetNav />}
          <ToolsNav className={navClassName} />
        </div>
      )}
      <div className="flex items-center flex-shrink-0">
        <EnvNav />
        {enableBilling && (
          <div className="mr-3 select-none">
            <HeaderBillingBtn onClick={handlePlanClick} />
          </div>
        )}
        <WorkspaceProvider>
          <AccountDropdown isMobile={isMobile} />
        </WorkspaceProvider>
      </div>
      {isMobile && isShowNavMenu && (
        <div className="flex flex-col w-full p-2 gap-y-1">
          <ExploreNav className={navClassName} />
          <AppNav />
          {isCurrentWorkspaceEditor && <DatasetNav />}
          <ToolsNav className={navClassName} />
        </div>
      )}
    </div>
  )
}
export default Header
