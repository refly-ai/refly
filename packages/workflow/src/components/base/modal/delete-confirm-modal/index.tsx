"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { RiErrorWarningFill } from "@remixicon/react"
import s from "./style.module.css"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"

type Props = {
  isShow: boolean
  onHide: () => void
  onRemove: () => void
  text?: string
  children?: JSX.Element
}

const DeleteConfirmModal: FC<Props> = ({
  isShow,
  onHide,
  onRemove,
  children,
  text,
}) => {
  const { t } = useTranslation()
  if (!isShow) return null

  return (
    <Modal isShow={isShow} onClose={onHide} className={s.delModal} closable>
      <div
        onClick={e => {
          e.stopPropagation()
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation()
        }}>
        <div className={s.warningWrapper}>
          <RiErrorWarningFill className="h-6 w-6 text-red-600" />
        </div>
        {text ? (
          <div className="mb-3 text-xl font-semibold text-gray-900">{text}</div>
        ) : (
          children
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onHide}>{t("common.operation.cancel")}</Button>
          <Button
            variant="warning"
            onClick={onRemove}
            className="border-red-700">
            {t("common.operation.sure")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
export default React.memo(DeleteConfirmModal)
