"use client"
import React, { type FC } from "react"
import { useTranslation } from "react-i18next"
import Panel from "@/components/configuration/base/feature-panel"
import { Citations } from "@/components/base/icons/src/vender/solid/editor"

const Citation: FC = () => {
  const { t } = useTranslation()

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <div>{t("appDebug.feature.citation.title")}</div>
        </div>
      }
      headerIcon={<Citations className="h-4 w-4 text-[#FD853A]" />}
      headerRight={
        <div className="text-xs text-gray-500">
          {t("appDebug.feature.citation.resDes")}
        </div>
      }
      noBodySpacing
    />
  )
}
export default React.memo(Citation)
