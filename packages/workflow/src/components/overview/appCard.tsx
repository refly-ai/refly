"use client"
import type { HTMLProps } from "react"
import React, { useMemo, useState } from "react"
import {
  Cog8ToothIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline"
import { usePathname, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import SettingsModal from "./settings"
import EmbeddedModal from "./embedded"
import CustomizeModal from "./customize"
import style from "./style.module.css"
import type { ConfigParams } from "./settings"
import Tooltip from "@/components/tooltip"
import AppBasic from "@/components/app-sidebar/basic"
import { asyncRunSafe, randomString } from "@/utils"
import Button from "@/components/button"
import Tag from "@/components/tag"
import Switch from "@/components/switch"
import Divider from "@/components/divider"
import CopyFeedback from "@/components/copy-feedback"
import Confirm from "@/components/confirm"
import ShareQRCode from "@/components/qrcode"
import SecretKeyButton from "@/components/develop/secret-key/secret-key-button"
import type { AppDetailResponse } from "@/models/app"
import { useAppContext } from "@/context/app-context"

export type IAppCardProps = {
  className?: string
  appInfo: AppDetailResponse
  cardType?: "api" | "webapp"
  customBgColor?: string
  onChangeStatus: (val: boolean) => Promise<void>
  onSaveSiteConfig?: (params: ConfigParams) => Promise<void>
  onGenerateCode?: () => Promise<void>
}

const EmbedIcon = ({ className = "" }: HTMLProps<HTMLDivElement>) => {
  return <div className={`${style.codeBrowserIcon} ${className}`}></div>
}

function AppCard({
  appInfo,
  cardType = "webapp",
  customBgColor,
  onChangeStatus,
  onSaveSiteConfig,
  onGenerateCode,
  className,
}: IAppCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    currentWorkspace,
    isCurrentWorkspaceManager,
    isCurrentWorkspaceEditor,
  } = useAppContext()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showEmbedded, setShowEmbedded] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const { t } = useTranslation()

  const OPERATIONS_MAP = useMemo(() => {
    const operationsMap = {
      webapp: [
        {
          opName: t("appOverview.overview.appInfo.preview"),
          opIcon: RocketLaunchIcon,
        },
        {
          opName: t("appOverview.overview.appInfo.customize.entry"),
          opIcon: PaintBrushIcon,
        },
      ] as { opName: string; opIcon: any }[],
      api: [
        {
          opName: t("appOverview.overview.apiInfo.doc"),
          opIcon: DocumentTextIcon,
        },
      ],
      app: [],
    }
    if (appInfo.mode !== "completion" && appInfo.mode !== "workflow")
      operationsMap.webapp.push({
        opName: t("appOverview.overview.appInfo.embedded.entry"),
        opIcon: EmbedIcon,
      })

    if (isCurrentWorkspaceEditor)
      operationsMap.webapp.push({
        opName: t("appOverview.overview.appInfo.settings.entry"),
        opIcon: Cog8ToothIcon,
      })

    return operationsMap
  }, [isCurrentWorkspaceEditor, appInfo, t])

  const isApp = cardType === "webapp"
  const basicName = isApp
    ? appInfo?.site?.title
    : t("appOverview.overview.apiInfo.title")
  const toggleDisabled = isApp
    ? !isCurrentWorkspaceEditor
    : !isCurrentWorkspaceManager
  const runningStatus = isApp ? appInfo.enable_site : appInfo.enable_api
  const { app_base_url, access_token } = appInfo.site ?? {}
  const appMode =
    appInfo.mode !== "completion" && appInfo.mode !== "workflow"
      ? "chat"
      : appInfo.mode
  const appUrl = `${app_base_url}/${appMode}/${access_token}`
  const apiUrl = appInfo?.api_base_url

  let bgColor = "bg-primary-50 bg-opacity-40"
  if (cardType === "api") bgColor = "bg-purple-50"

  const genClickFuncByName = (opName: string) => {
    switch (opName) {
      case t("appOverview.overview.appInfo.preview"):
        return () => {
          window.open(appUrl, "_blank")
        }
      case t("appOverview.overview.appInfo.customize.entry"):
        return () => {
          setShowCustomizeModal(true)
        }
      case t("appOverview.overview.appInfo.settings.entry"):
        return () => {
          setShowSettingsModal(true)
        }
      case t("appOverview.overview.appInfo.embedded.entry"):
        return () => {
          setShowEmbedded(true)
        }
      default:
        // jump to page develop
        return () => {
          const pathSegments = pathname.split("/")
          pathSegments.pop()
          router.push(`${pathSegments.join("/")}/develop`)
        }
    }
  }

  const onGenCode = async () => {
    if (onGenerateCode) {
      setGenLoading(true)
      await asyncRunSafe(onGenerateCode())
      setGenLoading(false)
    }
  }

  return (
    <div
      className={`shadow-xs rounded-lg border-[0.5px] border-gray-200 ${
        className ?? ""
      }`}>
      <div className={`px-6 py-5 ${customBgColor ?? bgColor} rounded-lg`}>
        <div className="mb-2.5 flex flex-row items-start justify-between">
          <AppBasic
            iconType={cardType}
            icon={appInfo.icon}
            icon_background={appInfo.icon_background}
            name={basicName}
            type={
              isApp
                ? t("appOverview.overview.appInfo.explanation")
                : t("appOverview.overview.apiInfo.explanation")
            }
          />
          <div className="flex h-9 flex-row items-center">
            <Tag className="mr-2" color={runningStatus ? "green" : "yellow"}>
              {runningStatus
                ? t("appOverview.overview.status.running")
                : t("appOverview.overview.status.disable")}
            </Tag>
            <Switch
              defaultValue={runningStatus}
              onChange={onChangeStatus}
              disabled={toggleDisabled}
            />
          </div>
        </div>
        <div className="flex flex-col justify-center py-2">
          <div className="py-1">
            <div className="pb-1 text-xs text-gray-500">
              {isApp
                ? t("appOverview.overview.appInfo.accessibleAddress")
                : t("appOverview.overview.apiInfo.accessibleAddress")}
            </div>
            <div className="bg-opacity-2 inline-flex h-9 w-full items-center justify-start rounded-lg border border-black border-opacity-5 bg-black py-0.5 pl-2 pr-0.5">
              <div className="flex h-4 min-w-0 flex-1 items-start justify-start gap-2 px-2">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-gray-700">
                  {isApp ? appUrl : apiUrl}
                </div>
              </div>
              <Divider type="vertical" className="!mx-0.5 !h-3.5 shrink-0" />
              {isApp && (
                <ShareQRCode
                  content={isApp ? appUrl : apiUrl}
                  selectorId={randomString(8)}
                  className={"hover:bg-gray-200"}
                />
              )}
              <CopyFeedback
                content={isApp ? appUrl : apiUrl}
                selectorId={randomString(8)}
                className={"hover:bg-gray-200"}
              />
              {/* button copy link/ button regenerate */}
              {showConfirmDelete && (
                <Confirm
                  type="warning"
                  title={t("appOverview.overview.appInfo.regenerate")}
                  content={""}
                  isShow={showConfirmDelete}
                  onClose={() => setShowConfirmDelete(false)}
                  onConfirm={() => {
                    onGenCode()
                    setShowConfirmDelete(false)
                  }}
                  onCancel={() => setShowConfirmDelete(false)}
                />
              )}
              {isApp && isCurrentWorkspaceManager && (
                <Tooltip
                  content={t("appOverview.overview.appInfo.regenerate") || ""}
                  selector={`code-generate-${randomString(8)}`}>
                  <div
                    className="ml-0.5 h-8 w-8 cursor-pointer rounded-lg hover:bg-gray-200"
                    onClick={() => setShowConfirmDelete(true)}>
                    <div
                      className={`h-full w-full ${style.refreshIcon} ${
                        genLoading ? style.generateLogo : ""
                      }`}></div>
                  </div>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div className={"flex flex-row flex-wrap items-center gap-y-2 pt-2"}>
          {!isApp && (
            <SecretKeyButton
              className="mr-2 !h-8 flex-shrink-0 bg-white"
              textCls="!text-gray-700 font-medium"
              iconCls="stroke-[1.2px]"
              appId={appInfo.id}
            />
          )}
          {OPERATIONS_MAP[cardType].map(op => {
            const disabled =
              op.opName === t("appOverview.overview.appInfo.settings.entry")
                ? false
                : !runningStatus
            return (
              <Button
                className="mr-2"
                key={op.opName}
                onClick={genClickFuncByName(op.opName)}
                disabled={disabled}>
                <Tooltip
                  content={
                    t("appOverview.overview.appInfo.preUseReminder") ?? ""
                  }
                  selector={`op-btn-${randomString(16)}`}
                  className={disabled ? "mt-[-8px]" : "!hidden"}>
                  <div className="flex flex-row items-center">
                    <op.opIcon className="mr-1.5 h-4 w-4 stroke-[1.8px]" />
                    <span className="text-[13px]">{op.opName}</span>
                  </div>
                </Tooltip>
              </Button>
            )
          })}
        </div>
      </div>
      {isApp ? (
        <>
          <SettingsModal
            isChat={appMode === "chat"}
            appInfo={appInfo}
            isShow={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onSave={onSaveSiteConfig}
          />
          <EmbeddedModal
            siteInfo={appInfo.site}
            isShow={showEmbedded}
            onClose={() => setShowEmbedded(false)}
            appBaseUrl={app_base_url}
            accessToken={access_token}
          />
          <CustomizeModal
            isShow={showCustomizeModal}
            linkUrl=""
            onClose={() => setShowCustomizeModal(false)}
            appId={appInfo.id}
            api_base_url={appInfo.api_base_url}
            mode={appInfo.mode}
          />
        </>
      ) : null}
    </div>
  )
}

export default AppCard
