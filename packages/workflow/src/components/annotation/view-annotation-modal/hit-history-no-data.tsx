"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { ClockFastForward } from "@/components/base/icons/src/vender/line/time"

const HitHistoryNoData: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="mx-auto mt-20 w-[480px] space-y-2 rounded-2xl bg-gray-50 p-5">
      <div className="inline-block rounded-lg border border-gray-200 p-3">
        <ClockFastForward className="h-5 w-5 text-gray-500" />
      </div>
      <div className="text-sm font-normal leading-5 text-gray-500">
        {t("appAnnotation.viewModal.noHitHistory")}
      </div>
    </div>
  )
}

export default React.memo(HitHistoryNoData)
