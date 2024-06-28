import { useTranslation } from "react-i18next"
import useSWR from "swr"
import { useContext } from "use-context-selector"
import { FileSearch02 } from "@/components/base/icons/src/vender/solid/files"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import { useModalContext } from "@/context/modal-context"
import ConfigContext from "@/context/debug-configuration"
import { fetchCodeBasedExtensionList } from "@/service/common"
import I18n from "@/context/i18n"
const Moderation = () => {
  const { t } = useTranslation()
  const { setShowModerationSettingModal } = useModalContext()
  const { locale } = useContext(I18n)
  const { moderationConfig, setModerationConfig } = useContext(ConfigContext)
  const { data: codeBasedExtensionList } = useSWR(
    "/code-based-extension?module=moderation",
    fetchCodeBasedExtensionList,
  )

  const handleOpenModerationSettingModal = () => {
    setShowModerationSettingModal({
      payload: moderationConfig,
      onSaveCallback: setModerationConfig,
    })
  }

  const renderInfo = () => {
    let prefix = ""
    let suffix = ""
    if (moderationConfig.type === "openai_moderation")
      prefix = t("appDebug.feature.moderation.modal.provider.openai")
    else if (moderationConfig.type === "keywords")
      prefix = t("appDebug.feature.moderation.modal.provider.keywords")
    else if (moderationConfig.type === "api")
      prefix = t("common.apiBasedExtension.selector.title")
    else
      prefix =
        codeBasedExtensionList?.data.find(
          item => item.name === moderationConfig.type,
        )?.label[locale] || ""

    if (
      moderationConfig.config?.inputs_config?.enabled &&
      moderationConfig.config?.outputs_config?.enabled
    )
      suffix = t("appDebug.feature.moderation.allEnabled")
    else if (moderationConfig.config?.inputs_config?.enabled)
      suffix = t("appDebug.feature.moderation.inputEnabled")
    else if (moderationConfig.config?.outputs_config?.enabled)
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
        className={`flex h-7 shrink-0 cursor-pointer items-center rounded-md px-3 text-xs font-medium text-gray-700 hover:bg-gray-200`}
        onClick={handleOpenModerationSettingModal}>
        <Settings01 className="mr-[5px] h-3.5 w-3.5" />
        {t("common.operation.settings")}
      </div>
    </div>
  )
}

export default Moderation
