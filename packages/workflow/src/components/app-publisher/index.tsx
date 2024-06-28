import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import dayjs from "dayjs"
import { RiArrowDownSLine } from "@remixicon/react"
import type { ModelAndParameter } from "../configuration/debug/types"
import SuggestedAction from "./suggested-action"
import PublishWithMultipleModel from "./publish-with-multiple-model"
import Button from "@/components/base/button"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import EmbeddedModal from "@/components/overview/embedded"
import { useStore as useAppStore } from "@/store"
import { useGetLanguage } from "@/context/i18n"
import { PlayCircle } from "@/components/base/icons/src/vender/line/mediaAndDevices"
import { CodeBrowser } from "@/components/base/icons/src/vender/line/development"
import { LeftIndent02 } from "@/components/base/icons/src/vender/line/editor"
import { FileText } from "@/components/base/icons/src/vender/line/files"
import WorkflowToolConfigureButton from "@/components/tools/workflow-tool/configure-button"
import type { InputVar } from "@/components/workflow/types"

export type AppPublisherProps = {
  disabled?: boolean
  publishDisabled?: boolean
  publishedAt?: number
  /** only needed in workflow / chatflow mode */
  draftUpdatedAt?: number
  debugWithMultipleModel?: boolean
  multipleModelConfigs?: ModelAndParameter[]
  /** modelAndParameter is passed when debugWithMultipleModel is true */
  onPublish?: (modelAndParameter?: ModelAndParameter) => Promise<any> | any
  onRestore?: () => Promise<any> | any
  onToggle?: (state: boolean) => void
  crossAxisOffset?: number
  toolPublished?: boolean
  inputs?: InputVar[]
  onRefreshData?: () => void
}

const AppPublisher = ({
  disabled = false,
  publishDisabled = false,
  publishedAt,
  draftUpdatedAt,
  debugWithMultipleModel = false,
  multipleModelConfigs = [],
  onPublish,
  onRestore,
  onToggle,
  crossAxisOffset = 0,
  toolPublished,
  inputs,
  onRefreshData,
}: AppPublisherProps) => {
  const { t } = useTranslation()
  const [published, setPublished] = useState(false)
  const [open, setOpen] = useState(false)
  const appDetail = useAppStore(state => state.appDetail)
  const { app_base_url: appBaseURL = "", access_token: accessToken = "" } =
    appDetail?.site ?? {}
  const appMode =
    appDetail?.mode !== "completion" && appDetail?.mode !== "workflow"
      ? "chat"
      : appDetail.mode
  const appURL = `${appBaseURL}/${appMode}/${accessToken}`

  const language = useGetLanguage()
  const formatTimeFromNow = useCallback(
    (time: number) => {
      return dayjs(time)
        .locale(language === "zh_Hans" ? "zh-cn" : language.replace("_", "-"))
        .fromNow()
    },
    [language],
  )

  const handlePublish = async (modelAndParameter?: ModelAndParameter) => {
    try {
      await onPublish?.(modelAndParameter)
      setPublished(true)
    } catch (e) {
      setPublished(false)
    }
  }

  const handleRestore = useCallback(async () => {
    try {
      await onRestore?.()
      setOpen(false)
    } catch (e) {}
  }, [onRestore])

  const handleTrigger = useCallback(() => {
    const state = !open

    if (disabled) {
      setOpen(false)
      return
    }

    onToggle?.(state)
    setOpen(state)

    if (state) setPublished(false)
  }, [disabled, onToggle, open])

  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false)

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={{
        mainAxis: 4,
        crossAxis: crossAxisOffset,
      }}>
      <PortalToFollowElemTrigger onClick={handleTrigger}>
        <Button variant="primary" className="pl-3 pr-1" disabled={disabled}>
          {t("workflow.common.publish")}
          <RiArrowDownSLine className="ml-0.5" />
        </Button>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent className="z-[11]">
        <div className="w-[336px] rounded-2xl border-[0.5px] border-gray-200 bg-white shadow-xl">
          <div className="p-4 pt-3">
            <div className="flex h-6 items-center text-xs font-medium uppercase text-gray-500">
              {publishedAt
                ? t("workflow.common.latestPublished")
                : t("workflow.common.currentDraftUnpublished")}
            </div>
            {publishedAt ? (
              <div className="flex h-[18px] items-center justify-between">
                <div className="mb-[3px] mt-[3px] flex items-center text-[13px] font-medium leading-[18px] text-gray-700">
                  {t("workflow.common.publishedAt")}{" "}
                  {formatTimeFromNow(publishedAt)}
                </div>
                <Button
                  className={`text-primary-600 ml-2 px-2 ${published && "text-primary-300 border-gray-100"} `}
                  size="small"
                  onClick={handleRestore}
                  disabled={published}>
                  {t("workflow.common.restore")}
                </Button>
              </div>
            ) : (
              <div className="flex h-[18px] items-center text-[13px] font-medium leading-[18px] text-gray-700">
                {t("workflow.common.autoSaved")} ·{" "}
                {Boolean(draftUpdatedAt) && formatTimeFromNow(draftUpdatedAt!)}
              </div>
            )}
            {debugWithMultipleModel ? (
              <PublishWithMultipleModel
                multipleModelConfigs={multipleModelConfigs}
                onSelect={item => handlePublish(item)}
                // textGenerationModelList={textGenerationModelList}
              />
            ) : (
              <Button
                variant="primary"
                className="mt-3 w-full"
                onClick={() => handlePublish()}
                disabled={publishDisabled || published}>
                {published
                  ? t("workflow.common.published")
                  : publishedAt
                    ? t("workflow.common.update")
                    : t("workflow.common.publish")}
              </Button>
            )}
          </div>
          <div className="border-t-[0.5px] border-t-black/5 p-4 pt-3">
            <SuggestedAction
              disabled={!publishedAt}
              link={appURL}
              icon={<PlayCircle />}>
              {t("workflow.common.runApp")}
            </SuggestedAction>
            {appDetail?.mode === "workflow" ? (
              <SuggestedAction
                disabled={!publishedAt}
                link={`${appURL}${appURL.includes("?") ? "&" : "?"}mode=batch`}
                icon={<LeftIndent02 className="h-4 w-4" />}>
                {t("workflow.common.batchRunApp")}
              </SuggestedAction>
            ) : (
              <SuggestedAction
                onClick={() => {
                  setEmbeddingModalOpen(true)
                  handleTrigger()
                }}
                disabled={!publishedAt}
                icon={<CodeBrowser className="h-4 w-4" />}>
                {t("workflow.common.embedIntoSite")}
              </SuggestedAction>
            )}
            <SuggestedAction
              disabled={!publishedAt}
              link="./develop"
              icon={<FileText className="h-4 w-4" />}>
              {t("workflow.common.accessAPIReference")}
            </SuggestedAction>
            {appDetail?.mode === "workflow" && (
              <WorkflowToolConfigureButton
                disabled={!publishedAt}
                published={!!toolPublished}
                detailNeedUpdate={!!toolPublished && published}
                workflowAppId={appDetail?.id}
                icon={{
                  content: appDetail?.icon,
                  background: appDetail?.icon_background,
                }}
                name={appDetail?.name}
                description={appDetail?.description}
                inputs={inputs}
                handlePublish={handlePublish}
                onRefreshData={onRefreshData}
              />
            )}
          </div>
        </div>
      </PortalToFollowElemContent>
      <EmbeddedModal
        siteInfo={appDetail?.site}
        isShow={embeddingModalOpen}
        onClose={() => setEmbeddingModalOpen(false)}
        appBaseUrl={appBaseURL}
        accessToken={accessToken}
      />
    </PortalToFollowElem>
  )
}

export default memo(AppPublisher)
