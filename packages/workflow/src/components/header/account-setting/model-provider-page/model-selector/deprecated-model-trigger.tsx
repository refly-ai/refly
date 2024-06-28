import type { FC } from "react"
import { useTranslation } from "react-i18next"
import ModelIcon from "../model-icon"
import { AlertTriangle } from "@/components/base/icons/src/vender/line/alertsAndFeedback"
import { useProviderContext } from "@/context/provider-context"
import TooltipPlus from "@/components/base/tooltip-plus"

type ModelTriggerProps = {
  modelName: string
  providerName: string
  className?: string
}
const ModelTrigger: FC<ModelTriggerProps> = ({
  modelName,
  providerName,
  className,
}) => {
  const { t } = useTranslation()
  const { modelProviders } = useProviderContext()
  const currentProvider = modelProviders.find(
    provider => provider.provider === providerName,
  )

  return (
    <div
      className={`group flex h-8 cursor-pointer items-center rounded-lg bg-[#FFFAEB] px-2 ${className} `}>
      <ModelIcon
        className="mr-1.5 shrink-0"
        provider={currentProvider}
        modelName={modelName}
      />
      <div className="mr-1 truncate text-[13px] font-medium text-gray-800">
        {modelName}
      </div>
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <TooltipPlus popupContent={t("common.modelProvider.deprecated")}>
          <AlertTriangle className="h-4 w-4 text-[#F79009]" />
        </TooltipPlus>
      </div>
    </div>
  )
}

export default ModelTrigger
