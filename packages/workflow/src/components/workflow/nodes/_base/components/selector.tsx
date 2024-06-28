"use client"
import type { FC } from "react"
import React from "react"
import { useBoolean, useClickAway } from "ahooks"
import cn from "classnames"
import { ChevronSelectorVertical } from "@/components/base/icons/src/vender/line/arrows"
import { Check } from "@/components/base/icons/src/vender/line/general"
type Item = {
  value: string
  label: string
}
type Props = {
  trigger?: JSX.Element
  DropDownIcon?: any
  noLeft?: boolean
  options: Item[]
  allOptions?: Item[]
  value: string
  placeholder?: string
  onChange: (value: any) => void
  uppercase?: boolean
  popupClassName?: string
  triggerClassName?: string
  itemClassName?: string
  readonly?: boolean
  showChecked?: boolean
}

const TypeSelector: FC<Props> = ({
  trigger,
  DropDownIcon = ChevronSelectorVertical,
  noLeft,
  options: list,
  allOptions,
  value,
  placeholder = "",
  onChange,
  uppercase,
  triggerClassName,
  popupClassName,
  itemClassName,
  readonly,
  showChecked,
}) => {
  const noValue = value === "" || value === undefined || value === null
  const item = allOptions
    ? allOptions.find(item => item.value === value)
    : list.find(item => item.value === value)
  const [showOption, { setFalse: setHide, toggle: toggleShow }] =
    useBoolean(false)
  const ref = React.useRef(null)
  useClickAway(() => {
    setHide()
  }, ref)
  return (
    <div
      className={cn(!trigger && !noLeft && "left-[-8px]", "relative")}
      ref={ref}>
      {trigger ? (
        <div onClick={toggleShow}>{trigger}</div>
      ) : (
        <div
          onClick={toggleShow}
          className={cn(
            showOption && "bg-black/5",
            "flex h-5 cursor-pointer items-center rounded-md pl-1 pr-0.5 text-xs font-semibold text-gray-700 hover:bg-black/5",
          )}>
          <div
            className={cn(
              triggerClassName,
              "text-sm font-semibold",
              uppercase && "uppercase",
              noValue && "text-gray-400",
            )}>
            {!noValue ? item?.label : placeholder}
          </div>
          {!readonly && <DropDownIcon className="h-3 w-3" />}
        </div>
      )}

      {showOption && !readonly && (
        <div
          className={cn(
            popupClassName,
            "absolute top-[24px] z-10 w-[120px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg",
          )}>
          {list.map(item => (
            <div
              key={item.value}
              onClick={() => {
                setHide()
                onChange(item.value)
              }}
              className={cn(
                itemClassName,
                uppercase && "uppercase",
                "flex h-[30px] min-w-[44px] cursor-pointer items-center justify-between rounded-lg px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50",
              )}>
              <div>{item.label}</div>
              {showChecked && item.value === value && (
                <Check className="text-primary-600 h-4 w-4" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default React.memo(TypeSelector)
