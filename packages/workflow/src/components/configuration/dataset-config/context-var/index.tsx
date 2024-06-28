"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiQuestionLine } from "@remixicon/react"
import type { Props } from "./var-picker"
import VarPicker from "./var-picker"
import { BracketsX } from "@/components/base/icons/src/vender/line/development"
import Tooltip from "@/components/base/tooltip"

const ContextVar: FC<Props> = props => {
  const { t } = useTranslation()
  const { value, options } = props
  const currItem = options.find(item => item.value === value)
  const notSetVar = !currItem
  return (
    <div
      className={cn(
        notSetVar
          ? "rounded-bl-xl rounded-br-xl border-[#FEF0C7] bg-[#FEF0C7]"
          : "border-gray-200",
        "flex h-12 items-center justify-between border-t px-3",
      )}>
      <div className="flex shrink-0 items-center space-x-1">
        <div className="p-1">
          <BracketsX className="text-primary-500 h-4 w-4" />
        </div>
        <div className="mr-1 text-sm font-medium text-gray-800">
          {t("appDebug.feature.dataSet.queryVariable.title")}
        </div>
        <Tooltip
          htmlContent={
            <div className="w-[180px]">
              {t("appDebug.feature.dataSet.queryVariable.tip")}
            </div>
          }
          selector="context-var-tooltip">
          <RiQuestionLine className="h-3.5 w-3.5 text-gray-400" />
        </Tooltip>
      </div>

      <VarPicker {...props} />
    </div>
  )
}

export default React.memo(ContextVar)
