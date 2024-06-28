import type { FC } from "react"
import { memo } from "react"
import { useNodes } from "reactflow"
import cn from "classnames"
import { useShallow } from "zustand/react/shallow"
import type { CommonNodeType } from "../types"
import { Panel as NodePanel } from "../nodes"
import { useStore } from "../store"
import { useIsChatMode, useWorkflow } from "../hooks"
import DebugAndPreview from "./debug-and-preview"
import Record from "./record"
import WorkflowPreview from "./workflow-preview"
import ChatRecord from "./chat-record"
import { useStore as useAppStore } from "@/store"
import MessageLogModal from "@/components/base/message-log-modal"

const Panel: FC = () => {
  const nodes = useNodes<CommonNodeType>()
  const isChatMode = useIsChatMode()
  const selectedNode = nodes.find(node => node.data.selected)
  const historyWorkflowData = useStore(s => s.historyWorkflowData)
  const showDebugAndPreviewPanel = useStore(s => s.showDebugAndPreviewPanel)
  const isRestoring = useStore(s => s.isRestoring)
  const { enableShortcuts, disableShortcuts } = useWorkflow()
  const {
    currentLogItem,
    setCurrentLogItem,
    showMessageLogModal,
    setShowMessageLogModal,
    currentLogModalActiveTab,
  } = useAppStore(
    useShallow(state => ({
      currentLogItem: state.currentLogItem,
      setCurrentLogItem: state.setCurrentLogItem,
      showMessageLogModal: state.showMessageLogModal,
      setShowMessageLogModal: state.setShowMessageLogModal,
      currentLogModalActiveTab: state.currentLogModalActiveTab,
    })),
  )

  return (
    <div
      tabIndex={-1}
      className={cn("absolute bottom-2 right-0 top-14 z-10 flex outline-none")}
      onFocus={disableShortcuts}
      onBlur={enableShortcuts}
      key={`${isRestoring}`}>
      {showMessageLogModal && (
        <MessageLogModal
          fixedWidth
          width={400}
          currentLogItem={currentLogItem}
          onCancel={() => {
            setCurrentLogItem()
            setShowMessageLogModal(false)
          }}
          defaultTab={currentLogModalActiveTab}
        />
      )}
      {!!selectedNode && <NodePanel {...selectedNode!} />}
      {historyWorkflowData && !isChatMode && <Record />}
      {historyWorkflowData && isChatMode && <ChatRecord />}
      {showDebugAndPreviewPanel && isChatMode && <DebugAndPreview />}
      {showDebugAndPreviewPanel && !isChatMode && <WorkflowPreview />}
    </div>
  )
}

export default memo(Panel)
