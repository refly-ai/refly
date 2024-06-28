import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { intersection } from "lodash-es"
import type { CommonNodeType, OnSelectBlock } from "@/components/workflow/types"
import BlockIcon from "@/components/workflow/block-icon"
import BlockSelector from "@/components/workflow/block-selector"
import {
  useAvailableBlocks,
  useNodesInteractions,
  useNodesReadOnly,
  useToolIcon,
} from "@/components/workflow/hooks"
import Button from "@/components/base/button"

type ItemProps = {
  nodeId: string
  sourceHandle: string
  branchName?: string
  data: CommonNodeType
}
const Item = ({ nodeId, sourceHandle, branchName, data }: ItemProps) => {
  const { t } = useTranslation()
  const { handleNodeChange } = useNodesInteractions()
  const { nodesReadOnly } = useNodesReadOnly()
  const toolIcon = useToolIcon(data)
  const { availablePrevBlocks, availableNextBlocks } = useAvailableBlocks(
    data.type,
    data.isInIteration,
  )

  const handleSelect = useCallback<OnSelectBlock>(
    (type, toolDefaultValue) => {
      handleNodeChange(nodeId, type, sourceHandle, toolDefaultValue)
    },
    [nodeId, sourceHandle, handleNodeChange],
  )
  const renderTrigger = useCallback(
    (open: boolean) => {
      return (
        <Button
          size="small"
          className={`hidden group-hover:flex ${open && "!flex !bg-gray-100"} `}>
          {t("workflow.panel.change")}
        </Button>
      )
    },
    [t],
  )

  return (
    <div className="shadow-xs group relative mb-3 flex h-9 cursor-pointer items-center rounded-lg border-[0.5px] border-gray-200 bg-white px-2 text-xs text-gray-700 last-of-type:mb-0 hover:bg-gray-50">
      {branchName && (
        <div
          className="absolute -top-[7.5px] left-1 right-1 flex h-3 items-center text-[10px] font-semibold text-gray-500"
          title={branchName.toLocaleUpperCase()}>
          <div className="inline-block truncate rounded-[5px] bg-white px-0.5">
            {branchName.toLocaleUpperCase()}
          </div>
        </div>
      )}
      <BlockIcon
        type={data.type}
        toolIcon={toolIcon}
        className="mr-1.5 shrink-0"
      />
      <div className="grow">{data.title}</div>
      {!nodesReadOnly && (
        <BlockSelector
          onSelect={handleSelect}
          placement="top-end"
          offset={{
            mainAxis: 6,
            crossAxis: 8,
          }}
          trigger={renderTrigger}
          popupClassName="!w-[328px]"
          availableBlocksTypes={intersection(
            availablePrevBlocks,
            availableNextBlocks,
          ).filter(item => item !== data.type)}
        />
      )}
    </div>
  )
}

export default memo(Item)
