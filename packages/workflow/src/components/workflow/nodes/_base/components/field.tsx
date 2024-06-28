"use client"
import type { FC } from "react"
import React from "react"
import cn from "classnames"
import { RiArrowDownSLine, RiQuestionLine } from "@remixicon/react"
import { useBoolean } from "ahooks"
import type { DefaultTFuncReturn } from "i18next"
import TooltipPlus from "@/components/base/tooltip-plus"

type Props = {
  className?: string
  title: JSX.Element | string | DefaultTFuncReturn
  tooltip?: string
  supportFold?: boolean
  children?: JSX.Element | string | null
  operations?: JSX.Element
  inline?: boolean
}

const Filed: FC<Props> = ({
  className,
  title,
  tooltip,
  children,
  operations,
  inline,
  supportFold,
}) => {
  const [fold, { toggle: toggleFold }] = useBoolean(true)
  return (
    <div
      className={cn(
        className,
        inline && "flex w-full items-center justify-between",
      )}>
      <div
        onClick={() => supportFold && toggleFold()}
        className={cn(
          "flex items-center justify-between",
          supportFold && "cursor-pointer",
        )}>
        <div className="flex h-6 items-center">
          <div className="text-[13px] font-medium uppercase text-gray-700">
            {title}
          </div>
          {tooltip && (
            <TooltipPlus
              popupContent={<div className="w-[120px]">{tooltip}</div>}>
              <RiQuestionLine className="ml-0.5 h-3.5 w-3.5 text-gray-400" />
            </TooltipPlus>
          )}
        </div>
        <div className="flex">
          {operations && <div>{operations}</div>}
          {supportFold && (
            <RiArrowDownSLine
              className="h-3.5 w-3.5 transform cursor-pointer text-gray-500 transition-transform"
              style={{ transform: fold ? "rotate(0deg)" : "rotate(90deg)" }}
            />
          )}
        </div>
      </div>
      {children && (!supportFold || (supportFold && !fold)) && (
        <div className={cn(!inline && "mt-1")}>{children}</div>
      )}
    </div>
  )
}
export default React.memo(Filed)
