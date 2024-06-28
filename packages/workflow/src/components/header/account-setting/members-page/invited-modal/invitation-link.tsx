"use client"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { t } from "i18next"
import copy from "copy-to-clipboard"
import s from "./index.module.css"
import type { SuccessInvationResult } from "."
import Tooltip from "@/components/base/tooltip"
import { randomString } from "@/utils"

type IInvitationLinkProps = {
  value: SuccessInvationResult
}

const InvitationLink = ({ value }: IInvitationLinkProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const selector = useRef(`invite-link-${randomString(4)}`)

  const copyHandle = useCallback(() => {
    copy(
      `${!value.url.startsWith("http") ? window.location.origin : ""}${value.url}`,
    )
    setIsCopied(true)
  }, [value])

  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false)
      }, 1000)

      return () => {
        clearTimeout(timeout)
      }
    }
  }, [isCopied])

  return (
    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-100 py-2 hover:bg-gray-100">
      <div className="flex h-5 flex-grow items-center">
        <div className="relative h-full flex-grow bg-gray-100 text-[13px]">
          <Tooltip
            selector={selector.current}
            content={isCopied ? `${t("appApi.copied")}` : `${t("appApi.copy")}`}
            className="z-10">
            <div
              className="r-0 absolute left-0 top-0 w-full cursor-pointer truncate pl-2 pr-2"
              onClick={copyHandle}>
              {value.url}
            </div>
          </Tooltip>
        </div>
        <div className="h-4 flex-shrink-0 border bg-gray-200" />
        <Tooltip
          selector={selector.current}
          content={isCopied ? `${t("appApi.copied")}` : `${t("appApi.copy")}`}
          className="z-10">
          <div className="flex-shrink-0 px-0.5">
            <div
              className={`box-border flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 ${s.copyIcon} ${isCopied ? s.copied : ""}`}
              onClick={copyHandle}></div>
          </div>
        </Tooltip>
      </div>
    </div>
  )
}

export default InvitationLink
