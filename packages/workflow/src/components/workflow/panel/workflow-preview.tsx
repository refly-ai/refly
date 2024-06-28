import {
  memo,
  useCallback,
  useEffect,
  // useRef,
  useState,
} from "react"
import cn from "classnames"
import { RiClipboardLine, RiCloseLine } from "@remixicon/react"
import { useTranslation } from "react-i18next"
import copy from "copy-to-clipboard"
import { useBoolean } from "ahooks"
import ResultText from "../run/result-text"
import ResultPanel from "../run/result-panel"
import TracingPanel from "../run/tracing-panel"
import { useWorkflowInteractions } from "../hooks"
import { useStore } from "../store"
import { WorkflowRunningStatus } from "../types"
import { SimpleBtn } from "@/components/text-generate/item"
import Toast from "../../base/toast"
import IterationResultPanel from "../run/iteration-result-panel"
import InputsPanel from "./inputs-panel"
import Loading from "@/components/base/loading"
import type { NodeTracing } from "@/types/workflow"

const WorkflowPreview = ({
  onShowIterationDetail,
}: {
  onShowIterationDetail: (detail: NodeTracing[][]) => void
}) => {
  const { t } = useTranslation()
  const { handleCancelDebugAndPreviewPanel } = useWorkflowInteractions()
  const workflowRunningData = useStore(s => s.workflowRunningData)
  const showInputsPanel = useStore(s => s.showInputsPanel)
  const showDebugAndPreviewPanel = useStore(s => s.showDebugAndPreviewPanel)
  const [currentTab, setCurrentTab] = useState<string>(
    showInputsPanel ? "INPUT" : "TRACING",
  )

  const switchTab = async (tab: string) => {
    setCurrentTab(tab)
  }

  useEffect(() => {
    if (showDebugAndPreviewPanel && showInputsPanel) setCurrentTab("INPUT")
  }, [showDebugAndPreviewPanel, showInputsPanel])

  useEffect(() => {
    if (
      (workflowRunningData?.result.status === WorkflowRunningStatus.Succeeded ||
        workflowRunningData?.result.status === WorkflowRunningStatus.Failed) &&
      !workflowRunningData.resultText
    )
      switchTab("DETAIL")
  }, [workflowRunningData])

  const [iterationRunResult, setIterationRunResult] = useState<NodeTracing[][]>(
    [],
  )
  const [
    isShowIterationDetail,
    { setTrue: doShowIterationDetail, setFalse: doHideIterationDetail },
  ] = useBoolean(false)

  const handleShowIterationDetail = useCallback(
    (detail: NodeTracing[][]) => {
      setIterationRunResult(detail)
      doShowIterationDetail()
    },
    [doShowIterationDetail],
  )

  if (isShowIterationDetail) {
    return (
      <div
        className={`flex h-full w-[420px] flex-col rounded-l-2xl border-[0.5px] border-gray-200 bg-white shadow-xl`}>
        <IterationResultPanel
          list={iterationRunResult}
          onHide={doHideIterationDetail}
          onBack={doHideIterationDetail}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex h-full w-[420px] flex-col rounded-l-2xl border-[0.5px] border-gray-200 bg-white shadow-xl`}>
      <div className="flex items-center justify-between p-4 pb-1 text-base font-semibold text-gray-900">
        {`Test Run${!workflowRunningData?.result.sequence_number ? "" : `#${workflowRunningData?.result.sequence_number}`}`}
        <div
          className="cursor-pointer p-1"
          onClick={() => handleCancelDebugAndPreviewPanel()}>
          <RiCloseLine className="h-4 w-4 text-gray-500" />
        </div>
      </div>
      <div className="relative flex grow flex-col">
        {isShowIterationDetail ? (
          <IterationResultPanel
            list={iterationRunResult}
            onHide={doHideIterationDetail}
            onBack={doHideIterationDetail}
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center border-b-[0.5px] border-[rgba(0,0,0,0.05)] px-4">
              {showInputsPanel && (
                <div
                  className={cn(
                    "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
                    currentTab === "INPUT" &&
                      "!border-[rgb(21,94,239)] text-gray-700",
                  )}
                  onClick={() => switchTab("INPUT")}>
                  {t("runLog.input")}
                </div>
              )}
              <div
                className={cn(
                  "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
                  currentTab === "RESULT" &&
                    "!border-[rgb(21,94,239)] text-gray-700",
                  !workflowRunningData && "!cursor-not-allowed opacity-30",
                )}
                onClick={() => {
                  if (!workflowRunningData) return
                  switchTab("RESULT")
                }}>
                {t("runLog.result")}
              </div>
              <div
                className={cn(
                  "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
                  currentTab === "DETAIL" &&
                    "!border-[rgb(21,94,239)] text-gray-700",
                  !workflowRunningData && "!cursor-not-allowed opacity-30",
                )}
                onClick={() => {
                  if (!workflowRunningData) return
                  switchTab("DETAIL")
                }}>
                {t("runLog.detail")}
              </div>
              <div
                className={cn(
                  "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
                  currentTab === "TRACING" &&
                    "!border-[rgb(21,94,239)] text-gray-700",
                  !workflowRunningData && "!cursor-not-allowed opacity-30",
                )}
                onClick={() => {
                  if (!workflowRunningData) return
                  switchTab("TRACING")
                }}>
                {t("runLog.tracing")}
              </div>
            </div>
            <div
              className={cn(
                "h-0 grow overflow-y-auto rounded-b-2xl bg-white",
                (currentTab === "RESULT" || currentTab === "TRACING") &&
                  "!bg-gray-50",
              )}>
              {currentTab === "INPUT" && showInputsPanel && (
                <InputsPanel onRun={() => switchTab("RESULT")} />
              )}
              {currentTab === "RESULT" && (
                <>
                  <ResultText
                    isRunning={
                      workflowRunningData?.result?.status ===
                        WorkflowRunningStatus.Running ||
                      !workflowRunningData?.result
                    }
                    outputs={workflowRunningData?.resultText}
                    error={workflowRunningData?.result?.error}
                    onClick={() => switchTab("DETAIL")}
                  />
                  {workflowRunningData?.result.status ===
                    WorkflowRunningStatus.Succeeded &&
                    workflowRunningData?.resultText &&
                    typeof workflowRunningData?.resultText === "string" && (
                      <SimpleBtn
                        className={cn("mb-4 ml-4 inline-flex space-x-1")}
                        onClick={() => {
                          const content = workflowRunningData?.resultText
                          if (typeof content === "string") copy(content)
                          else copy(JSON.stringify(content))
                          Toast.notify({
                            type: "success",
                            message: t("common.actionMsg.copySuccessfully"),
                          })
                        }}>
                        <RiClipboardLine className="h-3.5 w-3.5" />
                        <div>{t("common.operation.copy")}</div>
                      </SimpleBtn>
                    )}
                </>
              )}
              {currentTab === "DETAIL" && (
                <ResultPanel
                  inputs={workflowRunningData?.result?.inputs}
                  outputs={workflowRunningData?.result?.outputs}
                  status={workflowRunningData?.result?.status || ""}
                  error={workflowRunningData?.result?.error}
                  elapsed_time={workflowRunningData?.result?.elapsed_time}
                  total_tokens={workflowRunningData?.result?.total_tokens}
                  created_at={workflowRunningData?.result?.created_at}
                  created_by={
                    (workflowRunningData?.result?.created_by as any)?.name
                  }
                  steps={workflowRunningData?.result?.total_steps}
                />
              )}
              {currentTab === "DETAIL" && !workflowRunningData?.result && (
                <div className="flex h-full items-center justify-center bg-white">
                  <Loading />
                </div>
              )}
              {currentTab === "TRACING" && (
                <TracingPanel
                  list={workflowRunningData?.tracing || []}
                  onShowIterationDetail={handleShowIterationDetail}
                />
              )}
              {currentTab === "TRACING" &&
                !workflowRunningData?.tracing?.length && (
                  <div className="flex h-full items-center justify-center bg-gray-50">
                    <Loading />
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default memo(WorkflowPreview)
