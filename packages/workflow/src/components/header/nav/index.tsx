"use client"

import React, { useState } from "react"
import Link from "next/link"
import classNames from "classnames"
import type { INavSelectorProps } from "./nav-selector"
import NavSelector from "./nav-selector"
import { ArrowNarrowLeft } from "@/components/base/icons/src/vender/line/arrows"
import { useStore as useAppStore } from "@/store"
import { useSelectedLayoutSegment } from "@/hooks/use-selected-layout-segment"

type INavProps = {
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  text: string
  activeSegment: string | string[]
  link: string
  isApp: boolean
} & INavSelectorProps

const Nav = ({
  icon,
  activeIcon,
  text,
  activeSegment,
  link,
  curNav,
  navs,
  createText,
  onCreate,
  onLoadmore,
  isApp,
}: INavProps) => {
  const setAppDetail = useAppStore(state => state.setAppDetail)
  const [hovered, setHovered] = useState(false)
  const segment = useSelectedLayoutSegment()
  const isActived = Array.isArray(activeSegment)
    ? activeSegment.includes(segment!)
    : segment === activeSegment

  return (
    <div
      className={`mr-0 flex h-8 shrink-0 items-center rounded-xl px-0.5 text-sm font-medium sm:mr-3 ${isActived && "bg-white font-semibold shadow-md"} ${!curNav && !isActived && "hover:bg-gray-200"} `}>
      <Link href={link}>
        <div
          onClick={() => setAppDetail()}
          className={classNames(
            `flex h-7 cursor-pointer items-center rounded-[10px] px-2.5 ${isActived ? "text-primary-600" : "text-gray-500"} ${curNav && isActived && "hover:bg-primary-50"} `,
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}>
          <div className="mr-2">
            {hovered && curNav ? (
              <ArrowNarrowLeft className="w-4 h-4" />
            ) : isActived ? (
              activeIcon
            ) : (
              icon
            )}
          </div>
          {text}
        </div>
      </Link>
      {curNav && isActived && (
        <>
          <div className="font-light text-gray-300">/</div>
          <NavSelector
            isApp={isApp}
            curNav={curNav}
            navs={navs}
            createText={createText}
            onCreate={onCreate}
            onLoadmore={onLoadmore}
          />
        </>
      )}
    </div>
  )
}

export default Nav
