import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RiAddLine } from "@remixicon/react"
import {
  useAvailableBlocks,
  useNodesInteractions,
  useNodesReadOnly,
} from "@/components/workflow/hooks"
import BlockSelector from "@/components/workflow/block-selector"
import type { CommonNodeType, OnSelectBlock } from "@/components/workflow/types"

type AddProps = {
  nodeId: string
  nodeData: CommonNodeType
  sourceHandle: string
  branchName?: string
}
const Add = ({ nodeId, nodeData, sourceHandle, branchName }: AddProps) => {
  const { t } = useTranslation()
  const { handleNodeAdd } = useNodesInteractions()
  const { nodesReadOnly } = useNodesReadOnly()
  const { availableNextBlocks } = useAvailableBlocks(
    nodeData.type,
    nodeData.isInIteration,
  )

  const handleSelect = useCallback<OnSelectBlock>(
    (type, toolDefaultValue) => {
      handleNodeAdd(
        {
          nodeType: type,
          toolDefaultValue,
        },
        {
          prevNodeId: nodeId,
          prevNodeSourceHandle: sourceHandle,
        },
      )
    },
    [nodeId, sourceHandle, handleNodeAdd],
  )

  const renderTrigger = useCallback(
    (open: boolean) => {
      return (
        <div
          className={`relative flex h-9 cursor-pointer items-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2 text-xs text-gray-500 hover:bg-gray-100 ${open && "!bg-gray-100"} ${nodesReadOnly && "!cursor-not-allowed"} `}>
          {branchName && (
            <div
              className="absolute -top-[7.5px] left-1 right-1 flex h-3 items-center text-[10px] font-semibold text-gray-500"
              title={branchName.toLocaleUpperCase()}>
              <div className="inline-block truncate rounded-[5px] bg-white px-0.5">
                {branchName.toLocaleUpperCase()}
              </div>
            </div>
          )}
          <div className="mr-1.5 flex h-5 w-5 items-center justify-center rounded-[5px] bg-gray-200">
            <RiAddLine className="h-3 w-3" />
          </div>
          {t("workflow.panel.selectNextStep")}
        </div>
      )
    },
    [branchName, t, nodesReadOnly],
  )

  return (
    <BlockSelector
      disabled={nodesReadOnly}
      onSelect={handleSelect}
      placement="top"
      offset={0}
      trigger={renderTrigger}
      popupClassName="!w-[328px]"
      availableBlocksTypes={availableNextBlocks}
    />
  )
}

export default memo(Add)
