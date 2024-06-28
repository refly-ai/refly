import { memo } from "react"
import cn from "classnames"
import { RiFontSize } from "@remixicon/react"
import { useTranslation } from "react-i18next"
import { useFontSize } from "./hooks"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { Check } from "@/components/base/icons/src/vender/line/general"

const FontSizeSelector = () => {
  const { t } = useTranslation()
  const FONT_SIZE_LIST = [
    {
      key: "12px",
      value: t("workflow.nodes.note.editor.small"),
    },
    {
      key: "14px",
      value: t("workflow.nodes.note.editor.medium"),
    },
    {
      key: "16px",
      value: t("workflow.nodes.note.editor.large"),
    },
  ]
  const {
    fontSizeSelectorShow,
    handleOpenFontSizeSelector,
    fontSize,
    handleFontSize,
  } = useFontSize()

  return (
    <PortalToFollowElem
      open={fontSizeSelectorShow}
      onOpenChange={handleOpenFontSizeSelector}
      placement="bottom-start"
      offset={2}>
      <PortalToFollowElemTrigger
        onClick={() => handleOpenFontSizeSelector(!fontSizeSelectorShow)}>
        <div
          className={cn(
            "flex h-8 cursor-pointer items-center rounded-md pl-2 pr-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50",
            fontSizeSelectorShow && "bg-gray-50",
          )}>
          <RiFontSize className="mr-1 h-4 w-4" />
          {FONT_SIZE_LIST.find(font => font.key === fontSize)?.value ||
            t("workflow.nodes.note.editor.small")}
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent>
        <div className="w-[120px] rounded-md border-[0.5px] border-gray-200 bg-white p-1 text-gray-700 shadow-xl">
          {FONT_SIZE_LIST.map(font => (
            <div
              key={font.key}
              className="flex h-8 cursor-pointer items-center justify-between rounded-md pl-3 pr-2 hover:bg-gray-50"
              onClick={e => {
                e.stopPropagation()
                handleFontSize(font.key)
                handleOpenFontSizeSelector(false)
              }}>
              <div style={{ fontSize: font.key }}>{font.value}</div>
              {fontSize === font.key && (
                <Check className="text-primary-500 h-4 w-4" />
              )}
            </div>
          ))}
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

export default memo(FontSizeSelector)
