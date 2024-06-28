import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DocumentProcessingPriority, Plan } from "../type"
import { useProviderContext } from "@/context/provider-context"
import {
  ZapFast,
  ZapNarrow,
} from "@/components/base/icons/src/vender/solid/general"
import TooltipPlus from "@/components/base/tooltip-plus"

const PriorityLabel = () => {
  const { t } = useTranslation()
  const { plan } = useProviderContext()

  const priority = useMemo(() => {
    if (plan.type === Plan.sandbox) return DocumentProcessingPriority.standard

    if (plan.type === Plan.professional)
      return DocumentProcessingPriority.priority

    if (plan.type === Plan.team || plan.type === Plan.enterprise)
      return DocumentProcessingPriority.topPriority
  }, [plan])

  return (
    <TooltipPlus
      popupContent={
        <div>
          <div className="mb-1 text-xs font-semibold text-gray-700">{`${t("billing.plansCommon.documentProcessingPriority")}: ${t(`billing.plansCommon.priority.${priority}`)}`}</div>
          {priority !== DocumentProcessingPriority.topPriority && (
            <div className="text-xs text-gray-500">
              {t("billing.plansCommon.documentProcessingPriorityTip")}
            </div>
          )}
        </div>
      }>
      <span
        className={`ml-1 flex h-[18px] items-center rounded border border-[#C7D7FE] px-[5px] text-[10px] font-medium text-[#3538CD]`}>
        {plan.type === Plan.professional && (
          <ZapNarrow className="mr-0.5 h-3 w-3" />
        )}
        {(plan.type === Plan.team || plan.type === Plan.enterprise) && (
          <ZapFast className="mr-0.5 h-3 w-3" />
        )}
        {t(`billing.plansCommon.priority.${priority}`)}
      </span>
    </TooltipPlus>
  )
}

export default PriorityLabel
