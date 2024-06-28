"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import UpgradeBtn from "../upgrade-btn"
import AppsInfo from "../usage-info/apps-info"
import s from "./style.module.css"
import GridMask from "@/components/base/grid-mask"

const AppsFull: FC<{ loc: string }> = ({ loc }) => {
  const { t } = useTranslation()

  return (
    <GridMask
      wrapperClassName="rounded-lg"
      canvasClassName="rounded-lg"
      gradientClassName="rounded-lg">
      <div className="mt-6 flex cursor-pointer flex-col rounded-lg border-2 border-solid border-transparent px-3.5 py-4 shadow-md transition-all duration-200 ease-in-out">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              s.textGradient,
              "text-base font-semibold leading-[24px]",
            )}>
            <div>{t("billing.apps.fullTipLine1")}</div>
            <div>{t("billing.apps.fullTipLine2")}</div>
          </div>
          <div className="flex">
            <UpgradeBtn loc={loc} />
          </div>
        </div>
        <AppsInfo className="mt-4" />
      </div>
    </GridMask>
  )
}
export default React.memo(AppsFull)
