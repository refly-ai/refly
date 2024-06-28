"use client"

import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import s from "./style.module.css"
import Button from "@/components/base/button"
import Modal from "@/components/base/modal"
import { AlertTriangle } from "@/components/base/icons/src/vender/solid/alertsAndFeedback"

type ConfirmModalProps = {
  show: boolean
  onConfirm?: () => void
  onClose: () => void
}

const ConfirmModal = ({ show, onConfirm, onClose }: ConfirmModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      className={cn("w-[600px] max-w-[600px] p-8", s.bg)}
      isShow={show}
      onClose={() => {}}>
      <div
        className="absolute right-4 top-4 cursor-pointer p-2"
        onClick={onClose}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </div>
      <div className="h-12 w-12 rounded-xl border-[0.5px] border-gray-100 bg-white p-3 shadow-xl">
        <AlertTriangle className="h-6 w-6 text-[rgb(247,144,9)]" />
      </div>
      <div className="relative mt-3 text-xl font-semibold leading-[30px] text-gray-900">
        {t("tools.createTool.confirmTitle")}
      </div>
      <div className="my-1 text-sm leading-5 text-gray-500">
        {t("tools.createTool.confirmTip")}
      </div>
      <div className="flex items-center justify-end pt-6">
        <div className="flex items-center">
          <Button className="mr-2" onClick={onClose}>
            {t("common.operation.cancel")}
          </Button>
          <Button
            className="border-red-700"
            variant="warning"
            onClick={onConfirm}>
            {t("common.operation.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmModal
