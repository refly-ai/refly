import type { FC } from "react"
import React from "react"
import type { EndNodeType } from "./types"
import type { NodeProps, Variable } from "@/components/workflow/types"
import {
  getVarType,
  isSystemVar,
} from "@/components/workflow/nodes/_base/components/variable/utils"
import { useIsChatMode, useWorkflow } from "@/components/workflow/hooks"
import { VarBlockIcon } from "@/components/workflow/block-icon"
import { Line3 } from "@/components/base/icons/src/public/common"
import { Variable02 } from "@/components/base/icons/src/vender/solid/development"
import { BlockEnum } from "@/components/workflow/types"

const Node: FC<NodeProps<EndNodeType>> = ({ id, data }) => {
  const { getBeforeNodesInSameBranch } = useWorkflow()
  const availableNodes = getBeforeNodesInSameBranch(id)
  const isChatMode = useIsChatMode()

  const startNode = availableNodes.find((node: any) => {
    return node.data.type === BlockEnum.Start
  })

  const getNode = (id: string) => {
    return availableNodes.find(node => node.id === id) || startNode
  }

  const { outputs } = data
  const filteredOutputs = (outputs as Variable[]).filter(
    ({ value_selector }) => value_selector.length > 0,
  )

  if (!filteredOutputs.length) return null

  return (
    <div className="mb-1 space-y-0.5 px-3 py-1">
      {filteredOutputs.map(({ value_selector }, index) => {
        const node = getNode(value_selector[0])
        const isSystem = isSystemVar(value_selector)
        const varName = isSystem
          ? `sys.${value_selector[value_selector.length - 1]}`
          : value_selector[value_selector.length - 1]
        const varType = getVarType({
          valueSelector: value_selector,
          availableNodes,
          isChatMode,
        })
        return (
          <div
            key={index}
            className="flex h-6 items-center justify-between space-x-1 rounded-md bg-gray-100 px-1 text-xs font-normal text-gray-700">
            <div className="flex items-center text-xs font-medium text-gray-500">
              <div className="p-[1px]">
                <VarBlockIcon
                  className="!text-gray-900"
                  type={node?.data.type || BlockEnum.Start}
                />
              </div>
              <div className="max-w-[75px] truncate">{node?.data.title}</div>
              <Line3 className="mr-0.5"></Line3>
              <div className="text-primary-600 flex items-center">
                <Variable02 className="h-3.5 w-3.5" />
                <div className="ml-0.5 max-w-[50px] truncate text-xs font-medium">
                  {varName}
                </div>
              </div>
            </div>
            <div className="text-xs font-normal text-gray-700">
              <div
                className="ml-0.5 max-w-[42px] truncate text-xs font-normal capitalize text-gray-500"
                title={varType}>
                {varType}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(Node)
