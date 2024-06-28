import type { FC } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiArrowDownSLine } from "@remixicon/react"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { Check } from "@/components/base/icons/src/vender/line/general"

type MethodSelectorProps = {
  value?: string
  onChange: (v: string) => void
}
const MethodSelector: FC<MethodSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}>
      <div className="relative">
        <PortalToFollowElemTrigger
          onClick={() => setOpen(v => !v)}
          className="block">
          <div
            className={cn(
              "flex h-9 min-h-[56px] cursor-pointer items-center gap-1 bg-white px-3 py-2 hover:bg-gray-100",
              open && "!bg-gray-100 hover:bg-gray-100",
            )}>
            <div
              className={cn(
                "grow truncate text-[13px] leading-[18px] text-gray-700",
              )}>
              {value === "llm"
                ? t("tools.createTool.toolInput.methodParameter")
                : t("tools.createTool.toolInput.methodSetting")}
            </div>
            <div className="ml-1 shrink-0 text-gray-700 opacity-60">
              <RiArrowDownSLine className="h-4 w-4" />
            </div>
          </div>
        </PortalToFollowElemTrigger>
        <PortalToFollowElemContent className="z-[1040]">
          <div className="relative w-[320px] rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg">
            <div className="p-1">
              <div
                className="cursor-pointer rounded-lg py-2.5 pl-3 pr-2 hover:bg-gray-50"
                onClick={() => onChange("llm")}>
                <div className="item-center flex gap-1">
                  <div className="h-4 w-4 shrink-0">
                    {value === "llm" && (
                      <Check className="text-primary-600 h-4 w-4 shrink-0" />
                    )}
                  </div>
                  <div className="text-[13px] font-medium leading-[18px] text-gray-700">
                    {t("tools.createTool.toolInput.methodParameter")}
                  </div>
                </div>
                <div className="pl-5 text-[13px] leading-[18px] text-gray-500">
                  {t("tools.createTool.toolInput.methodParameterTip")}
                </div>
              </div>
              <div
                className="cursor-pointer rounded-lg py-2.5 pl-3 pr-2 hover:bg-gray-50"
                onClick={() => onChange("form")}>
                <div className="item-center flex gap-1">
                  <div className="h-4 w-4 shrink-0">
                    {value === "form" && (
                      <Check className="text-primary-600 h-4 w-4 shrink-0" />
                    )}
                  </div>
                  <div className="text-[13px] font-medium leading-[18px] text-gray-700">
                    {t("tools.createTool.toolInput.methodSetting")}
                  </div>
                </div>
                <div className="pl-5 text-[13px] leading-[18px] text-gray-500">
                  {t("tools.createTool.toolInput.methodSettingTip")}
                </div>
              </div>
            </div>
          </div>
        </PortalToFollowElemContent>
      </div>
    </PortalToFollowElem>
  )
}

export default MethodSelector
