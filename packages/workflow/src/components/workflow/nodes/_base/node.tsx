import type { FC, ReactElement } from "react"
import { cloneElement, memo, useEffect, useMemo, useRef } from "react"
import cn from "classnames"
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader2Line,
} from "@remixicon/react"
import type { NodeProps } from "../../types"
import { BlockEnum, NodeRunningStatus } from "../../types"
import { useNodesReadOnly, useToolIcon } from "../../hooks"
import { useNodeIterationInteractions } from "../iteration/use-interactions"
import { NodeSourceHandle, NodeTargetHandle } from "./components/node-handle"
import NodeResizer from "./components/node-resizer"
import NodeControl from "./components/node-control"
import AddVariablePopupWithPosition from "./components/add-variable-popup-with-position"
import BlockIcon from "@/components/workflow/block-icon"

type BaseNodeProps = {
  children: ReactElement
} & NodeProps

const BaseNode: FC<BaseNodeProps> = ({ id, data, children }) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const { nodesReadOnly } = useNodesReadOnly()
  const { handleNodeIterationChildSizeChange } = useNodeIterationInteractions()
  const toolIcon = useToolIcon(data)

  useEffect(() => {
    if (nodeRef.current && data.selected && data.isInIteration) {
      const resizeObserver = new ResizeObserver(() => {
        handleNodeIterationChildSizeChange(id)
      })

      resizeObserver.observe(nodeRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }
  }, [
    data.isInIteration,
    data.selected,
    id,
    handleNodeIterationChildSizeChange,
  ])

  const showSelectedBorder =
    data.selected || data._isBundled || data._isEntering
  const { showRunningBorder, showSuccessBorder, showFailedBorder } =
    useMemo(() => {
      return {
        showRunningBorder:
          data._runningStatus === NodeRunningStatus.Running &&
          !showSelectedBorder,
        showSuccessBorder:
          data._runningStatus === NodeRunningStatus.Succeeded &&
          !showSelectedBorder,
        showFailedBorder:
          data._runningStatus === NodeRunningStatus.Failed &&
          !showSelectedBorder,
      }
    }, [data._runningStatus, showSelectedBorder])

  return (
    <div
      className={cn(
        "flex rounded-2xl border-[2px]",
        showSelectedBorder ? "border-primary-600" : "border-transparent",
      )}
      ref={nodeRef}
      style={{
        width: data.type === BlockEnum.Iteration ? data.width : "auto",
        height: data.type === BlockEnum.Iteration ? data.height : "auto",
      }}>
      <div
        className={cn(
          "shadow-xs group relative pb-1",
          "rounded-[15px] border border-transparent",
          data.type !== BlockEnum.Iteration && "w-[240px] bg-[#fcfdff]",
          data.type === BlockEnum.Iteration &&
            "flex h-full w-full flex-col bg-[#fcfdff]/80",
          !data._runningStatus && "hover:shadow-lg",
          showRunningBorder && "!border-primary-500",
          showSuccessBorder && "!border-[#12B76A]",
          showFailedBorder && "!border-[#F04438]",
          data._isBundled && "!shadow-lg",
        )}>
        {data._showAddVariablePopup && (
          <AddVariablePopupWithPosition nodeId={id} nodeData={data} />
        )}
        {data.type === BlockEnum.Iteration && (
          <NodeResizer nodeId={id} nodeData={data} />
        )}
        {!data._isCandidate && (
          <NodeTargetHandle
            id={id}
            data={data}
            handleClassName="!top-4 !-left-[9px] !translate-y-0"
            handleId="target"
          />
        )}
        {data.type !== BlockEnum.IfElse &&
          data.type !== BlockEnum.QuestionClassifier &&
          !data._isCandidate && (
            <NodeSourceHandle
              id={id}
              data={data}
              handleClassName="!top-4 !-right-[9px] !translate-y-0"
              handleId="source"
            />
          )}
        {!data._runningStatus && !nodesReadOnly && !data._isCandidate && (
          <NodeControl id={id} data={data} />
        )}
        <div
          className={cn(
            "flex items-center rounded-t-2xl px-3 pb-2 pt-3",
            data.type === BlockEnum.Iteration && "bg-[rgba(250,252,255,0.9)]",
          )}>
          <BlockIcon
            className="mr-2 shrink-0"
            type={data.type}
            size="md"
            toolIcon={toolIcon}
          />
          <div
            title={data.title}
            className="mr-1 grow truncate text-[13px] font-semibold text-gray-700">
            {data.title}
          </div>
          {data._iterationLength &&
            data._iterationIndex &&
            data._runningStatus === NodeRunningStatus.Running && (
              <div className="text-primary-600 mr-1.5 text-xs font-medium">
                {data._iterationIndex}/{data._iterationLength}
              </div>
            )}
          {(data._runningStatus === NodeRunningStatus.Running ||
            data._singleRunningStatus === NodeRunningStatus.Running) && (
            <RiLoader2Line className="text-primary-600 h-3.5 w-3.5 animate-spin" />
          )}
          {data._runningStatus === NodeRunningStatus.Succeeded && (
            <RiCheckboxCircleLine className="h-3.5 w-3.5 text-[#12B76A]" />
          )}
          {data._runningStatus === NodeRunningStatus.Failed && (
            <RiErrorWarningLine className="h-3.5 w-3.5 text-[#F04438]" />
          )}
        </div>
        {data.type !== BlockEnum.Iteration &&
          cloneElement(children, { id, data })}
        {data.type === BlockEnum.Iteration && (
          <div className="grow pb-1 pl-1 pr-1">
            {cloneElement(children, { id, data })}
          </div>
        )}
        {data.desc && data.type !== BlockEnum.Iteration && (
          <div className="whitespace-pre-line break-words px-3 pb-2 pt-1 text-xs leading-[18px] text-gray-500">
            {data.desc}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(BaseNode)
