import type { FC } from "react"
import React from "react"
import type { ToolNodeType } from "./types"
import type { NodeProps } from "@/components/workflow/types"

const Node: FC<NodeProps<ToolNodeType>> = ({ data }) => {
  const { tool_configurations } = data
  const toolConfigs = Object.keys(tool_configurations || {})

  if (!toolConfigs.length) return null

  return (
    <div className="mb-1 px-3 py-1">
      <div className="space-y-0.5">
        {toolConfigs.map((key, index) => (
          <div
            key={index}
            className="flex h-6 items-center justify-between space-x-1 rounded-md bg-gray-100 px-1 text-xs font-normal text-gray-700">
            <div
              title={key}
              className="max-w-[100px] shrink-0 truncate text-xs font-medium uppercase text-gray-500">
              {key}
            </div>
            <div
              title={tool_configurations[key]}
              className="w-0 shrink-0 grow truncate text-right text-xs font-normal text-gray-700">
              {tool_configurations[key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default React.memo(Node)
