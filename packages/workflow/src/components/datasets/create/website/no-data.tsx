"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { Icon3Dots } from "@/components/base/icons/src/vender/line/others"
import Button from "@/components/base/button"

const I18N_PREFIX = "datasetCreation.stepOne.website"

type Props = {
  onConfig: () => void
}

const NoData: FC<Props> = ({ onConfig }) => {
  const { t } = useTranslation()

  return (
    <div className="max-w-[640px] rounded-2xl bg-gray-50 p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border-[0.5px] border-gray-100 bg-gray-50 shadow-lg">
        🔥
      </div>
      <div className="my-2">
        <span className="font-semibold text-gray-700">
          {t(`${I18N_PREFIX}.fireCrawlNotConfigured`)}
          <Icon3Dots className="relative -left-1.5 -top-3 inline" />
        </span>
        <div className="mt-1 pb-3 text-[13px] font-normal text-gray-500">
          {t(`${I18N_PREFIX}.fireCrawlNotConfiguredDescription`)}
        </div>
      </div>
      <Button variant="primary" onClick={onConfig}>
        {t(`${I18N_PREFIX}.configure`)}
      </Button>
    </div>
  )
}
export default React.memo(NoData)
