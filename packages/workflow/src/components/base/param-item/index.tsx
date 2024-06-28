"use client"
import type { FC } from "react"
import { RiQuestionLine } from "@remixicon/react"

import Tooltip from "@/components/base/tooltip-plus"
import Slider from "@/components/base/slider"
import Switch from "@/components/base/switch"

type Props = {
  className?: string
  id: string
  name: string
  noTooltip?: boolean
  tip?: string
  value: number
  enable: boolean
  step?: number
  min?: number
  max: number
  onChange: (key: string, value: number) => void
  hasSwitch?: boolean
  onSwitchChange?: (key: string, enable: boolean) => void
}

const ParamItem: FC<Props> = ({
  className,
  id,
  name,
  noTooltip,
  tip,
  step = 0.1,
  min = 0,
  max,
  value,
  enable,
  onChange,
  hasSwitch,
  onSwitchChange,
}) => {
  return (
    <div className={className}>
      <div className="flex h-8 items-center justify-between">
        <div className="flex items-center">
          {hasSwitch && (
            <Switch
              size="md"
              defaultValue={enable}
              onChange={async val => {
                onSwitchChange?.(id, val)
              }}
            />
          )}
          <span className="mx-1 text-[13px] font-medium leading-[18px] text-gray-900">
            {name}
          </span>
          {!noTooltip && (
            <Tooltip popupContent={<div className="w-[200px]">{tip}</div>}>
              <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
            </Tooltip>
          )}
        </div>
        <div className="flex items-center"></div>
      </div>
      <div className="mt-2 flex items-center">
        <div className="mr-4 flex shrink-0 items-center">
          <input
            disabled={!enable}
            type="number"
            min={min}
            max={max}
            step={step}
            className="pl focus:ring-primary-600 block h-7 w-[48px] rounded-lg border-0 bg-gray-50 py-1.5 pl-1 text-xs leading-[18px] text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-inset disabled:opacity-60"
            value={value === null || value === undefined ? "" : value}
            onChange={e => {
              const value = parseFloat(e.target.value)
              if (value < min || value > max) return

              onChange(id, value)
            }}
          />
        </div>
        <div className="flex h-7 grow items-center">
          <Slider
            className="w-full"
            disabled={!enable}
            value={max < 5 ? value * 100 : value}
            min={min < 1 ? min * 100 : min}
            max={max < 5 ? max * 100 : max}
            onChange={value => onChange(id, value / (max < 5 ? 100 : 1))}
          />
        </div>
      </div>
    </div>
  )
}
export default ParamItem
