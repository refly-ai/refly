import type { FC } from "react"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RiArrowDownSLine } from "@remixicon/react"
import Dropdown from "@/components/base/dropdown"
import { SlidersH } from "@/components/base/icons/src/vender/line/mediaAndDevices"
import { Brush01 } from "@/components/base/icons/src/vender/solid/editor"
import { Scales02 } from "@/components/base/icons/src/vender/solid/FinanceAndECommerce"
import { Target04 } from "@/components/base/icons/src/vender/solid/general"
import { TONE_LIST } from "@/config"

type PresetsParameterProps = {
  onSelect: (toneId: number) => void
}
const PresetsParameter: FC<PresetsParameterProps> = ({ onSelect }) => {
  const { t } = useTranslation()
  const renderTrigger = useCallback((open: boolean) => {
    return (
      <div
        className={`shadow-xs flex h-7 cursor-pointer items-center rounded-md border-[0.5px] border-gray-200 px-[7px] text-xs font-medium text-gray-700 ${open && "bg-gray-100"} `}>
        <SlidersH className="mr-[5px] h-3.5 w-3.5 text-gray-500" />
        {t("common.modelProvider.loadPresets")}
        <RiArrowDownSLine className="ml-0.5 h-3.5 w-3.5 text-gray-500" />
      </div>
    )
  }, [])
  const getToneIcon = (toneId: number) => {
    const className = "mr-2 w-[14px] h-[14px]"
    const res = {
      1: <Brush01 className={`${className} text-[#6938EF]`} />,
      2: <Scales02 className={`${className} text-indigo-600`} />,
      3: <Target04 className={`${className} text-[#107569]`} />,
    }[toneId]
    return res
  }
  const options = TONE_LIST.slice(0, 3).map(tone => {
    return {
      value: tone.id,
      text: (
        <div className="flex h-full items-center">
          {getToneIcon(tone.id)}
          {t(`common.model.tone.${tone.name}`) as string}
        </div>
      ),
    }
  })

  return (
    <Dropdown
      renderTrigger={renderTrigger}
      items={options}
      onSelect={item => onSelect(item.value as number)}
      popupClassName="z-[1003]"
    />
  )
}

export default PresetsParameter
