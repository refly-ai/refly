"use client"
import type { FC } from "react"
import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import VoiceParamConfig from "./param-config-content"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"

const ParamsConfig: FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={{
        mainAxis: 4,
      }}>
      <PortalToFollowElemTrigger onClick={() => setOpen(v => !v)}>
        <div
          className={cn(
            "flex h-7 cursor-pointer items-center space-x-1 rounded-md px-3 text-gray-700 hover:bg-gray-200",
            open && "bg-gray-200",
          )}>
          <Settings01 className="h-3.5 w-3.5" />
          <div className="ml-1 text-xs font-medium leading-[18px]">
            {t("appDebug.voice.settings")}
          </div>
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent style={{ zIndex: 50 }}>
        <div className="w-80 space-y-3 rounded-lg border-[0.5px] border-gray-200 bg-white p-4 shadow-lg sm:w-[412px]">
          <VoiceParamConfig />
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}
export default memo(ParamsConfig)
