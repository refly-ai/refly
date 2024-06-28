import { memo } from "react"
import ShortcutsName from "../shortcuts-name"
import TooltipPlus from "@/components/base/tooltip-plus"

type TipPopupProps = {
  title: string
  children: React.ReactNode
  shortcuts?: string[]
}
const TipPopup = ({ title, children, shortcuts }: TipPopupProps) => {
  return (
    <TooltipPlus
      offset={4}
      hideArrow
      popupClassName="!p-0 !bg-gray-25"
      popupContent={
        <div className="flex h-6 items-center gap-1 rounded-lg border-[0.5px] border-black/5 px-2 text-xs font-medium text-gray-700">
          {title}
          {shortcuts && (
            <ShortcutsName keys={shortcuts} className="!text-[11px]" />
          )}
        </div>
      }>
      {children}
    </TooltipPlus>
  )
}

export default memo(TipPopup)
