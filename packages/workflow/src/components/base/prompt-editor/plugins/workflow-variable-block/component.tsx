import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { COMMAND_PRIORITY_EDITOR } from "lexical"
import { mergeRegister } from "@lexical/utils"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import cn from "classnames"
import { RiErrorWarningFill } from "@remixicon/react"
import { useSelectOrDelete } from "../../hooks"
import type { WorkflowNodesMap } from "./node"
import { WorkflowVariableBlockNode } from "./node"
import {
  DELETE_WORKFLOW_VARIABLE_BLOCK_COMMAND,
  UPDATE_WORKFLOW_NODES_MAP,
} from "./index"
import { Variable02 } from "@/components/base/icons/src/vender/solid/development"
import { VarBlockIcon } from "@/components/workflow/block-icon"
import { Line3 } from "@/components/base/icons/src/public/common"
import { isSystemVar } from "@/components/workflow/nodes/_base/components/variable/utils"
import TooltipPlus from "@/components/base/tooltip-plus"

type WorkflowVariableBlockComponentProps = {
  nodeKey: string
  variables: string[]
  workflowNodesMap: WorkflowNodesMap
}

const WorkflowVariableBlockComponent = ({
  nodeKey,
  variables,
  workflowNodesMap = {},
}: WorkflowVariableBlockComponentProps) => {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const [ref, isSelected] = useSelectOrDelete(
    nodeKey,
    DELETE_WORKFLOW_VARIABLE_BLOCK_COMMAND,
  )
  const variablesLength = variables.length
  const varName = (() => {
    const isSystem = isSystemVar(variables)
    const varName =
      variablesLength >= 3
        ? variables.slice(-2).join(".")
        : variables[variablesLength - 1]
    return `${isSystem ? "sys." : ""}${varName}`
  })()
  const [localWorkflowNodesMap, setLocalWorkflowNodesMap] =
    useState<WorkflowNodesMap>(workflowNodesMap)
  const node = localWorkflowNodesMap![variables[0]]

  useEffect(() => {
    if (!editor.hasNodes([WorkflowVariableBlockNode]))
      throw new Error(
        "WorkflowVariableBlockPlugin: WorkflowVariableBlock not registered on editor",
      )

    return mergeRegister(
      editor.registerCommand(
        UPDATE_WORKFLOW_NODES_MAP,
        (workflowNodesMap: WorkflowNodesMap) => {
          setLocalWorkflowNodesMap(workflowNodesMap)

          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    )
  }, [editor])

  const Item = (
    <div
      className={cn(
        "group/wrap relative mx-0.5 flex h-[18px] select-none items-center rounded-[5px] border pl-0.5 pr-[3px]",
        isSelected
          ? "border-[#84ADFF] bg-[#F5F8FF]"
          : "border-black/5 bg-white",
        !node && "!border-[#F04438] !bg-[#FEF3F2]",
      )}
      ref={ref}>
      <div className="flex items-center">
        {node?.type && (
          <div className="p-[1px]">
            <VarBlockIcon className="!text-gray-500" type={node?.type} />
          </div>
        )}
        <div
          className="mx-0.5 shrink-0 truncate text-xs font-medium text-gray-500"
          title={node?.title}
          style={{}}>
          {node?.title}
        </div>
        <Line3 className="mr-0.5 text-gray-300"></Line3>
      </div>
      <div className="text-primary-600 flex items-center">
        <Variable02 className="h-3.5 w-3.5" />
        <div
          className="ml-0.5 shrink-0 truncate text-xs font-medium"
          title={varName}>
          {varName}
        </div>
        {!node && (
          <RiErrorWarningFill className="ml-0.5 h-3 w-3 text-[#D92D20]" />
        )}
      </div>
    </div>
  )

  if (!node) {
    return (
      <TooltipPlus popupContent={t("workflow.errorMsg.invalidVariable")}>
        {Item}
      </TooltipPlus>
    )
  }

  return Item
}

export default memo(WorkflowVariableBlockComponent)
