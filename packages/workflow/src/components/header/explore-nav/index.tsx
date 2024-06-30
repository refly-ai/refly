"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import classNames from "classnames"
import { RiPlanetFill, RiPlanetLine } from "@remixicon/react"
import { useSelectedLayoutSegment } from "@/hooks/use-selected-layout-segment"
type ExploreNavProps = {
  className?: string
}

const ExploreNav = ({ className }: ExploreNavProps) => {
  const { t } = useTranslation()
  const selectedSegment = useSelectedLayoutSegment()
  const actived = selectedSegment === "explore"

  return (
    <Link
      href="/explore/apps"
      className={classNames(
        className,
        "group",
        actived && "bg-white shadow-md",
        actived ? "text-primary-600" : "text-gray-500 hover:bg-gray-200",
      )}>
      {actived ? (
        <RiPlanetFill className="w-4 h-4 mr-2" />
      ) : (
        <RiPlanetLine className="w-4 h-4 mr-2" />
      )}
      {t("common.menus.explore")}
    </Link>
  )
}

export default ExploreNav
