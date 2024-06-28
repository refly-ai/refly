"use client"

import type { MouseEventHandler } from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import { RiCloseLine } from "@remixicon/react"
import Uploader from "./uploader"
import Button from "@/components/base/button"
import Modal from "@/components/base/modal"
import { ToastContext } from "@/components/base/toast"
import { importApp } from "@/service/apps"
import { useAppContext } from "@/context/app-context"
import { useProviderContext } from "@/context/provider-context"
import AppsFull from "@/components/billing/apps-full-in-dialog"
import { NEED_REFRESH_APP_LIST_KEY } from "@/config"
import { getRedirection } from "@/utils/app-redirection"

type CreateFromDSLModalProps = {
  show: boolean
  onSuccess?: () => void
  onClose: () => void
}

const CreateFromDSLModal = ({
  show,
  onSuccess,
  onClose,
}: CreateFromDSLModalProps) => {
  const { push } = useRouter()
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const [currentFile, setDSLFile] = useState<File>()
  const [fileContent, setFileContent] = useState<string>()

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

  const { isCurrentWorkspaceEditor } = useAppContext()
  const { plan, enableBilling } = useProviderContext()
  const isAppsFull =
    enableBilling && plan.usage.buildApps >= plan.total.buildApps

  const isCreatingRef = useRef(false)
  const onCreate: MouseEventHandler = async () => {
    if (isCreatingRef.current) return
    isCreatingRef.current = true
    if (!currentFile) return
    try {
      const app = await importApp({
        data: fileContent || "",
      })
      if (onSuccess) onSuccess()
      if (onClose) onClose()
      notify({ type: "success", message: t("app.newApp.appCreated") })
      localStorage.setItem(NEED_REFRESH_APP_LIST_KEY, "1")
      getRedirection(isCurrentWorkspaceEditor, app, push)
    } catch (e) {
      notify({ type: "error", message: t("app.newApp.appCreateFailed") })
    }
    isCreatingRef.current = false
  }

  return (
    <Modal
      className="w-[520px] max-w-[520px] rounded-xl px-8 py-6"
      isShow={show}
      onClose={() => {}}>
      <div className="relative pb-2 text-xl font-medium leading-[30px] text-gray-900">
        {t("app.createFromConfigFile")}
      </div>
      <div
        className="absolute right-4 top-4 cursor-pointer p-2"
        onClick={onClose}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
      <Uploader file={currentFile} updateFile={handleFile} />
      {isAppsFull && <AppsFull loc="app-create-dsl" />}
      <div className="flex justify-end pt-6">
        <Button className="mr-2" onClick={onClose}>
          {t("app.newApp.Cancel")}
        </Button>
        <Button
          disabled={isAppsFull || !currentFile}
          variant="primary"
          onClick={onCreate}>
          {t("app.newApp.Create")}
        </Button>
      </div>
    </Modal>
  )
}

export default CreateFromDSLModal
