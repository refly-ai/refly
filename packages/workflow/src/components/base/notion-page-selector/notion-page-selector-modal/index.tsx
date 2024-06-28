import { useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { XMarkIcon } from "@heroicons/react/24/outline"
import NotionPageSelector from "../base"
import type { NotionPageSelectorValue } from "../base"
import s from "./index.module.css"
import Modal from "@/components/base/modal"

type NotionPageSelectorModalProps = {
  isShow: boolean
  onClose: () => void
  onSave: (selectedPages: NotionPageSelectorValue[]) => void
  datasetId: string
}
const NotionPageSelectorModal = ({
  isShow,
  onClose,
  onSave,
  datasetId,
}: NotionPageSelectorModalProps) => {
  const { t } = useTranslation()
  const [selectedPages, setSelectedPages] = useState<NotionPageSelectorValue[]>(
    [],
  )

  const handleClose = () => {
    onClose()
  }
  const handleSelectPage = (newSelectedPages: NotionPageSelectorValue[]) => {
    setSelectedPages(newSelectedPages)
  }
  const handleSave = () => {
    onSave(selectedPages)
  }

  return (
    <Modal className={s.modal} isShow={isShow} onClose={() => {}}>
      <div className="mb-6 flex h-8 items-center justify-between">
        <div className="text-xl font-semibold text-gray-900">
          {t("common.dataSource.notion.selector.addPages")}
        </div>
        <div
          className="-mr-2 flex h-8 w-8 cursor-pointer items-center justify-center"
          onClick={handleClose}>
          <XMarkIcon className="h-4 w-4" />
        </div>
      </div>
      <NotionPageSelector
        onSelect={handleSelectPage}
        canPreview={false}
        datasetId={datasetId}
      />
      <div className="mt-8 flex justify-end">
        <div className={s.operate} onClick={handleClose}>
          {t("common.operation.cancel")}
        </div>
        <div className={cn(s.operate, s["operate-save"])} onClick={handleSave}>
          {t("common.operation.save")}
        </div>
      </div>
    </Modal>
  )
}

export default NotionPageSelectorModal
