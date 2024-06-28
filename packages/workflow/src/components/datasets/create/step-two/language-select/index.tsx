"use client"
import type { FC } from "react"
import React from "react"
import cn from "classnames"
import { RiArrowDownSLine } from "@remixicon/react"
import Popover from "@/components/base/popover"
import { languages } from "@/i18n/language"

export type ILanguageSelectProps = {
  currentLanguage: string
  onSelect: (language: string) => void
}

const LanguageSelect: FC<ILanguageSelectProps> = ({
  currentLanguage,
  onSelect,
}) => {
  return (
    <Popover
      manualClose
      trigger="click"
      htmlContent={
        <div className="w-full py-1">
          {languages
            .filter(language => language.supported)
            .map(({ prompt_name, name }) => (
              <div
                key={prompt_name}
                className="mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => onSelect(prompt_name)}>
                {prompt_name}
              </div>
            ))}
        </div>
      }
      btnElement={
        <div className="inline-flex items-center">
          <span className="pr-[2px] text-xs font-medium leading-[18px]">
            {currentLanguage}
          </span>
          <RiArrowDownSLine className="h-3 w-3 opacity-60" />
        </div>
      }
      btnClassName={open =>
        cn(
          "!border-0 !px-0 !py-0 !bg-inherit !hover:bg-inherit",
          open ? "text-blue-600" : "text-gray-500",
        )
      }
      className="!left-[-16px] !z-20 h-fit !w-[120px] !translate-x-0"
    />
  )
}
export default React.memo(LanguageSelect)
