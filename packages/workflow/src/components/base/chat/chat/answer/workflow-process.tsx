import { useCallback, useEffect, useMemo, useState } from "react"
import cn from "classnames"
import {
  RiArrowRightSLine,
  RiErrorWarningFill,
  RiLoader2Line,
} from "@remixicon/react"
import { useTranslation } from "react-i18next"
import type { ChatItem, WorkflowProcess } from "../../types"
import { CheckCircle } from "@/components/base/icons/src/vender/solid/general"
import { WorkflowRunningStatus } from "@/components/workflow/types"
import NodePanel from "@/components/workflow/run/node"
import { useStore as useAppStore } from "@/store"

type WorkflowProcessProps = {
  data: WorkflowProcess
  item?: ChatItem
  grayBg?: boolean
  expand?: boolean
  hideInfo?: boolean
  hideProcessDetail?: boolean
}
const WorkflowProcessItem = ({
  data,
  item,
  grayBg,
  expand = false,
  hideInfo = false,
  hideProcessDetail = false,
}: WorkflowProcessProps) => {
  const { t } = useTranslation()
  const [collapse, setCollapse] = useState(!expand)
  const running = data.status === WorkflowRunningStatus.Running
  const succeeded = data.status === WorkflowRunningStatus.Succeeded
  const failed =
    data.status === WorkflowRunningStatus.Failed ||
    data.status === WorkflowRunningStatus.Stopped

  const background = useMemo(() => {
    if (running && !collapse)
      return "linear-gradient(180deg, #E1E4EA 0%, #EAECF0 100%)"

    if (succeeded && !collapse)
      return "linear-gradient(180deg, #ECFDF3 0%, #F6FEF9 100%)"

    if (failed && !collapse)
      return "linear-gradient(180deg, #FEE4E2 0%, #FEF3F2 100%)"
  }, [running, succeeded, failed, collapse])

  useEffect(() => {
    setCollapse(!expand)
  }, [expand])

  const setCurrentLogItem = useAppStore(s => s.setCurrentLogItem)
  const setShowMessageLogModal = useAppStore(s => s.setShowMessageLogModal)
  const setCurrentLogModalActiveTab = useAppStore(
    s => s.setCurrentLogModalActiveTab,
  )

  const showIterationDetail = useCallback(() => {
    setCurrentLogItem(item)
    setCurrentLogModalActiveTab("TRACING")
    setShowMessageLogModal(true)
  }, [
    item,
    setCurrentLogItem,
    setCurrentLogModalActiveTab,
    setShowMessageLogModal,
  ])

  return (
    <div
      className={cn(
        "border-black/8 mb-2 rounded-xl border-[0.5px]",
        collapse ? "py-[7px]" : hideInfo ? "pb-1 pt-2" : "py-2",
        collapse && (!grayBg ? "bg-white" : "bg-gray-50"),
        hideInfo ? "mx-[-8px] px-1" : "w-full px-3",
      )}
      style={{
        background,
      }}>
      <div
        className={cn(
          "flex h-[18px] cursor-pointer items-center",
          hideInfo && "px-[6px]",
        )}
        onClick={() => setCollapse(!collapse)}>
        {running && (
          <RiLoader2Line className="mr-1 h-3 w-3 shrink-0 animate-spin text-[#667085]" />
        )}
        {succeeded && (
          <CheckCircle className="mr-1 h-3 w-3 shrink-0 text-[#12B76A]" />
        )}
        {failed && (
          <RiErrorWarningFill className="mr-1 h-3 w-3 shrink-0 text-[#F04438]" />
        )}
        <div className="grow text-xs font-medium text-gray-700">
          {t("workflow.common.workflowProcess")}
        </div>
        <RiArrowRightSLine
          className={`'ml-1 text-gray-500' h-3 w-3 ${collapse ? "" : "rotate-90"}`}
        />
      </div>
      {!collapse && (
        <div className="mt-1.5">
          {data.tracing.map(node => (
            <div key={node.id} className="mb-1 last-of-type:mb-0">
              <NodePanel
                nodeInfo={node}
                hideInfo={hideInfo}
                hideProcessDetail={hideProcessDetail}
                onShowIterationDetail={showIterationDetail}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WorkflowProcessItem
