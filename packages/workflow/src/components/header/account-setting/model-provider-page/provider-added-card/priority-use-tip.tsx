import { useTranslation } from "react-i18next"
import { ChevronDownDouble } from "@/components/base/icons/src/vender/line/arrows"
import Tooltip from "@/components/base/tooltip"

const PriorityUseTip = () => {
  const { t } = useTranslation()

  return (
    <Tooltip
      selector="provider-quota-credential-priority-using"
      content={t("common.modelProvider.priorityUsing") || ""}>
      <div className="absolute -right-[5px] -top-[5px] cursor-pointer rounded-[5px] border-[0.5px] border-indigo-100 bg-indigo-50">
        <ChevronDownDouble className="h-3 w-3 rotate-180 text-indigo-600" />
      </div>
    </Tooltip>
  )
}

export default PriorityUseTip
