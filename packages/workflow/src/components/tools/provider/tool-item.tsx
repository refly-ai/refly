"use client"
import React, { useState } from "react"
import cn from "classnames"
import { useContext } from "use-context-selector"
import type { Collection, Tool } from "../types"
import I18n from "@/context/i18n"
import { getLanguage } from "@/i18n/language"
import SettingBuiltInTool from "@/components/configuration/config/agent/agent-tools/setting-built-in-tool"

type Props = {
  disabled?: boolean
  collection: Collection
  tool: Tool
  isBuiltIn: boolean
  isModel: boolean
}

const ToolItem = ({
  disabled,
  collection,
  tool,
  isBuiltIn,
  isModel,
}: Props) => {
  const { locale } = useContext(I18n)
  const language = getLanguage(locale)
  const [showDetail, setShowDetail] = useState(false)

  return (
    <>
      <div
        className={cn(
          "bg-gray-25 border-gary-200 shadow-xs mb-2 cursor-pointer rounded-xl border-[0.5px] px-4 py-3",
          disabled && "!cursor-not-allowed opacity-50",
        )}
        onClick={() => !disabled && setShowDetail(true)}>
        <div className="text-sm font-semibold leading-5 text-gray-800">
          {tool.label[language]}
        </div>
        <div
          className="mt-0.5 line-clamp-2 text-xs leading-[18px] text-gray-500"
          title={tool.description[language]}>
          {tool.description[language]}
        </div>
      </div>
      {showDetail && (
        <SettingBuiltInTool
          collection={collection}
          toolName={tool.name}
          readonly
          onHide={() => {
            setShowDetail(false)
          }}
          isBuiltIn={isBuiltIn}
          isModel={isModel}
        />
      )}
    </>
  )
}
export default ToolItem
