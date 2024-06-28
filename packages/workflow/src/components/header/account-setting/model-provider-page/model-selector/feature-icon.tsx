import type { FC } from "react"
import { useTranslation } from "react-i18next"
import ModelBadge from "../model-badge"
import { ModelFeatureEnum, ModelFeatureTextEnum } from "../declarations"
import {
  // MagicBox,
  MagicEyes,
  // MagicWand,
  // Robot,
} from "@/components/base/icons/src/vender/solid/mediaAndDevices"
import TooltipPlus from "@/components/base/tooltip-plus"

type FeatureIconProps = {
  feature: ModelFeatureEnum
  className?: string
}
const FeatureIcon: FC<FeatureIconProps> = ({ className, feature }) => {
  const { t } = useTranslation()

  // if (feature === ModelFeatureEnum.agentThought) {
  //   return (
  //     <TooltipPlus
  //       popupContent={t('common.modelProvider.featureSupported', { feature: ModelFeatureTextEnum.agentThought })}
  //     >
  //       <ModelBadge className={`mr-0.5 !px-0 w-[18px] justify-center text-gray-500 ${className}`}>
  //         <Robot className='w-3 h-3' />
  //       </ModelBadge>
  //     </TooltipPlus>
  //   )
  // }

  // if (feature === ModelFeatureEnum.toolCall) {
  //   return (
  //     <TooltipPlus
  //       popupContent={t('common.modelProvider.featureSupported', { feature: ModelFeatureTextEnum.toolCall })}
  //     >
  //       <ModelBadge className={`mr-0.5 !px-0 w-[18px] justify-center text-gray-500 ${className}`}>
  //         <MagicWand className='w-3 h-3' />
  //       </ModelBadge>
  //     </TooltipPlus>
  //   )
  // }

  // if (feature === ModelFeatureEnum.multiToolCall) {
  //   return (
  //     <TooltipPlus
  //       popupContent={t('common.modelProvider.featureSupported', { feature: ModelFeatureTextEnum.multiToolCall })}
  //     >
  //       <ModelBadge className={`mr-0.5 !px-0 w-[18px] justify-center text-gray-500 ${className}`}>
  //         <MagicBox className='w-3 h-3' />
  //       </ModelBadge>
  //     </TooltipPlus>
  //   )
  // }

  if (feature === ModelFeatureEnum.vision) {
    return (
      <TooltipPlus
        popupContent={t("common.modelProvider.featureSupported", {
          feature: ModelFeatureTextEnum.vision,
        })}>
        <ModelBadge
          className={`mr-0.5 w-[18px] justify-center !px-0 text-gray-500 ${className}`}>
          <MagicEyes className="h-3 w-3" />
        </ModelBadge>
      </TooltipPlus>
    )
  }

  return null
}

export default FeatureIcon
