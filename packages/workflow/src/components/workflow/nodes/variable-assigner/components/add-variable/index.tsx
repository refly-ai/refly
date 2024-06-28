import { memo, useCallback, useState } from "react"
import cn from "classnames"
import { useVariableAssigner } from "../../hooks"
import type { VariableAssignerNodeType } from "../../types"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { Plus02 } from "@/components/base/icons/src/vender/line/general"
import AddVariablePopup from "@/components/workflow/nodes/_base/components/add-variable-popup"
import type {
  NodeOutPutVar,
  ValueSelector,
  Var,
} from "@/components/workflow/types"

export type AddVariableProps = {
  variableAssignerNodeId: string
  variableAssignerNodeData: VariableAssignerNodeType
  availableVars: NodeOutPutVar[]
  handleId?: string
}
const AddVariable = ({
  availableVars,
  variableAssignerNodeId,
  variableAssignerNodeData,
  handleId,
}: AddVariableProps) => {
  const [open, setOpen] = useState(false)
  const { handleAssignVariableValueChange } = useVariableAssigner()

  const handleSelectVariable = useCallback(
    (v: ValueSelector, varDetail: Var) => {
      handleAssignVariableValueChange(
        variableAssignerNodeId,
        v,
        varDetail,
        handleId,
      )
      setOpen(false)
    },
    [
      handleAssignVariableValueChange,
      variableAssignerNodeId,
      handleId,
      setOpen,
    ],
  )

  return (
    <div
      className={cn(
        open && "!flex",
        variableAssignerNodeData.selected && "!flex",
      )}>
      <PortalToFollowElem
        placement={"right"}
        offset={4}
        open={open}
        onOpenChange={setOpen}>
        <PortalToFollowElemTrigger onClick={() => setOpen(!open)}>
          <div
            className={cn(
              "group/addvariable flex items-center justify-center",
              "h-4 w-4 cursor-pointer",
              "hover:bg-primary-600 hover:rounded-full",
              open && "!bg-primary-600 !rounded-full",
            )}>
            <Plus02
              className={cn(
                "h-2.5 w-2.5 text-gray-500",
                "group-hover/addvariable:text-white",
                open && "!text-white",
              )}
            />
          </div>
        </PortalToFollowElemTrigger>
        <PortalToFollowElemContent className="z-[1000]">
          <AddVariablePopup
            onSelect={handleSelectVariable}
            availableVars={availableVars}
          />
        </PortalToFollowElemContent>
      </PortalToFollowElem>
    </div>
  )
}

export default memo(AddVariable)
