"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { RiQuestionLine } from "@remixicon/react"
import { MessageSmileSquare } from "@/components/base/icons/src/vender/solid/communication"
import TooltipPlus from "@/components/base/tooltip-plus"

const SuggestedQuestionsAfterAnswer: FC = () => {
  const { t } = useTranslation()

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-gray-50 px-3">
      <div className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center">
        <MessageSmileSquare className="h-4 w-4 text-[#06AED4]" />
      </div>
      <div className="mr-2 flex shrink-0 items-center whitespace-nowrap text-sm font-semibold text-gray-800">
        <div className="mr-2">
          {t("appDebug.feature.suggestedQuestionsAfterAnswer.title")}
        </div>
        <TooltipPlus
          popupContent={t(
            "appDebug.feature.suggestedQuestionsAfterAnswer.description",
          )}>
          <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
        </TooltipPlus>
      </div>
      <div className="grow"></div>
      <div className="text-xs text-gray-500">
        {t("appDebug.feature.suggestedQuestionsAfterAnswer.resDes")}
      </div>
    </div>
  )
}
export default React.memo(SuggestedQuestionsAfterAnswer)
