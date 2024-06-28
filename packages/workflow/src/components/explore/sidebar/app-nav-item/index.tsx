"use client"
import cn from "classnames"
import React, { useRef } from "react"

import { useRouter } from "next/navigation"
import { useHover } from "ahooks"
import s from "./style.module.css"
import ItemOperation from "@/components/explore/item-operation"
import AppIcon from "@/components/base/app-icon"

export type IAppNavItemProps = {
  isMobile: boolean
  name: string
  id: string
  icon: string
  icon_background: string
  isSelected: boolean
  isPinned: boolean
  togglePin: () => void
  uninstallable: boolean
  onDelete: (id: string) => void
}

export default function AppNavItem({
  isMobile,
  name,
  id,
  icon,
  icon_background,
  isSelected,
  isPinned,
  togglePin,
  uninstallable,
  onDelete,
}: IAppNavItemProps) {
  const router = useRouter()
  const url = `/explore/installed/${id}`
  const ref = useRef(null)
  const isHovering = useHover(ref)
  return (
    <div
      ref={ref}
      key={id}
      className={cn(
        s.item,
        isSelected ? s.active : "hover:bg-gray-200",
        "mobile:justify-center mobile:px-1 flex h-8 items-center justify-between rounded-lg px-2 text-sm font-normal",
      )}
      onClick={() => {
        router.push(url) // use Link causes popup item always trigger jump. Can not be solved by e.stopPropagation().
      }}>
      {isMobile && (
        <AppIcon size="tiny" icon={icon} background={icon_background} />
      )}
      {!isMobile && (
        <>
          <div className="flex w-0 grow items-center space-x-2">
            <AppIcon size="tiny" icon={icon} background={icon_background} />
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              title={name}>
              {name}
            </div>
          </div>
          <div className="h-6 shrink-0" onClick={e => e.stopPropagation()}>
            <ItemOperation
              isPinned={isPinned}
              isItemHovering={isHovering}
              togglePin={togglePin}
              isShowDelete={!uninstallable && !isSelected}
              onDelete={() => onDelete(id)}
            />
          </div>
        </>
      )}
    </div>
  )
}
