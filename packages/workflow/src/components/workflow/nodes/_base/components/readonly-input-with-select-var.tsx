"use client"
import type { FC } from "react"
import React from "react"
import { useWorkflow } from "../../../hooks"
import { BlockEnum } from "../../../types"
import { VarBlockIcon } from "../../../block-icon"
import { getNodeInfoById, isSystemVar } from "./variable/utils"
import { Line3 } from "@/components/base/icons/src/public/common"
import { Variable02 } from "@/components/base/icons/src/vender/solid/development"
type Props = {
  nodeId: string
  value: string
}

const VAR_PLACEHOLDER = "@#!@#!"

const ReadonlyInputWithSelectVar: FC<Props> = ({ nodeId, value }) => {
  const { getBeforeNodesInSameBranchIncludeParent } = useWorkflow()
  const availableNodes = getBeforeNodesInSameBranchIncludeParent(nodeId)
  const startNode = availableNodes.find((node: any) => {
    return node.data.type === BlockEnum.Start
  })

  const res = (() => {
    const vars: string[] = []
    const strWithVarPlaceholder = value.replaceAll(
      /{{#([^#]*)#}}/g,
      (_match, p1) => {
        vars.push(p1)
        return VAR_PLACEHOLDER
      },
    )

    const html: JSX.Element[] = strWithVarPlaceholder
      .split(VAR_PLACEHOLDER)
      .map((str, index) => {
        if (!vars[index])
          return (
            <span className="relative top-[-3px] leading-[16px]" key={index}>
              {str}
            </span>
          )

        const value = vars[index].split(".")
        const isSystem = isSystemVar(value)
        const node = (
          isSystem ? startNode : getNodeInfoById(availableNodes, value[0])
        )?.data
        const varName = `${isSystem ? "sys." : ""}${value[value.length - 1]}`

        return (
          <span key={index}>
            <span className="relative top-[-3px] leading-[16px]">{str}</span>
            <div className="inline-flex h-[16px] items-center rounded-[5px] bg-white px-1.5">
              <div className="flex items-center">
                <div className="p-[1px]">
                  <VarBlockIcon
                    className="!text-gray-900"
                    type={node?.type || BlockEnum.Start}
                  />
                </div>
                <div
                  className="mx-0.5 max-w-[60px] truncate text-xs font-medium text-gray-700"
                  title={node?.title}>
                  {node?.title}
                </div>
                <Line3 className="mr-0.5"></Line3>
              </div>
              <div className="text-primary-600 flex items-center">
                <Variable02 className="h-3.5 w-3.5" />
                <div
                  className="ml-0.5 max-w-[50px] truncate text-xs font-medium"
                  title={varName}>
                  {varName}
                </div>
              </div>
            </div>
          </span>
        )
      })
    return html
  })()

  return <div className="break-all text-xs">{res}</div>
}
export default React.memo(ReadonlyInputWithSelectVar)
