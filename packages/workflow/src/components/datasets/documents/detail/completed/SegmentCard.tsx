import type { FC } from "react"
import React, { useState } from "react"
import cn from "classnames"
import { ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { useTranslation } from "react-i18next"
import { RiDeleteBinLine, RiErrorWarningFill } from "@remixicon/react"
import { StatusItem } from "../../list"
import { DocumentTitle } from "../index"
import s from "./style.module.css"
import { SegmentIndexTag } from "./index"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import Switch from "@/components/base/switch"
import Divider from "@/components/base/divider"
import Indicator from "@/components/header/indicator"
import { formatNumber } from "@/utils/format"
import type { SegmentDetailModel } from "@/models/datasets"

const ProgressBar: FC<{ percent: number; loading: boolean }> = ({
  percent,
  loading,
}) => {
  return (
    <div className={s.progressWrapper}>
      <div className={cn(s.progress, loading ? s.progressLoading : "")}>
        <div
          className={s.progressInner}
          style={{
            width: `${loading ? 0 : (Math.min(percent, 1) * 100).toFixed(2)}%`,
          }}
        />
      </div>
      <div className={loading ? s.progressTextLoading : s.progressText}>
        {loading ? null : percent.toFixed(2)}
      </div>
    </div>
  )
}

export type UsageScene = "doc" | "hitTesting"

type ISegmentCardProps = {
  loading: boolean
  detail?: SegmentDetailModel & { document: { name: string } }
  score?: number
  onClick?: () => void
  onChangeSwitch?: (segId: string, enabled: boolean) => Promise<void>
  onDelete?: (segId: string) => Promise<void>
  scene?: UsageScene
  className?: string
  archived?: boolean
  embeddingAvailable?: boolean
}

const SegmentCard: FC<ISegmentCardProps> = ({
  detail = {},
  score,
  onClick,
  onChangeSwitch,
  onDelete,
  loading = true,
  scene = "doc",
  className = "",
  archived,
  embeddingAvailable,
}) => {
  const { t } = useTranslation()
  const {
    id,
    position,
    enabled,
    content,
    word_count,
    hit_count,
    index_node_hash,
    answer,
  } = detail as Required<ISegmentCardProps>["detail"]
  const isDocScene = scene === "doc"
  const [showModal, setShowModal] = useState(false)

  const renderContent = () => {
    if (answer) {
      return (
        <>
          <div className="mb-2 flex">
            <div className="mr-2 text-[13px] font-semibold text-gray-400">
              Q
            </div>
            <div className="text-[13px]">{content}</div>
          </div>
          <div className="flex">
            <div className="mr-2 text-[13px] font-semibold text-gray-400">
              A
            </div>
            <div className="text-[13px]">{answer}</div>
          </div>
        </>
      )
    }

    return content
  }

  return (
    <div
      className={cn(
        s.segWrapper,
        isDocScene && !enabled ? "bg-gray-25" : "",
        "group",
        !loading ? "pb-4 hover:pb-[10px]" : "",
        className,
      )}
      onClick={() => onClick?.()}>
      <div className={s.segTitleWrapper}>
        {isDocScene ? (
          <>
            <SegmentIndexTag
              positionId={position}
              className={cn(
                "w-fit group-hover:opacity-100",
                isDocScene && !enabled ? "opacity-50" : "",
              )}
            />
            <div className={s.segStatusWrapper}>
              {loading ? (
                <Indicator
                  color="gray"
                  className="border-gray-300 bg-gray-200 shadow-none"
                />
              ) : (
                <>
                  <StatusItem
                    status={enabled ? "enabled" : "disabled"}
                    reverse
                    textCls="text-gray-500 text-xs"
                  />
                  {embeddingAvailable && (
                    <div className="hidden items-center group-hover:inline-flex">
                      <Divider type="vertical" className="!h-2" />
                      <div
                        onClick={(
                          e: React.MouseEvent<HTMLDivElement, MouseEvent>,
                        ) => e.stopPropagation()}
                        className="inline-flex items-center">
                        <Switch
                          size="md"
                          disabled={archived || detail.status !== "completed"}
                          defaultValue={enabled}
                          onChange={async val => {
                            await onChangeSwitch?.(id, val)
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : score !== null ? (
          <div className={s.hitTitleWrapper}>
            <div
              className={cn(
                s.commonIcon,
                s.targetIcon,
                loading ? "!bg-gray-300" : "",
                "!h-3.5 !w-3.5",
              )}
            />
            <ProgressBar percent={score ?? 0} loading={loading} />
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className={cn(s.cardLoadingWrapper, s.cardLoadingIcon)}>
          <div className={cn(s.cardLoadingBg)} />
        </div>
      ) : isDocScene ? (
        <>
          <div
            className={cn(
              s.segContent,
              enabled ? "" : "opacity-50",
              "group-hover:bg-gradient-to-b group-hover:bg-clip-text group-hover:text-transparent",
            )}>
            {renderContent()}
          </div>
          <div className={cn("group-hover:flex", s.segData)}>
            <div className="mr-6 flex items-center">
              <div className={cn(s.commonIcon, s.typeSquareIcon)}></div>
              <div className={s.segDataText}>{formatNumber(word_count)}</div>
            </div>
            <div className="mr-6 flex items-center">
              <div className={cn(s.commonIcon, s.targetIcon)} />
              <div className={s.segDataText}>{formatNumber(hit_count)}</div>
            </div>
            <div className="flex grow items-center">
              <div className={cn(s.commonIcon, s.bezierCurveIcon)} />
              <div className={s.segDataText}>{index_node_hash}</div>
            </div>
            {!archived && embeddingAvailable && (
              <div
                className="group/delete flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-red-100 hover:text-red-600"
                onClick={e => {
                  e.stopPropagation()
                  setShowModal(true)
                }}>
                <RiDeleteBinLine className="h-[14px] w-[14px] text-gray-500 group-hover/delete:text-red-600" />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="h-[140px] overflow-hidden text-ellipsis text-sm font-normal text-gray-800">
            {renderContent()}
          </div>
          <div className={cn("w-full bg-gray-50 group-hover:bg-white")}>
            <Divider />
            <div className="relative flex w-full items-center">
              <DocumentTitle
                name={detail?.document?.name || ""}
                extension={
                  (detail?.document?.name || "").split(".").pop() || "txt"
                }
                wrapperCls="w-full"
                iconCls="!h-4 !w-4 !bg-contain"
                textCls="text-xs text-gray-700 !font-normal overflow-hidden whitespace-nowrap text-ellipsis"
              />
              <div className={cn(s.chartLinkText, "group-hover:inline-flex")}>
                {t("datasetHitTesting.viewChart")}
                <ArrowUpRightIcon className="ml-1 h-3 w-3 stroke-current stroke-2" />
              </div>
            </div>
          </div>
        </>
      )}
      {showModal && (
        <Modal
          isShow={showModal}
          onClose={() => setShowModal(false)}
          className={s.delModal}
          closable>
          <div>
            <div className={s.warningWrapper}>
              <RiErrorWarningFill className="h-6 w-6 text-red-600" />
            </div>
            <div className="mb-1 text-xl font-semibold text-gray-900">
              {t("datasetDocuments.segment.delete")}
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowModal(false)}>
                {t("common.operation.cancel")}
              </Button>
              <Button
                variant="warning"
                onClick={async () => {
                  await onDelete?.(id)
                }}
                className="border-red-700">
                {t("common.operation.sure")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default SegmentCard
