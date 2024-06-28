import type { FC } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiArrowDownSLine } from "@remixicon/react"
import type { Model, ModelItem, ModelProvider } from "../declarations"
import { MODEL_STATUS_TEXT } from "../declarations"
import { useLanguage } from "../hooks"
import ModelIcon from "../model-icon"
import ModelName from "../model-name"
import { useProviderContext } from "@/context/provider-context"
import { SlidersH } from "@/components/base/icons/src/vender/line/mediaAndDevices"
import { AlertTriangle } from "@/components/base/icons/src/vender/line/alertsAndFeedback"
import TooltipPlus from "@/components/base/tooltip-plus"

export type TriggerProps = {
  open?: boolean
  disabled?: boolean
  currentProvider?: ModelProvider | Model
  currentModel?: ModelItem
  providerName?: string
  modelId?: string
  hasDeprecated?: boolean
  modelDisabled?: boolean
  isInWorkflow?: boolean
}
const Trigger: FC<TriggerProps> = ({
  disabled,
  currentProvider,
  currentModel,
  providerName,
  modelId,
  hasDeprecated,
  modelDisabled,
  isInWorkflow,
}) => {
  const { t } = useTranslation()
  const language = useLanguage()
  const { modelProviders } = useProviderContext()

  return (
    <div
      className={cn(
        "relative flex h-8 cursor-pointer items-center rounded-lg px-2",
        !isInWorkflow && "border hover:border-[1.5px]",
        !isInWorkflow &&
          (disabled
            ? "border-[#F79009] bg-[#FFFAEB]"
            : "bg-primary-50 border-[#444CE7]"),
        isInWorkflow &&
          "border border-gray-100 bg-gray-100 pr-[30px] hover:border-gray-200",
      )}>
      {currentProvider && (
        <ModelIcon
          className="mr-1.5 !h-5 !w-5"
          provider={currentProvider}
          modelName={currentModel?.model}
        />
      )}
      {!currentProvider && (
        <ModelIcon
          className="mr-1.5 !h-5 !w-5"
          provider={modelProviders.find(item => item.provider === providerName)}
          modelName={modelId}
        />
      )}
      {currentModel && (
        <ModelName
          className="mr-1.5 text-gray-900"
          modelItem={currentModel}
          showMode
          modeClassName={cn(
            !isInWorkflow
              ? "!text-[#444CE7] !border-[#A4BCFD]"
              : "!text-gray-500 !border-black/8",
          )}
          showFeatures
          featuresClassName={cn(
            !isInWorkflow
              ? "!text-[#444CE7] !border-[#A4BCFD]"
              : "!text-gray-500 !border-black/8",
          )}
        />
      )}
      {!currentModel && (
        <div className="mr-1 truncate text-[13px] font-medium text-gray-900">
          {modelId}
        </div>
      )}
      {disabled ? (
        <TooltipPlus
          popupContent={
            hasDeprecated
              ? t("common.modelProvider.deprecated")
              : modelDisabled && currentModel
                ? MODEL_STATUS_TEXT[currentModel.status as string][language]
                : ""
          }>
          <AlertTriangle className="h-4 w-4 text-[#F79009]" />
        </TooltipPlus>
      ) : (
        <SlidersH
          className={cn(
            !isInWorkflow ? "text-indigo-600" : "text-gray-500",
            "h-4 w-4 shrink-0",
          )}
        />
      )}
      {isInWorkflow && (
        <RiArrowDownSLine className="absolute right-2 top-[9px] h-3.5 w-3.5 text-gray-500" />
      )}
    </div>
  )
}

export default Trigger
