"use client"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { debounce } from "lodash-es"
import copy from "copy-to-clipboard"
import TooltipPlus from "../tooltip-plus"
import {
  Clipboard,
  ClipboardCheck,
} from "@/components/base/icons/src/vender/line/files"

type Props = {
  content: string
}

const prefixEmbedded = "appOverview.overview.appInfo.embedded"

export const CopyIcon = ({ content }: Props) => {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const onClickCopy = debounce(() => {
    copy(content)
    setIsCopied(true)
  }, 100)

  const onMouseLeave = debounce(() => {
    setIsCopied(false)
  }, 100)

  return (
    <TooltipPlus
      popupContent={
        (isCopied
          ? t(`${prefixEmbedded}.copied`)
          : t(`${prefixEmbedded}.copy`)) || ""
      }>
      <div onMouseLeave={onMouseLeave}>
        {!isCopied ? (
          <Clipboard
            className="mx-1 h-3 w-3 cursor-pointer text-gray-500"
            onClick={onClickCopy}
          />
        ) : (
          <ClipboardCheck className="mx-1 h-3 w-3 text-gray-500" />
        )}
      </div>
    </TooltipPlus>
  )
}

export default CopyIcon
