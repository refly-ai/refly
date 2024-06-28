"use client"
import type { FC } from "react"
import React from "react"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import OperationBtn from "@/components/configuration/base/operation-btn"
import Panel from "@/components/configuration/base/feature-panel"
import { MessageClockCircle } from "@/components/base/icons/src/vender/solid/general"
import I18n from "@/context/i18n"
import { LanguagesSupported } from "@/i18n/language"

type Props = {
  showWarning: boolean
  onShowEditModal: () => void
}

const HistoryPanel: FC<Props> = ({ showWarning, onShowEditModal }) => {
  const { t } = useTranslation()
  const { locale } = useContext(I18n)

  return (
    <Panel
      className="mt-3"
      title={
        <div className="flex items-center gap-2">
          <div>{t("appDebug.feature.conversationHistory.title")}</div>
        </div>
      }
      headerIcon={
        <div className="shadow-xs rounded-md bg-white p-1">
          <MessageClockCircle className="h-4 w-4 text-[#DD2590]" />
        </div>
      }
      headerRight={
        <div className="flex items-center">
          <div className="text-xs text-gray-500">
            {t("appDebug.feature.conversationHistory.description")}
          </div>
          <div className="ml-3 h-[14px] w-[1px] bg-gray-200"></div>
          <OperationBtn type="edit" onClick={onShowEditModal} />
        </div>
      }
      noBodySpacing>
      {showWarning && (
        <div className="flex justify-between rounded-b-xl bg-[#FFFAEB] px-3 py-2 text-xs text-gray-700">
          <div>
            {t("appDebug.feature.conversationHistory.tip")}
            <a
              href={`${
                locale === LanguagesSupported[1]
                  ? "https://docs.dify.ai/v/zh-hans/guides/application-design/prompt-engineering"
                  : "https://docs.dify.ai/features/prompt-engineering"
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#155EEF]">
              {t("appDebug.feature.conversationHistory.learnMore")}
            </a>
          </div>
        </div>
      )}
    </Panel>
  )
}
export default React.memo(HistoryPanel)
