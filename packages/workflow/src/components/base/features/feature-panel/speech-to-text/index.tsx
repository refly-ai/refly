"use client"
import React, { type FC } from "react"
import { useTranslation } from "react-i18next"
import { Microphone01 } from "@/components/base/icons/src/vender/solid/mediaAndDevices"

const SpeechToTextConfig: FC = () => {
  const { t } = useTranslation()

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-gray-50 px-3">
      <div className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center">
        <Microphone01 className="h-4 w-4 text-[#7839EE]" />
      </div>
      <div className="mr-2 flex shrink-0 items-center whitespace-nowrap text-sm font-semibold text-gray-800">
        <div>{t("appDebug.feature.speechToText.title")}</div>
      </div>
      <div className="grow"></div>
      <div className="text-xs text-gray-500">
        {t("appDebug.feature.speechToText.resDes")}
      </div>
    </div>
  )
}
export default React.memo(SpeechToTextConfig)
