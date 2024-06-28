import type { FC } from "react"
import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { RiArrowGoBackLine, RiArrowGoForwardFill } from "@remixicon/react"
import TipPopup from "../operator/tip-popup"
import { useWorkflowHistoryStore } from "../workflow-history-store"
import { useNodesReadOnly } from "@/components/workflow/hooks"
import ViewWorkflowHistory from "@/components/workflow/header/view-workflow-history"

export type UndoRedoProps = { handleUndo: () => void; handleRedo: () => void }
const UndoRedo: FC<UndoRedoProps> = ({ handleUndo, handleRedo }) => {
  const { t } = useTranslation()
  const { store } = useWorkflowHistoryStore()
  const [buttonsDisabled, setButtonsDisabled] = useState({
    undo: true,
    redo: true,
  })

  useEffect(() => {
    const unsubscribe = store.temporal.subscribe(state => {
      setButtonsDisabled({
        undo: state.pastStates.length === 0,
        redo: state.futureStates.length === 0,
      })
    })
    return () => unsubscribe()
  }, [store])

  const { nodesReadOnly } = useNodesReadOnly()

  return (
    <div className="flex items-center rounded-lg border-[0.5px] border-gray-100 bg-white p-0.5 text-gray-500 shadow-lg">
      <TipPopup title={t("workflow.common.undo")!}>
        <div
          data-tooltip-id="workflow.undo"
          className={`flex h-8 w-8 cursor-pointer select-none items-center rounded-md px-1.5 text-[13px] font-medium hover:bg-black/5 hover:text-gray-700 ${(nodesReadOnly || buttonsDisabled.undo) && "!cursor-not-allowed opacity-50 hover:bg-transparent"} `}
          onClick={() =>
            !nodesReadOnly && !buttonsDisabled.undo && handleUndo()
          }>
          <RiArrowGoBackLine className="h-4 w-4" />
        </div>
      </TipPopup>
      <TipPopup title={t("workflow.common.redo")!}>
        <div
          data-tooltip-id="workflow.redo"
          className={`flex h-8 w-8 cursor-pointer select-none items-center rounded-md px-1.5 text-[13px] font-medium hover:bg-black/5 hover:text-gray-700 ${(nodesReadOnly || buttonsDisabled.redo) && "!cursor-not-allowed opacity-50 hover:bg-transparent"} `}
          onClick={() =>
            !nodesReadOnly && !buttonsDisabled.redo && handleRedo()
          }>
          <RiArrowGoForwardFill className="h-4 w-4" />
        </div>
      </TipPopup>
      <div className="mx-[3px] h-3.5 w-[1px] bg-gray-200"></div>
      <ViewWorkflowHistory />
    </div>
  )
}

export default memo(UndoRedo)
