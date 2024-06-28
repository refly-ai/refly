"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import Slider from "@/components/configuration/toolbox/score-slider/base-slider"

type Props = {
  className?: string
  value: number
  onChange: (value: number) => void
}

const ScoreSlider: FC<Props> = ({ className, value, onChange }) => {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <div className="mt-[14px] h-[1px]">
        <Slider max={100} min={80} step={1} value={value} onChange={onChange} />
      </div>
      <div className="mt-[10px] flex items-center justify-between text-xs font-normal leading-4">
        <div className="flex space-x-1 text-[#00A286]">
          <div>0.8</div>
          <div>·</div>
          <div>{t("appDebug.feature.annotation.scoreThreshold.easyMatch")}</div>
        </div>
        <div className="flex space-x-1 text-[#0057D8]">
          <div>1.0</div>
          <div>·</div>
          <div>
            {t("appDebug.feature.annotation.scoreThreshold.accurateMatch")}
          </div>
        </div>
      </div>
    </div>
  )
}
export default React.memo(ScoreSlider)
