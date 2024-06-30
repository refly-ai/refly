"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import classNames from "classnames"
import { RiHammerFill, RiHammerLine } from "@remixicon/react"
import { useSelectedLayoutSegment } from "@/hooks/use-selected-layout-segment"
type ToolsNavProps = {
  className?: string
}

const ToolsNav = ({ className }: ToolsNavProps) => {
  const { t } = useTranslation()
  const selectedSegment = useSelectedLayoutSegment()
  const actived = selectedSegment === "tools"

  return (
    <Link
      href="/tools"
      className={classNames(
        className,
        "group",
        actived && "bg-white shadow-md",
        actived ? "text-primary-600" : "text-gray-500 hover:bg-gray-200",
      )}>
      {actived ? (
        <RiHammerFill className="w-4 h-4 mr-2" />
      ) : (
        <RiHammerLine className="w-4 h-4 mr-2" />
      )}
      {t("common.menus.tools")}
    </Link>
  )
}

export default ToolsNav
