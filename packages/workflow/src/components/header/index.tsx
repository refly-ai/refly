"use client"
import { useCallback, useEffect } from "react"
import Link from "next/link"
import { useBoolean } from "ahooks"
import { useSelectedLayoutSegment } from "next/navigation"
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
    <div className="flex flex-1 items-center justify-between px-4">
      <div className="flex items-center">
        {isMobile && (
          <div
            className="flex h-8 w-8 cursor-pointer items-center justify-center"
            onClick={toggle}>
            <Bars3Icon className="h-4 w-4 text-gray-500" />
          </div>
        )}
        {!isMobile && (
          <>
            <Link href="/apps" className="mr-4 flex items-center">
              <LogoSite className="object-contain" />
            </Link>
            <GithubStar />
          </>
        )}
      </div>
      {isMobile && (
        <div className="flex">
          <Link href="/apps" className="mr-4 flex items-center">
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
      <div className="flex flex-shrink-0 items-center">
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
        <div className="flex w-full flex-col gap-y-1 p-2">
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
