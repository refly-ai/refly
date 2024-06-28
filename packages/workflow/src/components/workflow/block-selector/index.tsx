import type { FC, MouseEventHandler } from "react"
import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import type { OffsetOptions, Placement } from "@floating-ui/react"
import { RiSearchLine } from "@remixicon/react"
import type { BlockEnum, OnSelectBlock } from "../types"
import Tabs from "./tabs"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { Plus02 } from "@/components/base/icons/src/vender/line/general"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"

type NodeSelectorProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSelect: OnSelectBlock
  trigger?: (open: boolean) => React.ReactNode
  placement?: Placement
  offset?: OffsetOptions
  triggerStyle?: React.CSSProperties
  triggerClassName?: (open: boolean) => string
  triggerInnerClassName?: string
  popupClassName?: string
  asChild?: boolean
  availableBlocksTypes?: BlockEnum[]
  disabled?: boolean
  noBlocks?: boolean
}
const NodeSelector: FC<NodeSelectorProps> = ({
  open: openFromProps,
  onOpenChange,
  onSelect,
  trigger,
  placement = "right",
  offset = 6,
  triggerClassName,
  triggerInnerClassName,
  triggerStyle,
  popupClassName,
  asChild,
  availableBlocksTypes,
  disabled,
  noBlocks = false,
}) => {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState("")
  const [localOpen, setLocalOpen] = useState(false)
  const open = openFromProps === undefined ? localOpen : openFromProps
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setLocalOpen(newOpen)

      if (onOpenChange) onOpenChange(newOpen)
    },
    [onOpenChange],
  )
  const handleTrigger = useCallback<MouseEventHandler<HTMLDivElement>>(
    e => {
      if (disabled) return
      e.stopPropagation()
      handleOpenChange(!open)
    },
    [handleOpenChange, open, disabled],
  )
  const handleSelect = useCallback<OnSelectBlock>(
    (type, toolDefaultValue) => {
      handleOpenChange(false)
      onSelect(type, toolDefaultValue)
    },
    [handleOpenChange, onSelect],
  )

  return (
    <PortalToFollowElem
      placement={placement}
      offset={offset}
      open={open}
      onOpenChange={handleOpenChange}>
      <PortalToFollowElemTrigger
        asChild={asChild}
        onClick={handleTrigger}
        className={triggerInnerClassName}>
        {trigger ? (
          trigger(open)
        ) : (
          <div
            className={`bg-primary-600 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full ${triggerClassName?.(open)} `}
            style={triggerStyle}>
            <Plus02 className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent className="z-[1000]">
        <div
          className={`rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg ${popupClassName}`}>
          <div className="px-2 pt-2">
            <div
              className="flex items-center rounded-lg bg-gray-100 px-2"
              onClick={e => e.stopPropagation()}>
              <RiSearchLine className="ml-[1px] mr-[5px] h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                value={searchText}
                className="caret-primary-600 grow appearance-none bg-transparent px-0.5 py-[7px] text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
                placeholder={t("workflow.tabs.searchBlock") || ""}
                onChange={e => setSearchText(e.target.value)}
                autoFocus
              />
              {searchText && (
                <div
                  className="ml-[5px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center"
                  onClick={() => setSearchText("")}>
                  <XCircle className="h-[14px] w-[14px] text-gray-400" />
                </div>
              )}
            </div>
          </div>
          <Tabs
            onSelect={handleSelect}
            searchText={searchText}
            availableBlocksTypes={availableBlocksTypes}
            noBlocks={noBlocks}
          />
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

export default memo(NodeSelector)
