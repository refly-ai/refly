"use client"
import type { MouseEventHandler } from "react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine, RiQuestionLine } from "@remixicon/react"
import { useRouter } from "next/navigation"
import { useContext, useContextSelector } from "use-context-selector"
import s from "./style.module.css"
import AppsContext, { useAppContext } from "@/context/app-context"
import { useProviderContext } from "@/context/provider-context"
import { ToastContext } from "@/components/base/toast"
import type { AppMode } from "@/types/app"
import { createApp } from "@/service/apps"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import AppIcon from "@/components/base/app-icon"
import EmojiPicker from "@/components/base/emoji-picker"
import AppsFull from "@/components/billing/apps-full-in-dialog"
import {
  AiText,
  ChatBot,
  CuteRobote,
} from "@/components/base/icons/src/vender/solid/communication"
import { Route } from "@/components/base/icons/src/vender/solid/mapsAndTravel"
import TooltipPlus from "@/components/base/tooltip-plus"
import { NEED_REFRESH_APP_LIST_KEY } from "@/config"
import { getRedirection } from "@/utils/app-redirection"

type CreateAppDialogProps = {
  show: boolean
  onSuccess: () => void
  onClose: () => void
}

const CreateAppModal = ({ show, onSuccess, onClose }: CreateAppDialogProps) => {
  const { t } = useTranslation()
  const { push } = useRouter()
  const { notify } = useContext(ToastContext)
  const mutateApps = useContextSelector(AppsContext, state => state.mutateApps)

  const [appMode, setAppMode] = useState<AppMode>("chat")
  const [showChatBotType, setShowChatBotType] = useState<boolean>(true)
  const [emoji, setEmoji] = useState({ icon: "🤖", icon_background: "#FFEAD5" })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const { plan, enableBilling } = useProviderContext()
  const isAppsFull =
    enableBilling && plan.usage.buildApps >= plan.total.buildApps
  const { isCurrentWorkspaceEditor } = useAppContext()

  const isCreatingRef = useRef(false)
  const onCreate: MouseEventHandler = useCallback(async () => {
    if (!appMode) {
      notify({ type: "error", message: t("app.newApp.appTypeRequired") })
      return
    }
    if (!name.trim()) {
      notify({ type: "error", message: t("app.newApp.nameNotEmpty") })
      return
    }
    if (isCreatingRef.current) return
    isCreatingRef.current = true
    try {
      const app = await createApp({
        name,
        description,
        icon: emoji.icon,
        icon_background: emoji.icon_background,
        mode: appMode,
      })
      notify({ type: "success", message: t("app.newApp.appCreated") })
      onSuccess()
      onClose()
      mutateApps()
      localStorage.setItem(NEED_REFRESH_APP_LIST_KEY, "1")
      getRedirection(isCurrentWorkspaceEditor, app, push)
    } catch (e) {
      notify({ type: "error", message: t("app.newApp.appCreateFailed") })
    }
    isCreatingRef.current = false
  }, [
    name,
    notify,
    t,
    appMode,
    emoji.icon,
    emoji.icon_background,
    description,
    onSuccess,
    onClose,
    mutateApps,
    push,
    isCurrentWorkspaceEditor,
  ])

  return (
    <Modal
      overflowVisible
      className="!w-[720px] !max-w-[720px] rounded-xl !p-0"
      isShow={show}
      onClose={() => {}}>
      {/* Heading */}
      <div className="flex h-full shrink-0 flex-col rounded-t-xl bg-white">
        <div className="z-10 shrink-0 rounded-t-xl bg-white pb-3 pl-8 pr-6 pt-6 text-xl font-semibold leading-[30px] text-gray-900">
          {t("app.newApp.startFromBlank")}
        </div>
      </div>
      {/* app type */}
      <div className="px-8 py-2">
        <div className="py-2 text-sm font-medium leading-[20px] text-gray-900">
          {t("app.newApp.captionAppType")}
        </div>
        <div className="flex">
          <TooltipPlus
            hideArrow
            popupContent={
              <div className="max-w-[280px] text-xs leading-[18px] text-gray-700">
                {t("app.newApp.chatbotDescription")}
              </div>
            }>
            <div
              className={cn(
                "shadow-xs relative mr-2 box-border flex w-[158px] grow cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-white px-0.5 pb-2 pt-3 text-gray-700 hover:border-gray-300",
                showChatBotType &&
                  "border-primary-400 hover:border-primary-400 border-[1.5px] hover:border-[1.5px]",
                s["grid-bg-chat"],
              )}
              onClick={() => {
                setAppMode("chat")
                setShowChatBotType(true)
              }}>
              <ChatBot className="h-6 w-6 text-[#1570EF]" />
              <div className="h-5 text-[13px] font-medium leading-[18px]">
                {t("app.types.chatbot")}
              </div>
            </div>
          </TooltipPlus>
          <TooltipPlus
            hideArrow
            popupContent={
              <div className="flex max-w-[320px] flex-col text-xs leading-[18px]">
                <div className="text-gray-700">
                  {t("app.newApp.completionDescription")}
                </div>
              </div>
            }>
            <div
              className={cn(
                "shadow-xs relative mr-2 box-border flex w-[158px] grow cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-white px-0.5 pb-2 pt-3 text-gray-700 hover:border-gray-300",
                s["grid-bg-completion"],
                appMode === "completion" &&
                  "border-primary-400 hover:border-primary-400 border-[1.5px] hover:border-[1.5px]",
              )}
              onClick={() => {
                setAppMode("completion")
                setShowChatBotType(false)
              }}>
              <AiText className="h-6 w-6 text-[#0E9384]" />
              <div className="h-5 text-[13px] font-medium leading-[18px]">
                {t("app.newApp.completeApp")}
              </div>
            </div>
          </TooltipPlus>
          <TooltipPlus
            hideArrow
            popupContent={
              <div className="max-w-[280px] text-xs leading-[18px] text-gray-700">
                {t("app.newApp.agentDescription")}
              </div>
            }>
            <div
              className={cn(
                "shadow-xs relative mr-2 box-border flex w-[158px] grow cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-white px-0.5 pb-2 pt-3 text-gray-700 hover:border-gray-300",
                s["grid-bg-agent-chat"],
                appMode === "agent-chat" &&
                  "border-primary-400 hover:border-primary-400 border-[1.5px] hover:border-[1.5px]",
              )}
              onClick={() => {
                setAppMode("agent-chat")
                setShowChatBotType(false)
              }}>
              <CuteRobote className="h-6 w-6 text-indigo-600" />
              <div className="h-5 text-[13px] font-medium leading-[18px]">
                {t("app.types.agent")}
              </div>
            </div>
          </TooltipPlus>
          <TooltipPlus
            hideArrow
            popupContent={
              <div className="flex max-w-[320px] flex-col text-xs leading-[18px]">
                <div className="text-gray-700">
                  {t("app.newApp.workflowDescription")}
                </div>
              </div>
            }>
            <div
              className={cn(
                "shadow-xs relative box-border flex w-[158px] grow cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-white px-0.5 pb-2 pt-3 text-gray-700 hover:border-gray-300",
                s["grid-bg-workflow"],
                appMode === "workflow" &&
                  "border-primary-400 hover:border-primary-400 border-[1.5px] hover:border-[1.5px]",
              )}
              onClick={() => {
                setAppMode("workflow")
                setShowChatBotType(false)
              }}>
              <Route className="h-6 w-6 text-[#f79009]" />
              <div className="h-5 text-[13px] font-medium leading-[18px]">
                {t("app.types.workflow")}
              </div>
              <span className="border-black/8 absolute right-[-3px] top-[-3px] rounded-[5px] border bg-white px-1 text-[10px] font-medium leading-[18px] text-gray-500">
                BETA
              </span>
            </div>
          </TooltipPlus>
        </div>
      </div>
      {showChatBotType && (
        <div className="px-8 py-2">
          <div className="py-2 text-sm font-medium leading-[20px] text-gray-900">
            {t("app.newApp.chatbotType")}
          </div>
          <div className="flex gap-2">
            <div
              className={cn(
                "bg-gray-25 hover:shadow-xs relative flex-[50%] grow cursor-pointer rounded-lg border border-gray-100 py-[10px] pl-4 pr-[10px] text-gray-700 hover:border-gray-300 hover:bg-white",
                appMode === "chat" &&
                  "shadow-xs border-primary-400 hover:border-primary-400 border-[1.5px] bg-white hover:border-[1.5px]",
              )}
              onClick={() => {
                setAppMode("chat")
              }}>
              <div className="flex items-center justify-between">
                <div className="h-5 text-sm font-medium leading-5">
                  {t("app.newApp.basic")}
                </div>
                <div className="group">
                  <RiQuestionLine className="h-[14px] w-[14px] text-gray-400 hover:text-gray-500" />
                  <div
                    className={cn(
                      "absolute left-[327px] top-[-158px] z-20 hidden w-[376px] rounded-xl border-[0.5px] border-[rgba(0,0,0,0.05)] bg-white shadow-lg group-hover:block",
                    )}>
                    <div
                      className={cn(
                        "h-[256px] w-full rounded-xl bg-contain bg-center bg-no-repeat",
                        s.basicPic,
                      )}
                    />
                    <div className="px-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="text-md font-semibold leading-6 text-gray-700">
                          {t("app.newApp.basic")}
                        </div>
                        <div className="text-xs font-medium leading-[18px] text-orange-500">
                          {t("app.newApp.basicFor")}
                        </div>
                      </div>
                      <div className="mt-1 text-sm leading-5 text-gray-500">
                        {t("app.newApp.basicDescription")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-[2px] text-xs leading-[18px] text-gray-500">
                {t("app.newApp.basicTip")}
              </div>
            </div>
            <div
              className={cn(
                "bg-gray-25 hover:shadow-xs relative flex-[50%] grow cursor-pointer rounded-lg border border-gray-100 py-2 pl-3 pr-2 text-gray-700 hover:border-gray-300 hover:bg-white",
                appMode === "advanced-chat" &&
                  "shadow-xs border-primary-400 hover:border-primary-400 border-[1.5px] bg-white hover:border-[1.5px]",
              )}
              onClick={() => {
                setAppMode("advanced-chat")
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-1 h-5 text-sm font-medium leading-5">
                    {t("app.newApp.advanced")}
                  </div>
                  <span className="border-black/8 rounded-[5px] border bg-white px-1 text-[10px] font-medium leading-[18px] text-gray-500">
                    BETA
                  </span>
                </div>
                <div className="group">
                  <RiQuestionLine className="h-[14px] w-[14px] text-gray-400 hover:text-gray-500" />
                  <div
                    className={cn(
                      "absolute right-[26px] top-[-158px] z-20 hidden w-[376px] rounded-xl border-[0.5px] border-[rgba(0,0,0,0.05)] bg-white shadow-lg group-hover:block",
                    )}>
                    <div
                      className={cn(
                        "h-[256px] w-full rounded-xl bg-contain bg-center bg-no-repeat",
                        s.advancedPic,
                      )}
                    />
                    <div className="px-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="text-md mr-1 font-semibold leading-6 text-gray-700">
                            {t("app.newApp.advanced")}
                          </div>
                          <span className="border-black/8 rounded-[5px] border bg-white px-1 text-[10px] font-medium leading-[18px] text-gray-500">
                            BETA
                          </span>
                        </div>
                        <div className="text-xs font-medium leading-[18px] text-orange-500">
                          {t("app.newApp.advancedFor").toLocaleUpperCase()}
                        </div>
                      </div>
                      <div className="mt-1 text-sm leading-5 text-gray-500">
                        {t("app.newApp.advancedDescription")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-[2px] text-xs leading-[18px] text-gray-500">
                {t("app.newApp.advancedFor")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* icon & name */}
      <div className="px-8 pt-2">
        <div className="py-2 text-sm font-medium leading-[20px] text-gray-900">
          {t("app.newApp.captionName")}
        </div>
        <div className="flex items-center justify-between space-x-2">
          <AppIcon
            size="large"
            onClick={() => {
              setShowEmojiPicker(true)
            }}
            className="cursor-pointer"
            icon={emoji.icon}
            background={emoji.icon_background}
          />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t("app.newApp.appNamePlaceholder") || ""}
            className="caret-primary-600 focus:shadow-xs h-10 grow appearance-none rounded-lg border border-transparent bg-gray-100 px-3 text-sm font-normal outline-none placeholder:text-gray-400 hover:border hover:border-gray-300 hover:bg-gray-50 focus:border focus:border-gray-300 focus:bg-gray-50"
          />
        </div>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(icon, icon_background) => {
              setEmoji({ icon, icon_background })
              setShowEmojiPicker(false)
            }}
            onClose={() => {
              setEmoji({ icon: "🤖", icon_background: "#FFEAD5" })
              setShowEmojiPicker(false)
            }}
          />
        )}
      </div>
      {/* description */}
      <div className="px-8 pt-2">
        <div className="py-2 text-sm font-medium leading-[20px] text-gray-900">
          {t("app.newApp.captionDescription")}
        </div>
        <textarea
          className="caret-primary-600 focus:shadow-xs h-[80px] w-full resize-none appearance-none rounded-lg border border-transparent bg-gray-100 px-3 py-2 text-sm font-normal outline-none placeholder:text-gray-400 hover:border hover:border-gray-300 hover:bg-gray-50 focus:border focus:border-gray-300 focus:bg-gray-50"
          placeholder={t("app.newApp.appDescriptionPlaceholder") || ""}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      {isAppsFull && (
        <div className="px-8 py-2">
          <AppsFull loc="app-create" />
        </div>
      )}
      <div className="flex justify-end px-8 py-6">
        <Button className="mr-2" onClick={onClose}>
          {t("app.newApp.Cancel")}
        </Button>
        <Button
          disabled={isAppsFull || !name}
          variant="primary"
          onClick={onCreate}>
          {t("app.newApp.Create")}
        </Button>
      </div>
      <div
        className="absolute right-6 top-6 z-20 cursor-pointer p-2"
        onClick={onClose}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
    </Modal>
  )
}

export default CreateAppModal
