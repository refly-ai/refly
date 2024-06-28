import type { FC } from "react"
import React from "react"
import type { TemplateTransformNodeType } from "./types"
import type { NodeProps } from "@/components/workflow/types"

const Node: FC<NodeProps<TemplateTransformNodeType>> = () => {
  return (
    // No summary content
    <div></div>
  )
}

export default React.memo(Node)
