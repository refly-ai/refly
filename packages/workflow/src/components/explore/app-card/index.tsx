"use client"
import cn from "classnames"
import { useTranslation } from "react-i18next"
import { PlusIcon } from "@heroicons/react/20/solid"
import Button from "../../base/button"
import type { App } from "@/models/explore"
import AppIcon from "@/components/base/app-icon"
import {
  AiText,
  ChatBot,
  CuteRobote,
} from "@/components/base/icons/src/vender/solid/communication"
import { Route } from "@/components/base/icons/src/vender/solid/mapsAndTravel"
export type AppCardProps = {
  app: App
  canCreate: boolean
  onCreate: () => void
  isExplore: boolean
}

const AppCard = ({ app, canCreate, onCreate, isExplore }: AppCardProps) => {
  const { t } = useTranslation()
  const { app: appBasicInfo } = app
  return (
    <div
      className={cn(
        "group col-span-1 flex min-h-[160px] cursor-pointer flex-col rounded-lg border-2 border-solid border-transparent bg-white shadow-sm transition-all duration-200 ease-in-out hover:shadow-lg",
      )}>
      <div className="flex h-[66px] shrink-0 grow-0 items-center gap-3 px-[14px] pb-3 pt-[14px]">
        <div className="relative shrink-0">
          <AppIcon
            size="large"
            icon={app.app.icon}
            background={app.app.icon_background}
          />
          <span className="absolute bottom-[-3px] right-[-3px] h-4 w-4 rounded border-[0.5px] border-[rgba(0,0,0,0.02)] bg-white p-0.5 shadow-sm">
            {appBasicInfo.mode === "advanced-chat" && (
              <ChatBot className="h-3 w-3 text-[#1570EF]" />
            )}
            {appBasicInfo.mode === "agent-chat" && (
              <CuteRobote className="h-3 w-3 text-indigo-600" />
            )}
            {appBasicInfo.mode === "chat" && (
              <ChatBot className="h-3 w-3 text-[#1570EF]" />
            )}
            {appBasicInfo.mode === "completion" && (
              <AiText className="h-3 w-3 text-[#0E9384]" />
            )}
            {appBasicInfo.mode === "workflow" && (
              <Route className="h-3 w-3 text-[#f79009]" />
            )}
          </span>
        </div>
        <div className="w-0 grow py-[1px]">
          <div className="flex items-center text-sm font-semibold leading-5 text-gray-800">
            <div className="truncate" title={appBasicInfo.name}>
              {appBasicInfo.name}
            </div>
          </div>
          <div className="flex items-center text-[10px] font-medium leading-[18px] text-gray-500">
            {appBasicInfo.mode === "advanced-chat" && (
              <div className="truncate">
                {t("app.types.chatbot").toUpperCase()}
              </div>
            )}
            {appBasicInfo.mode === "chat" && (
              <div className="truncate">
                {t("app.types.chatbot").toUpperCase()}
              </div>
            )}
            {appBasicInfo.mode === "agent-chat" && (
              <div className="truncate">
                {t("app.types.agent").toUpperCase()}
              </div>
            )}
            {appBasicInfo.mode === "workflow" && (
              <div className="truncate">
                {t("app.types.workflow").toUpperCase()}
              </div>
            )}
            {appBasicInfo.mode === "completion" && (
              <div className="truncate">
                {t("app.types.completion").toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-1 line-clamp-4 px-[14px] text-xs leading-normal text-gray-500 group-hover:line-clamp-2 group-hover:h-9">
        {app.description}
      </div>
      {isExplore && canCreate && (
        <div
          className={cn(
            "hidden min-h-[42px] flex-wrap items-center px-[14px] pb-[10px] pt-2 group-hover:flex",
          )}>
          <div className={cn("flex w-full items-center space-x-2")}>
            <Button
              variant="primary"
              className="h-7 grow"
              onClick={() => onCreate()}>
              <PlusIcon className="mr-1 h-4 w-4" />
              <span className="text-xs">
                {t("explore.appCard.addToWorkspace")}
              </span>
            </Button>
          </div>
        </div>
      )}
      {!isExplore && (
        <div
          className={cn(
            "hidden min-h-[42px] flex-wrap items-center px-[14px] pb-[10px] pt-2 group-hover:flex",
          )}>
          <div className={cn("flex w-full items-center space-x-2")}>
            <Button
              variant="primary"
              className="h-7 grow"
              onClick={() => onCreate()}>
              <PlusIcon className="mr-1 h-4 w-4" />
              <span className="text-xs">{t("app.newApp.useTemplate")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppCard
