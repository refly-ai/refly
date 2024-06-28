"use client"
import type { FC } from "react"
import React, { useRef } from "react"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import Drawer from "@/components/base/drawer"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"

type Props = {
  isShow: boolean
  onHide: () => void
  panelClassName?: string
  maxWidthClassName?: string
  contentClassName?: string
  headerClassName?: string
  height?: number | string
  title: string | JSX.Element
  titleDescription?: string | JSX.Element
  body: JSX.Element
  foot?: JSX.Element
  isShowMask?: boolean
  clickOutsideNotOpen?: boolean
  positionCenter?: boolean
}

const DrawerPlus: FC<Props> = ({
  isShow,
  onHide,
  panelClassName = "",
  maxWidthClassName = "!max-w-[640px]",
  height = "calc(100vh - 72px)",
  contentClassName,
  headerClassName,
  title,
  titleDescription,
  body,
  foot,
  isShowMask,
  clickOutsideNotOpen = true,
  positionCenter,
}) => {
  const ref = useRef(null)
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  if (!isShow) return null

  return (
    // clickOutsideNotOpen to fix confirm modal click cause drawer close
    <Drawer
      isOpen={isShow}
      clickOutsideNotOpen={clickOutsideNotOpen}
      onClose={onHide}
      footer={null}
      mask={isMobile || isShowMask}
      positionCenter={positionCenter}
      panelClassname={cn(
        "mt-16 mx-2 sm:mr-2 mb-3 !p-0 rounded-xl",
        panelClassName,
        maxWidthClassName,
      )}>
      <div
        className={cn(
          contentClassName,
          "flex w-full flex-col rounded-xl border-[0.5px] border-gray-200 bg-white shadow-xl",
        )}
        style={{
          height,
        }}
        ref={ref}>
        <div
          className={cn(
            headerClassName,
            "shrink-0 border-b border-b-gray-100 py-4",
          )}>
          <div className="flex h-6 items-center justify-between pl-6 pr-5">
            <div className="text-base font-semibold text-gray-900">{title}</div>
            <div className="flex items-center">
              <div
                onClick={onHide}
                className="flex h-6 w-6 cursor-pointer items-center justify-center">
                <RiCloseLine className="h-4 w-4 text-gray-500" />
              </div>
            </div>
          </div>
          {titleDescription && (
            <div className="pl-6 pr-10 text-xs font-normal leading-[18px] text-gray-500">
              {titleDescription}
            </div>
          )}
        </div>
        <div className="grow overflow-y-auto">{body}</div>
        {foot && <div className="shrink-0">{foot}</div>}
      </div>
    </Drawer>
  )
}
export default React.memo(DrawerPlus)
