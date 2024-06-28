import type { FC } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiLoader2Line, RiPlayLargeFill } from "@remixicon/react"
import { useStore } from "../store"
import { useIsChatMode, useWorkflowRun, useWorkflowStartRun } from "../hooks"
import { WorkflowRunningStatus } from "../types"
import ViewHistory from "./view-history"
import { StopCircle } from "@/components/base/icons/src/vender/line/mediaAndDevices"
import { MessagePlay } from "@/components/base/icons/src/vender/line/communication"

const RunMode = memo(() => {
  const { t } = useTranslation()
  const { handleWorkflowStartRunInWorkflow } = useWorkflowStartRun()
  const { handleStopRun } = useWorkflowRun()
  const workflowRunningData = useStore(s => s.workflowRunningData)
  const isRunning =
    workflowRunningData?.result.status === WorkflowRunningStatus.Running

  return (
    <>
      <div
        className={cn(
          "text-primary-600 flex h-7 items-center rounded-md px-1.5 text-[13px] font-medium",
          "hover:bg-primary-50 cursor-pointer",
          isRunning && "bg-primary-50 !cursor-not-allowed",
        )}
        onClick={() => handleWorkflowStartRunInWorkflow()}>
        {isRunning ? (
          <>
            <RiLoader2Line className="mr-1 h-4 w-4 animate-spin" />
            {t("workflow.common.running")}
          </>
        ) : (
          <>
            <RiPlayLargeFill className="mr-1 h-4 w-4" />
            {t("workflow.common.run")}
          </>
        )}
      </div>
      {isRunning && (
        <div
          className="ml-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
          onClick={() => handleStopRun(workflowRunningData?.task_id || "")}>
          <StopCircle className="h-4 w-4 text-gray-500" />
        </div>
      )}
    </>
  )
})
RunMode.displayName = "RunMode"

const PreviewMode = memo(() => {
  const { t } = useTranslation()
  const { handleWorkflowStartRunInChatflow } = useWorkflowStartRun()

  return (
    <div
      className={cn(
        "text-primary-600 flex h-7 items-center rounded-md px-1.5 text-[13px] font-medium",
        "hover:bg-primary-50 cursor-pointer",
      )}
      onClick={() => handleWorkflowStartRunInChatflow()}>
      <MessagePlay className="mr-1 h-4 w-4" />
      {t("workflow.common.debugAndPreview")}
    </div>
  )
})
PreviewMode.displayName = "PreviewMode"

const RunAndHistory: FC = () => {
  const isChatMode = useIsChatMode()

  return (
    <div className="shadow-xs flex h-8 items-center rounded-lg border-[0.5px] border-gray-200 bg-white px-0.5">
      {!isChatMode && <RunMode />}
      {isChatMode && <PreviewMode />}
      <div className="mx-0.5 h-8 w-[0.5px] bg-gray-200"></div>
      <ViewHistory />
    </div>
  )
}

export default memo(RunAndHistory)
