"use client"

import type { MouseEventHandler } from "react"
import cn from "classnames"
import { useState } from "react"
import { RiCloseLine } from "@remixicon/react"
import { BookOpenIcon } from "@heroicons/react/24/outline"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import Button from "@/components/base/button"
import Modal from "@/components/base/modal"
import { ToastContext } from "@/components/base/toast"
import type { DataSet } from "@/models/datasets"
import { updateDatasetSetting } from "@/service/datasets"

type RenameDatasetModalProps = {
  show: boolean
  dataset: DataSet
  onSuccess?: () => void
  onClose: () => void
}

const RenameDatasetModal = ({
  show,
  dataset,
  onSuccess,
  onClose,
}: RenameDatasetModalProps) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState<string>(dataset.name)
  const [description, setDescription] = useState<string>(dataset.description)

  const onConfirm: MouseEventHandler = async () => {
    if (!name.trim()) {
      notify({ type: "error", message: t("datasetSettings.form.nameError") })
      return
    }
    try {
      setLoading(true)
      await updateDatasetSetting({
        datasetId: dataset.id,
        body: {
          name,
          description,
        },
      })
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      if (onSuccess) onSuccess()
      onClose()
    } catch (e) {
      notify({
        type: "error",
        message: t("common.actionMsg.modifiedUnsuccessfully"),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      className="w-[520px] max-w-[520px] rounded-xl px-8 py-6"
      isShow={show}
      onClose={() => {}}>
      <div className="relative pb-2 text-xl font-medium leading-[30px] text-gray-900">
        {t("datasetSettings.title")}
      </div>
      <div
        className="absolute right-4 top-4 cursor-pointer p-2"
        onClick={onClose}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
      <div>
        <div className={cn("flex flex-wrap items-center justify-between py-4")}>
          <div className="shrink-0 py-2 text-sm font-medium leading-[20px] text-gray-900">
            {t("datasetSettings.form.name")}
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="block h-9 w-full appearance-none rounded-lg bg-gray-100 px-3 text-sm text-gray-900 outline-none"
            placeholder={t("datasetSettings.form.namePlaceholder") || ""}
          />
        </div>
        <div className={cn("flex flex-wrap items-center justify-between py-4")}>
          <div className="shrink-0 py-2 text-sm font-medium leading-[20px] text-gray-900">
            {t("datasetSettings.form.desc")}
          </div>
          <div className="w-full">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="block h-[88px] w-full resize-none appearance-none rounded-lg bg-gray-100 px-3 py-2 text-sm outline-none"
              placeholder={t("datasetSettings.form.descPlaceholder") || ""}
            />
            <a
              className="hover:text-primary-600 mt-2 flex h-[18px] items-center px-3 text-xs text-gray-500"
              href="https://docs.dify.ai/features/datasets#how-to-write-a-good-dataset-description"
              target="_blank"
              rel="noopener noreferrer">
              <BookOpenIcon className="mr-1 h-[18px] w-3" />
              {t("datasetSettings.form.descWrite")}
            </a>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-6">
        <Button className="mr-2" onClick={onClose}>
          {t("common.operation.cancel")}
        </Button>
        <Button disabled={loading} variant="primary" onClick={onConfirm}>
          {t("common.operation.save")}
        </Button>
      </div>
    </Modal>
  )
}

export default RenameDatasetModal
