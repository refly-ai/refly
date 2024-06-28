"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiErrorWarningFill, RiLoader2Line } from "@remixicon/react"
import { FilePlus02 } from "@/components/base/icons/src/vender/line/files"
import { CheckCircle } from "@/components/base/icons/src/vender/solid/general"
import Popover from "@/components/base/popover"

export type ISegmentAddProps = {
  importStatus: ProcessStatus | string | undefined
  clearProcessStatus: () => void
  showNewSegmentModal: () => void
  showBatchModal: () => void
}

export enum ProcessStatus {
  WAITING = "waiting",
  PROCESSING = "processing",
  COMPLETED = "completed",
  ERROR = "error",
}

const SegmentAdd: FC<ISegmentAddProps> = ({
  importStatus,
  clearProcessStatus,
  showNewSegmentModal,
  showBatchModal,
}) => {
  const { t } = useTranslation()

  if (importStatus) {
    return (
      <>
        {(importStatus === ProcessStatus.WAITING ||
          importStatus === ProcessStatus.PROCESSING) && (
          <div className="relative mr-2 inline-flex items-center overflow-hidden rounded-lg border border-black/5 bg-[#F5F8FF] px-3 py-[6px] text-blue-700">
            {importStatus === ProcessStatus.WAITING && (
              <div className="absolute left-0 top-0 z-0 h-full w-3/12 bg-[#D1E0FF]" />
            )}
            {importStatus === ProcessStatus.PROCESSING && (
              <div className="absolute left-0 top-0 z-0 h-full w-2/3 bg-[#D1E0FF]" />
            )}
            <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
            <span className="z-10 text-[13px] font-medium leading-[18px]">
              {t("datasetDocuments.list.batchModal.processing")}
            </span>
          </div>
        )}
        {importStatus === ProcessStatus.COMPLETED && (
          <div className="mr-2 inline-flex items-center rounded-lg border border-black/5 bg-[#F6FEF9] px-3 py-[6px] text-gray-700">
            <CheckCircle className="mr-2 h-4 w-4 text-[#039855]" />
            <span className="text-[13px] font-medium leading-[18px]">
              {t("datasetDocuments.list.batchModal.completed")}
            </span>
            <span
              className="cursor-pointer pl-2 text-[13px] font-medium leading-[18px] text-[#155EEF]"
              onClick={clearProcessStatus}>
              {t("datasetDocuments.list.batchModal.ok")}
            </span>
          </div>
        )}
        {importStatus === ProcessStatus.ERROR && (
          <div className="mr-2 inline-flex items-center rounded-lg border border-black/5 bg-red-100 px-3 py-[6px] text-red-600">
            <RiErrorWarningFill className="mr-2 h-4 w-4 text-[#D92D20]" />
            <span className="text-[13px] font-medium leading-[18px]">
              {t("datasetDocuments.list.batchModal.error")}
            </span>
            <span
              className="cursor-pointer pl-2 text-[13px] font-medium leading-[18px] text-[#155EEF]"
              onClick={clearProcessStatus}>
              {t("datasetDocuments.list.batchModal.ok")}
            </span>
          </div>
        )}
      </>
    )
  }

  return (
    <Popover
      manualClose
      trigger="click"
      htmlContent={
        <div className="w-full py-1">
          <div
            className="mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={showNewSegmentModal}>
            {t("datasetDocuments.list.action.add")}
          </div>
          <div
            className="mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={showBatchModal}>
            {t("datasetDocuments.list.action.batchAdd")}
          </div>
        </div>
      }
      btnElement={
        <div className="inline-flex items-center">
          <FilePlus02 className="h-4 w-4 text-gray-700" />
          <span className="pl-1">
            {t("datasetDocuments.list.action.addButton")}
          </span>
        </div>
      }
      btnClassName={open =>
        cn(
          "mr-2 !py-[6px] !text-[13px] !leading-[18px] hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
          open ? "!bg-gray-100 !shadow-none" : "!bg-transparent",
        )
      }
      className="!left-0 !z-20 h-fit !w-[132px] !translate-x-0"
    />
  )
}
export default React.memo(SegmentAdd)
