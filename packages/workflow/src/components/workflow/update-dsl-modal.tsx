"use client"

import type { MouseEventHandler } from "react"
import { memo, useCallback, useRef, useState } from "react"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import { RiAlertLine, RiCloseLine } from "@remixicon/react"
import { WORKFLOW_DATA_UPDATE } from "./constants"
import { initialEdges, initialNodes } from "./utils"
import Uploader from "@/components/create-from-dsl-modal/uploader"
import Button from "@/components/base/button"
import Modal from "@/components/base/modal"
import { ToastContext } from "@/components/base/toast"
import { updateWorkflowDraftFromDSL } from "@/service/workflow"
import { useEventEmitterContextContext } from "@/context/event-emitter"
import { useStore as useAppStore } from "@/store"

type UpdateDSLModalProps = {
  onCancel: () => void
  onBackup: () => void
  onImport?: () => void
}

const UpdateDSLModal = ({
  onCancel,
  onBackup,
  onImport,
}: UpdateDSLModalProps) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const appDetail = useAppStore(s => s.appDetail)
  const [currentFile, setDSLFile] = useState<File>()
  const [fileContent, setFileContent] = useState<string>()
  const [loading, setLoading] = useState(false)
  const { eventEmitter } = useEventEmitterContextContext()

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = function (event) {
      const content = event.target?.result
      setFileContent(content as string)
    }
    reader.readAsText(file)
  }

  const handleFile = (file?: File) => {
    setDSLFile(file)
    if (file) readFile(file)
    if (!file) setFileContent("")
  }

  const isCreatingRef = useRef(false)
  const handleImport: MouseEventHandler = useCallback(async () => {
    if (isCreatingRef.current) return
    isCreatingRef.current = true
    if (!currentFile) return
    try {
      if (appDetail && fileContent) {
        setLoading(true)
        const { graph, features, hash } = await updateWorkflowDraftFromDSL(
          appDetail.id,
          fileContent,
        )
        const { nodes, edges, viewport } = graph
        eventEmitter?.emit({
          type: WORKFLOW_DATA_UPDATE,
          payload: {
            nodes: initialNodes(nodes, edges),
            edges: initialEdges(edges, nodes),
            viewport,
            features,
            hash,
          },
        } as any)
        if (onImport) onImport()
        notify({ type: "success", message: t("workflow.common.importSuccess") })
        setLoading(false)
        onCancel()
      }
    } catch (e) {
      setLoading(false)
      notify({ type: "error", message: t("workflow.common.importFailure") })
    }
    isCreatingRef.current = false
  }, [
    currentFile,
    fileContent,
    onCancel,
    notify,
    t,
    eventEmitter,
    appDetail,
    onImport,
  ])

  return (
    <Modal
      className="w-[520px] rounded-2xl p-6"
      isShow={true}
      onClose={() => {}}>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-2xl font-semibold text-[#101828]">
          {t("workflow.common.importDSL")}
        </div>
        <div
          className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center"
          onClick={onCancel}>
          <RiCloseLine className="h-5 w-5 text-gray-500" />
        </div>
      </div>
      <div className="mb-4 flex rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3">
        <RiAlertLine className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#F79009]" />
        <div>
          <div className="mb-2 text-sm font-medium text-[#354052]">
            {t("workflow.common.importDSLTip")}
          </div>
          <Button variant="secondary-accent" onClick={onBackup}>
            {t("workflow.common.backupCurrentDraft")}
          </Button>
        </div>
      </div>
      <div className="mb-8">
        <div className="mb-1 text-[13px] font-semibold text-[#354052]">
          {t("workflow.common.chooseDSL")}
        </div>
        <Uploader
          file={currentFile}
          updateFile={handleFile}
          className="!mt-0"
        />
      </div>
      <div className="flex justify-end">
        <Button className="mr-2" onClick={onCancel}>
          {t("app.newApp.Cancel")}
        </Button>
        <Button
          disabled={!currentFile || loading}
          variant="warning"
          onClick={handleImport}
          loading={loading}>
          {t("workflow.common.overwriteAndImport")}
        </Button>
      </div>
    </Modal>
  )
}

export default memo(UpdateDSLModal)
