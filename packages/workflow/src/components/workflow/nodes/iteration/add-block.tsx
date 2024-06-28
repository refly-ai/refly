import { memo, useCallback } from "react"
import produce from "immer"
import cn from "classnames"
import { RiAddLine } from "@remixicon/react"
import { useStoreApi } from "reactflow"
import { useTranslation } from "react-i18next"
import { generateNewNode } from "../../utils"
import {
  WorkflowHistoryEvent,
  useAvailableBlocks,
  useNodesReadOnly,
  useWorkflowHistory,
} from "../../hooks"
import { NODES_INITIAL_DATA } from "../../constants"
import InsertBlock from "./insert-block"
import type { IterationNodeType } from "./types"
import BlockSelector from "@/components/workflow/block-selector"
import { IterationStart } from "@/components/base/icons/src/vender/workflow"
import type { OnSelectBlock } from "@/components/workflow/types"
import { BlockEnum } from "@/components/workflow/types"
import TooltipPlus from "@/components/base/tooltip-plus"

type AddBlockProps = {
  iterationNodeId: string
  iterationNodeData: IterationNodeType
}
const AddBlock = ({ iterationNodeId, iterationNodeData }: AddBlockProps) => {
  const { t } = useTranslation()
  const store = useStoreApi()
  const { nodesReadOnly } = useNodesReadOnly()
  const { availableNextBlocks } = useAvailableBlocks(BlockEnum.Start, true)
  const { availablePrevBlocks } = useAvailableBlocks(
    iterationNodeData.startNodeType,
    true,
  )
  const { saveStateToHistory } = useWorkflowHistory()

  const handleSelect = useCallback<OnSelectBlock>(
    (type, toolDefaultValue) => {
      const { getNodes, setNodes } = store.getState()
      const nodes = getNodes()
      const nodesWithSameType = nodes.filter(node => node.data.type === type)
      const newNode = generateNewNode({
        data: {
          ...NODES_INITIAL_DATA[type],
          title:
            nodesWithSameType.length > 0
              ? `${t(`workflow.blocks.${type}`)} ${nodesWithSameType.length + 1}`
              : t(`workflow.blocks.${type}`),
          ...(toolDefaultValue || {}),
          isIterationStart: true,
          isInIteration: true,
          iteration_id: iterationNodeId,
        },
        position: {
          x: 117,
          y: 85,
        },
        zIndex: 1001,
        parentId: iterationNodeId,
        extent: "parent",
      })
      const newNodes = produce(nodes, draft => {
        draft.forEach(node => {
          if (node.id === iterationNodeId) {
            node.data._children = [newNode.id]
            node.data.start_node_id = newNode.id
            node.data.startNodeType = newNode.data.type
          }
        })
        draft.push(newNode)
      })
      setNodes(newNodes)
      saveStateToHistory(WorkflowHistoryEvent.NodeAdd)
    },
    [store, t, iterationNodeId, saveStateToHistory],
  )

  const renderTriggerElement = useCallback(
    (open: boolean) => {
      return (
        <div
          className={cn(
            "shadow-xs relative inline-flex h-8 cursor-pointer items-center rounded-lg border-[0.5px] border-gray-50 bg-white px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-200",
            `${nodesReadOnly && "!cursor-not-allowed opacity-50"}`,
            open && "!bg-gray-50",
          )}>
          <RiAddLine className="mr-1 h-4 w-4" />
          {t("workflow.common.addBlock")}
        </div>
      )
    },
    [nodesReadOnly, t],
  )

  return (
    <div className="absolute left-6 top-12 z-10 flex h-8 items-center">
      <TooltipPlus popupContent={t("workflow.blocks.iteration-start")}>
        <div className="bg-primary-500 flex h-6 w-6 items-center justify-center rounded-full border-[0.5px] border-black/[0.02] shadow-md">
          <IterationStart className="h-4 w-4 text-white" />
        </div>
      </TooltipPlus>
      <div className="group/insert relative h-0.5 w-16 bg-gray-300">
        {iterationNodeData.startNodeType && (
          <InsertBlock
            startNodeId={iterationNodeData.start_node_id}
            availableBlocksTypes={availablePrevBlocks}
          />
        )}
        <div className="bg-primary-500 absolute right-0 top-1/2 h-2 w-0.5 -translate-y-1/2"></div>
      </div>
      {!iterationNodeData.startNodeType && (
        <BlockSelector
          disabled={nodesReadOnly}
          onSelect={handleSelect}
          trigger={renderTriggerElement}
          triggerInnerClassName="inline-flex"
          popupClassName="!min-w-[256px]"
          availableBlocksTypes={availableNextBlocks}
        />
      )}
    </div>
  )
}

export default memo(AddBlock)
