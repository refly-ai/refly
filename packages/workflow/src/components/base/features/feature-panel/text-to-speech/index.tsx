"use client"
import useSWR from "swr"
import React from "react"
import { useTranslation } from "react-i18next"
import { usePathname } from "next/navigation"
import { useFeatures } from "../../hooks"
import type { OnFeaturesChange } from "../../types"
import ParamsConfig from "./params-config"
import { Speaker } from "@/components/base/icons/src/vender/solid/mediaAndDevices"
import { languages } from "@/i18n/language"
import { fetchAppVoices } from "@/service/apps"
import AudioBtn from "@/components/base/audio-btn"

type TextToSpeechProps = {
  onChange?: OnFeaturesChange
  disabled?: boolean
}
const TextToSpeech = ({ onChange, disabled }: TextToSpeechProps) => {
  const { t } = useTranslation()
  const textToSpeech = useFeatures(s => s.features.text2speech)

  const pathname = usePathname()
  const matched = pathname.match(/\/app\/([^/]+)/)
  const appId = matched?.length && matched[1] ? matched[1] : ""
  const language = textToSpeech?.language
  const languageInfo = languages.find(i => i.value === textToSpeech?.language)

  const voiceItems = useSWR({ appId, language }, fetchAppVoices).data
  const voiceItem = voiceItems?.find(item => item.value === textToSpeech?.voice)

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-gray-50 px-3">
      <div className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center">
        <Speaker className="h-4 w-4 text-[#7839EE]" />
      </div>
      <div className="mr-2 shrink-0 whitespace-nowrap text-sm font-semibold text-gray-800">
        {t("appDebug.feature.textToSpeech.title")}
      </div>
      <div className="grow"></div>
      <div className="inline-flex shrink-0 items-center gap-2 text-xs text-gray-500">
        {languageInfo && `${languageInfo?.name} - `}
        {voiceItem?.name ?? t("appDebug.voice.defaultDisplay")}
        {languageInfo?.example && (
          <AudioBtn
            value={languageInfo?.example}
            voice={voiceItem?.value}
            noCache={false}
            isAudition={true}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center">
        <ParamsConfig onChange={onChange} disabled={disabled} />
      </div>
    </div>
  )
}
export default React.memo(TextToSpeech)
