"use client"
import type { FC } from "react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import Button from "@/components/button"
import { LinkExternal02 } from "@/components/icons/src/vender/line/general"
import { IS_CE_EDITION } from "@/config"
import { useProviderContext } from "@/context/provider-context"
import { useModalContext } from "@/context/modal-context"

const APIKeyInfoPanel: FC = () => {
  const isCloud = !IS_CE_EDITION

  const { isAPIKeySet } = useProviderContext()
  const { setShowAccountSettingModal } = useModalContext()

  const { t } = useTranslation()

  const [isShow, setIsShow] = useState(true)

  if (isAPIKeySet) return null

  if (!isShow) return null

  return (
    <div
      className={cn(
        "border-[#D1E0FF] bg-[#EFF4FF]",
        "relative mb-6 rounded-2xl border p-8 shadow-md",
      )}>
      <div
        className={cn(
          "text-[24px] font-semibold text-gray-800",
          isCloud ? "flex h-8 items-center space-x-1" : "mb-6 leading-8",
        )}>
        {isCloud && <em-emoji id={"😀"} />}
        {isCloud ? (
          <div>
            {t("appOverview.apiKeyInfo.cloud.trial.title", {
              providerName: "OpenAI",
            })}
          </div>
        ) : (
          <div>
            <div>{t("appOverview.apiKeyInfo.selfHost.title.row1")}</div>
            <div>{t("appOverview.apiKeyInfo.selfHost.title.row2")}</div>
          </div>
        )}
      </div>
      {isCloud && (
        <div className="mt-1 text-sm font-normal text-gray-600">
          {t(`appOverview.apiKeyInfo.cloud.${"trial"}.description`)}
        </div>
      )}
      <Button
        variant="primary"
        className="space-x-2"
        onClick={() => setShowAccountSettingModal({ payload: "provider" })}>
        <div className="text-sm font-medium">
          {t("appOverview.apiKeyInfo.setAPIBtn")}
        </div>
        <LinkExternal02 className="h-4 w-4" />
      </Button>
      {!isCloud && (
        <a
          className="mt-2 flex h-[26px] items-center space-x-1 p-1 text-xs font-medium text-[#155EEF]"
          href="https://cloud.dify.ai/apps"
          target="_blank"
          rel="noopener noreferrer">
          <div>{t("appOverview.apiKeyInfo.tryCloud")}</div>
          <LinkExternal02 className="h-3 w-3" />
        </a>
      )}
      <div
        onClick={() => setIsShow(false)}
        className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center">
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
    </div>
  )
}
export default React.memo(APIKeyInfoPanel)
