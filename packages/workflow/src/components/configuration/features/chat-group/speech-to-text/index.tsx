"use client"
import React, { type FC } from "react"
import { useTranslation } from "react-i18next"
import Panel from "@/components/configuration/base/feature-panel"
import { Microphone01 } from "@/components/base/icons/src/vender/solid/mediaAndDevices"

const SpeechToTextConfig: FC = () => {
  const { t } = useTranslation()

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <div>{t("appDebug.feature.speechToText.title")}</div>
        </div>
      }
      headerIcon={<Microphone01 className="h-4 w-4 text-[#7839EE]" />}
      headerRight={
        <div className="text-xs text-gray-500">
          {t("appDebug.feature.speechToText.resDes")}
        </div>
      }
      noBodySpacing
    />
  )
}
export default React.memo(SpeechToTextConfig)
