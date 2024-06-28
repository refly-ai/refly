import { memo } from "react"
import cn from "classnames"
import { VarBlockIcon } from "@/components/workflow/block-icon"
import { Line3 } from "@/components/base/icons/src/public/common"
import { Variable02 } from "@/components/base/icons/src/vender/solid/development"
import type { Node } from "@/components/workflow/types"
import { BlockEnum } from "@/components/workflow/types"

type NodeVariableItemProps = {
  node: Node
  varName: string
  showBorder?: boolean
}
const NodeVariableItem = ({
  node,
  varName,
  showBorder,
}: NodeVariableItemProps) => {
  return (
    <div
      className={cn(
        "relative mt-0.5 flex h-6 items-center rounded-md bg-gray-100 px-1 text-xs font-normal text-gray-700",
        showBorder && "!bg-black/[0.02]",
      )}>
      <div className="flex items-center">
        <div className="p-[1px]">
          <VarBlockIcon
            className="!text-gray-900"
            type={node?.data.type || BlockEnum.Start}
          />
        </div>
        <div
          className="mx-0.5 max-w-[85px] truncate text-xs font-medium text-gray-700"
          title={node?.data.title}>
          {node?.data.title}
        </div>
        <Line3 className="mr-0.5"></Line3>
      </div>
      <div className="text-primary-600 flex items-center">
        <Variable02 className="h-3.5 w-3.5" />
        <div
          className="ml-0.5 max-w-[75px] truncate text-xs font-medium"
          title={varName}>
          {varName}
        </div>
      </div>
    </div>
  )
}

export default memo(NodeVariableItem)
