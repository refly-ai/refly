import type { FC } from "react"
import { memo, useEffect } from "react"
import { Background, useNodesInitialized, useViewport } from "reactflow"
import cn from "classnames"
import { useNodeIterationInteractions } from "./use-interactions"
import type { IterationNodeType } from "./types"
import AddBlock from "./add-block"
import type { NodeProps } from "@/components/workflow/types"

const Node: FC<NodeProps<IterationNodeType>> = ({ id, data }) => {
  const { zoom } = useViewport()
  const nodesInitialized = useNodesInitialized()
  const { handleNodeIterationRerender } = useNodeIterationInteractions()

  useEffect(() => {
    if (nodesInitialized) handleNodeIterationRerender(id)
  }, [nodesInitialized, id, handleNodeIterationRerender])

  return (
    <div
      className={cn(
        "relative h-full min-h-[118px] w-full min-w-[258px] rounded-2xl bg-[#F0F2F7]/90",
      )}>
      <Background
        id={`iteration-background-${id}`}
        className="!z-0 rounded-2xl"
        gap={[14 / zoom, 14 / zoom]}
        size={2 / zoom}
        color="#E4E5E7"
      />
      <AddBlock iterationNodeId={id} iterationNodeData={data} />
    </div>
  )
}

export default memo(Node)
