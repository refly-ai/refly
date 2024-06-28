"use client"
import { useTranslation } from "react-i18next"
import type { FC } from "react"
import { useCallback, useEffect, useState } from "react"
import cn from "classnames"
import {
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader2Line,
} from "@remixicon/react"
import BlockIcon from "../block-icon"
import { BlockEnum } from "../types"
import Split from "../nodes/_base/components/split"
import CodeEditor from "@/components/workflow/nodes/_base/components/editor/code-editor"
import { CodeLanguage } from "@/components/workflow/nodes/code/types"
import { AlertTriangle } from "@/components/base/icons/src/vender/line/alertsAndFeedback"
import type { NodeTracing } from "@/types/workflow"

type Props = {
  className?: string
  nodeInfo: NodeTracing
  hideInfo?: boolean
  hideProcessDetail?: boolean
  onShowIterationDetail?: (detail: NodeTracing[][]) => void
  notShowIterationNav?: boolean
  justShowIterationNavArrow?: boolean
}

const NodePanel: FC<Props> = ({
  className,
  nodeInfo,
  hideInfo = false,
  hideProcessDetail,
  onShowIterationDetail,
  notShowIterationNav,
  justShowIterationNavArrow,
}) => {
  const [collapseState, doSetCollapseState] = useState<boolean>(true)
  const setCollapseState = useCallback(
    (state: boolean) => {
      if (hideProcessDetail) return
      doSetCollapseState(state)
    },
    [hideProcessDetail],
  )
  const { t } = useTranslation()

  const getTime = (time: number) => {
    if (time < 1) return `${(time * 1000).toFixed(3)} ms`
    if (time > 60)
      return `${parseInt(Math.round(time / 60).toString())} m ${(time % 60).toFixed(3)} s`
    return `${time.toFixed(3)} s`
  }

  const getTokenCount = (tokens: number) => {
    if (tokens < 1000) return tokens
    if (tokens >= 1000 && tokens < 1000000)
      return `${parseFloat((tokens / 1000).toFixed(3))}K`
    if (tokens >= 1000000)
      return `${parseFloat((tokens / 1000000).toFixed(3))}M`
  }

  useEffect(() => {
    setCollapseState(!nodeInfo.expand)
  }, [nodeInfo.expand, setCollapseState])

  const isIterationNode = nodeInfo.node_type === BlockEnum.Iteration
  const handleOnShowIterationDetail = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    onShowIterationDetail?.(nodeInfo.details || [])
  }
  return (
    <div className={cn("px-4 py-1", className, hideInfo && "!p-0")}>
      <div
        className={cn(
          "shadow-xs group rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-md",
          hideInfo && "!rounded-lg",
        )}>
        <div
          className={cn(
            "flex cursor-pointer items-center pl-[6px] pr-3",
            hideInfo ? "py-2" : "py-3",
            !collapseState && (hideInfo ? "!pb-1" : "!pb-2"),
          )}
          onClick={() => setCollapseState(!collapseState)}>
          {!hideProcessDetail && (
            <RiArrowRightSLine
              className={cn(
                "mr-1 h-3 w-3 shrink-0 text-gray-400 transition-all group-hover:text-gray-500",
                !collapseState && "rotate-90",
              )}
            />
          )}

          <BlockIcon
            size={hideInfo ? "xs" : "sm"}
            className={cn("mr-2 shrink-0", hideInfo && "!mr-1")}
            type={nodeInfo.node_type}
            toolIcon={nodeInfo.extras?.icon || nodeInfo.extras}
          />
          <div
            className={cn(
              "grow truncate text-[13px] font-semibold leading-[16px] text-gray-700",
              hideInfo && "!text-xs",
            )}
            title={nodeInfo.title}>
            {nodeInfo.title}
          </div>
          {nodeInfo.status !== "running" && !hideInfo && (
            <div className="shrink-0 text-xs leading-[18px] text-gray-500">{`${getTime(nodeInfo.elapsed_time || 0)} · ${getTokenCount(nodeInfo.execution_metadata?.total_tokens || 0)} tokens`}</div>
          )}
          {nodeInfo.status === "succeeded" && (
            <RiCheckboxCircleLine className="ml-2 h-3.5 w-3.5 shrink-0 text-[#12B76A]" />
          )}
          {nodeInfo.status === "failed" && (
            <RiErrorWarningLine className="ml-2 h-3.5 w-3.5 shrink-0 text-[#F04438]" />
          )}
          {nodeInfo.status === "stopped" && (
            <AlertTriangle className="ml-2 h-3.5 w-3.5 shrink-0 text-[#F79009]" />
          )}
          {nodeInfo.status === "running" && (
            <div className="text-primary-600 flex shrink-0 items-center text-[13px] font-medium leading-[16px]">
              <span className="mr-2 text-xs font-normal">Running</span>
              <RiLoader2Line className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}
        </div>
        {!collapseState && !hideProcessDetail && (
          <div className="pb-2">
            {/* The nav to the iteration detail */}
            {isIterationNode && !notShowIterationNav && (
              <div className="mb-1 mt-2 !px-2">
                <div
                  className="flex h-[34px] cursor-pointer items-center justify-between rounded-lg border-[0.5px] border-gray-200 bg-gray-100 px-3"
                  onClick={handleOnShowIterationDetail}>
                  <div className="text-[13px] font-medium leading-[18px] text-gray-700">
                    {t("workflow.nodes.iteration.iteration", {
                      count:
                        nodeInfo.metadata?.iterator_length ||
                        nodeInfo.execution_metadata?.steps_boundary?.length - 1,
                    })}
                  </div>
                  {justShowIterationNavArrow ? (
                    <RiArrowRightSLine className="h-3.5 w-3.5 text-gray-500" />
                  ) : (
                    <div className="flex items-center space-x-1 text-[#155EEF]">
                      <div className="text-[13px] font-normal">
                        {t("workflow.common.viewDetailInTracingPanel")}
                      </div>
                      <RiArrowRightSLine className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <Split className="mt-2" />
              </div>
            )}
            <div className={cn("px-[10px] py-1", hideInfo && "!px-2 !py-0.5")}>
              {nodeInfo.status === "stopped" && (
                <div className="shadow-xs rounded-lg border-[0.5px] border-[rbga(0,0,0,0.05)] bg-[#fffaeb] px-3 py-[10px] text-xs leading-[18px] text-[#dc6803]">
                  {t("workflow.tracing.stopBy", {
                    user: nodeInfo.created_by
                      ? nodeInfo.created_by.name
                      : "N/A",
                  })}
                </div>
              )}
              {nodeInfo.status === "failed" && (
                <div className="shadow-xs rounded-lg border-[0.5px] border-[rbga(0,0,0,0.05)] bg-[#fef3f2] px-3 py-[10px] text-xs leading-[18px] text-[#d92d20]">
                  {nodeInfo.error}
                </div>
              )}
            </div>
            {nodeInfo.inputs && (
              <div
                className={cn("px-[10px] py-1", hideInfo && "!px-2 !py-0.5")}>
                <CodeEditor
                  readOnly
                  title={
                    <div>{t("workflow.common.input").toLocaleUpperCase()}</div>
                  }
                  language={CodeLanguage.json}
                  value={nodeInfo.inputs}
                  isJSONStringifyBeauty
                />
              </div>
            )}
            {nodeInfo.process_data && (
              <div
                className={cn("px-[10px] py-1", hideInfo && "!px-2 !py-0.5")}>
                <CodeEditor
                  readOnly
                  title={
                    <div>
                      {t("workflow.common.processData").toLocaleUpperCase()}
                    </div>
                  }
                  language={CodeLanguage.json}
                  value={nodeInfo.process_data}
                  isJSONStringifyBeauty
                />
              </div>
            )}
            {nodeInfo.outputs && (
              <div
                className={cn("px-[10px] py-1", hideInfo && "!px-2 !py-0.5")}>
                <CodeEditor
                  readOnly
                  title={
                    <div>{t("workflow.common.output").toLocaleUpperCase()}</div>
                  }
                  language={CodeLanguage.json}
                  value={nodeInfo.outputs}
                  isJSONStringifyBeauty
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default NodePanel
