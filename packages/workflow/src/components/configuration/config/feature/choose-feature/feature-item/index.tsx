"use client"
import type { FC } from "react"
import React from "react"
import cn from "classnames"
import s from "./style.module.css"
import Switch from "@/components/base/switch"

export type IFeatureItemProps = {
  icon: React.ReactNode
  previewImgClassName?: string
  title: string
  description: string
  value: boolean
  onChange: (value: boolean) => void
}

const FeatureItem: FC<IFeatureItemProps> = ({
  icon,
  previewImgClassName,
  title,
  description,
  value,
  onChange,
}) => {
  return (
    <div
      className={cn(
        s.wrap,
        "relative flex cursor-pointer justify-between rounded-xl border border-transparent bg-gray-50 p-3 hover:border-gray-200",
      )}>
      <div className="mr-2 flex space-x-3">
        {/* icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white"
          style={{
            boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
          }}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <div className="text-xs font-normal text-gray-500">{description}</div>
        </div>
      </div>

      <Switch onChange={onChange} defaultValue={value} />
      {previewImgClassName && (
        <div className={cn(s.preview, s[previewImgClassName])}></div>
      )}
    </div>
  )
}
export default React.memo(FeatureItem)
