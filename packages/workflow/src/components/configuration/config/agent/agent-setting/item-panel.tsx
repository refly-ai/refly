"use client"
import type { FC } from "react"
import React from "react"
import cn from "classnames"
import { RiQuestionLine } from "@remixicon/react"
import Tooltip from "@/components/base/tooltip"
type Props = {
  className?: string
  icon: JSX.Element
  name: string
  description: string
  children: JSX.Element
}

const ItemPanel: FC<Props> = ({
  className,
  icon,
  name,
  description,
  children,
}) => {
  return (
    <div
      className={cn(
        className,
        "flex h-12 items-center justify-between rounded-lg bg-gray-50 px-3",
      )}>
      <div className="flex items-center">
        {icon}
        <div className="ml-3 mr-1 text-sm font-semibold leading-6 text-gray-800">
          {name}
        </div>
        <Tooltip
          htmlContent={<div className="w-[180px]">{description}</div>}
          selector={`agent-setting-tooltip-${name}`}>
          <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
        </Tooltip>
      </div>
      <div>{children}</div>
    </div>
  )
}
export default React.memo(ItemPanel)
