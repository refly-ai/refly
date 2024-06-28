import { useCallback } from "react"
import { useStoreApi } from "reactflow"
import { useWorkflowStore } from "../store"
import { BlockEnum, WorkflowRunningStatus } from "../types"
import {
  useIsChatMode,
  useNodesSyncDraft,
  useWorkflowInteractions,
  useWorkflowRun,
} from "./index"
import { useFeaturesStore } from "@/components/base/features/hooks"

export const useWorkflowStartRun = () => {
  const store = useStoreApi()
  const workflowStore = useWorkflowStore()
  const featuresStore = useFeaturesStore()
  const isChatMode = useIsChatMode()
  const { handleCancelDebugAndPreviewPanel } = useWorkflowInteractions()
  const { handleRun } = useWorkflowRun()
  const { doSyncWorkflowDraft } = useNodesSyncDraft()

  const handleWorkflowStartRunInWorkflow = useCallback(async () => {
    const { workflowRunningData } = workflowStore.getState()

    if (workflowRunningData?.result.status === WorkflowRunningStatus.Running)
      return

    const { getNodes } = store.getState()
    const nodes = getNodes()
    const startNode = nodes.find(node => node.data.type === BlockEnum.Start)
    const startVariables = startNode?.data.variables || []
    const fileSettings = featuresStore!.getState().features.file
    const {
      showDebugAndPreviewPanel,
      setShowDebugAndPreviewPanel,
      setShowInputsPanel,
    } = workflowStore.getState()

    if (showDebugAndPreviewPanel) {
      handleCancelDebugAndPreviewPanel()
      return
    }

    if (!startVariables.length && !fileSettings?.image?.enabled) {
      await doSyncWorkflowDraft()
      handleRun({ inputs: {}, files: [] })
      setShowDebugAndPreviewPanel(true)
      setShowInputsPanel(false)
    } else {
      setShowDebugAndPreviewPanel(true)
      setShowInputsPanel(true)
    }
  }, [
    store,
    workflowStore,
    featuresStore,
    handleCancelDebugAndPreviewPanel,
    handleRun,
    doSyncWorkflowDraft,
  ])

  const handleWorkflowStartRunInChatflow = useCallback(async () => {
    const {
      showDebugAndPreviewPanel,
      setShowDebugAndPreviewPanel,
      setHistoryWorkflowData,
    } = workflowStore.getState()

    if (showDebugAndPreviewPanel) handleCancelDebugAndPreviewPanel()
    else setShowDebugAndPreviewPanel(true)

    setHistoryWorkflowData(undefined)
  }, [workflowStore, handleCancelDebugAndPreviewPanel])

  const handleStartWorkflowRun = useCallback(() => {
    if (!isChatMode) handleWorkflowStartRunInWorkflow()
    else handleWorkflowStartRunInChatflow()
  }, [
    isChatMode,
    handleWorkflowStartRunInWorkflow,
    handleWorkflowStartRunInChatflow,
  ])

  return {
    handleStartWorkflowRun,
    handleWorkflowStartRunInWorkflow,
    handleWorkflowStartRunInChatflow,
  }
}
