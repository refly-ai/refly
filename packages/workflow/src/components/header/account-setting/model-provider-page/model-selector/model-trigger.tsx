import type { FC } from "react"
import { RiArrowDownSLine } from "@remixicon/react"
import type { Model, ModelItem } from "../declarations"
import { MODEL_STATUS_TEXT, ModelStatusEnum } from "../declarations"
import { useLanguage } from "../hooks"
import ModelIcon from "../model-icon"
import ModelName from "../model-name"
import { AlertTriangle } from "@/components/base/icons/src/vender/line/alertsAndFeedback"
import TooltipPlus from "@/components/base/tooltip-plus"

type ModelTriggerProps = {
  open: boolean
  provider: Model
  model: ModelItem
  className?: string
  readonly?: boolean
}
const ModelTrigger: FC<ModelTriggerProps> = ({
  open,
  provider,
  model,
  className,
  readonly,
}) => {
  const language = useLanguage()

  return (
    <div
      className={`group flex h-8 items-center rounded-lg bg-gray-100 px-2 ${!readonly && "cursor-pointer hover:bg-gray-200"} ${className} ${open && "!bg-gray-200"} ${model.status !== ModelStatusEnum.active && "!bg-[#FFFAEB]"} `}>
      <ModelIcon
        className="mr-1.5 shrink-0"
        provider={provider}
        modelName={model.model}
      />
      <ModelName className="grow" modelItem={model} showMode showFeatures />
      {!readonly && (
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          {model.status !== ModelStatusEnum.active ? (
            <TooltipPlus
              popupContent={MODEL_STATUS_TEXT[model.status][language]}>
              <AlertTriangle className="h-4 w-4 text-[#F79009]" />
            </TooltipPlus>
          ) : (
            <RiArrowDownSLine className="h-3.5 w-3.5 text-gray-500" />
          )}
        </div>
      )}
    </div>
  )
}

export default ModelTrigger
