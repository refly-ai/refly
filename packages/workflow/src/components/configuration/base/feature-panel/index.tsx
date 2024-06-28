"use client"
import type { FC, ReactNode } from "react"
import React from "react"
import cn from "classnames"
import ParamsConfig from "@/components/configuration/config-voice/param-config"

export type IFeaturePanelProps = {
  className?: string
  headerIcon?: ReactNode
  title: ReactNode
  headerRight?: ReactNode
  hasHeaderBottomBorder?: boolean
  isFocus?: boolean
  noBodySpacing?: boolean
  children?: ReactNode
  isShowTextToSpeech?: boolean
}

const FeaturePanel: FC<IFeaturePanelProps> = ({
  className,
  headerIcon,
  title,
  headerRight,
  hasHeaderBottomBorder,
  isFocus,
  noBodySpacing,
  children,
  isShowTextToSpeech,
}) => {
  return (
    <div
      className={cn(
        className,
        isFocus && "border border-[#2D0DEE]",
        "rounded-xl bg-gray-50 pb-3 pt-2",
        noBodySpacing && "!pb-0",
      )}
      style={
        isFocus
          ? {
              boxShadow:
                "0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
            }
          : {}
      }>
      {/* Header */}
      <div
        className={cn(
          "px-3 pb-2",
          hasHeaderBottomBorder && "border-b border-gray-100",
        )}>
        <div className="flex h-8 items-center justify-between">
          <div className="flex shrink-0 items-center space-x-1">
            {headerIcon && (
              <div className="flex h-6 w-6 items-center justify-center">
                {headerIcon}
              </div>
            )}
            <div className="text-sm font-semibold text-gray-800">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            {headerRight && <div>{headerRight}</div>}
            {isShowTextToSpeech && (
              <div className="flex items-center">
                <ParamsConfig />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Body */}
      {children && (
        <div className={cn(!noBodySpacing && "mt-1 px-3")}>{children}</div>
      )}
    </div>
  )
}
export default React.memo(FeaturePanel)
