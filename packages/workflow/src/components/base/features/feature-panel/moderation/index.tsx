import { memo } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"
import produce from "immer"
import { useContext } from "use-context-selector"
import { useFeatures, useFeaturesStore } from "../../hooks"
import type { OnFeaturesChange } from "../../types"
import { FileSearch02 } from "@/components/base/icons/src/vender/solid/files"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import { useModalContext } from "@/context/modal-context"
import { fetchCodeBasedExtensionList } from "@/service/common"
import I18n from "@/context/i18n"

type ModerationProps = {
  onChange?: OnFeaturesChange
  disabled?: boolean
}
const Moderation = ({ onChange, disabled }: ModerationProps) => {
  const { t } = useTranslation()
  const { setShowModerationSettingModal } = useModalContext()
  const { locale } = useContext(I18n)
  const featuresStore = useFeaturesStore()
  const moderation = useFeatures(s => s.features.moderation)

  const { data: codeBasedExtensionList } = useSWR(
    "/code-based-extension?module=moderation",
    fetchCodeBasedExtensionList,
  )

  const handleOpenModerationSettingModal = () => {
    if (disabled) return

    const { features, setFeatures } = featuresStore!.getState()
    setShowModerationSettingModal({
      payload: moderation as any,
      onSaveCallback: newModeration => {
        const newFeatures = produce(features, draft => {
          draft.moderation = newModeration
        })
        setFeatures(newFeatures)
        if (onChange) onChange(newFeatures)
      },
    })
  }

  const renderInfo = () => {
    let prefix = ""
    let suffix = ""
    if (moderation?.type === "openai_moderation")
      prefix = t("appDebug.feature.moderation.modal.provider.openai")
    else if (moderation?.type === "keywords")
      prefix = t("appDebug.feature.moderation.modal.provider.keywords")
    else if (moderation?.type === "api")
      prefix = t("common.apiBasedExtension.selector.title")
    else
      prefix =
        codeBasedExtensionList?.data.find(
          item => item.name === moderation?.type,
        )?.label[locale] || ""

    if (
      moderation?.config?.inputs_config?.enabled &&
      moderation.config?.outputs_config?.enabled
    )
      suffix = t("appDebug.feature.moderation.allEnabled")
    else if (moderation?.config?.inputs_config?.enabled)
      suffix = t("appDebug.feature.moderation.inputEnabled")
    else if (moderation?.config?.outputs_config?.enabled)
      suffix = t("appDebug.feature.moderation.outputEnabled")

    return `${prefix} · ${suffix}`
  }

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-gray-50 px-3">
      <div className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center">
        <FileSearch02 className="h-4 w-4 shrink-0 text-[#039855]" />
      </div>
      <div className="mr-2 shrink-0 whitespace-nowrap text-sm font-semibold text-gray-800">
        {t("appDebug.feature.moderation.title")}
      </div>
      <div
        className="block w-0 grow truncate text-right text-xs text-gray-500"
        title={renderInfo()}>
        {renderInfo()}
      </div>
      <div className="ml-4 mr-1 h-3.5 w-[1px] shrink-0 bg-gray-200"></div>
      <div
        className={`flex h-7 shrink-0 cursor-pointer items-center rounded-md px-3 text-xs font-medium text-gray-700 hover:bg-gray-200 ${disabled && "!cursor-not-allowed"} `}
        onClick={handleOpenModerationSettingModal}>
        <Settings01 className="mr-[5px] h-3.5 w-3.5" />
        {t("common.operation.settings")}
      </div>
    </div>
  )
}

export default memo(Moderation)
