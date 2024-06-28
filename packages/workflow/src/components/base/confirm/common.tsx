import type { FC, ReactElement } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine, RiErrorWarningFill } from "@remixicon/react"
import s from "./common.module.css"
import Modal from "@/components/base/modal"
import { CheckCircle } from "@/components/base/icons/src/vender/solid/general"
import Button from "@/components/base/button"

export type ConfirmCommonProps = {
  type?: string
  isShow: boolean
  onCancel: () => void
  title: string
  desc?: string
  onConfirm?: () => void
  showOperate?: boolean
  showOperateCancel?: boolean
  confirmBtnClassName?: string
  confirmText?: string
  confirmWrapperClassName?: string
  confirmDisabled?: boolean
}

const ConfirmCommon: FC<ConfirmCommonProps> = ({
  type = "danger",
  isShow,
  onCancel,
  title,
  desc,
  onConfirm,
  showOperate = true,
  showOperateCancel = true,
  confirmBtnClassName,
  confirmText,
  confirmWrapperClassName,
  confirmDisabled,
}) => {
  const { t } = useTranslation()

  const CONFIRM_MAP: Record<
    string,
    { icon: ReactElement; confirmText: string }
  > = {
    danger: {
      icon: <RiErrorWarningFill className="h-6 w-6 text-[#D92D20]" />,
      confirmText: t("common.operation.remove"),
    },
    success: {
      icon: <CheckCircle className="h-6 w-6 text-[#039855]" />,
      confirmText: t("common.operation.ok"),
    },
  }

  return (
    <Modal
      isShow={isShow}
      onClose={() => {}}
      className="!w-[480px] !max-w-[480px] !rounded-2xl !p-0"
      wrapperClassName={confirmWrapperClassName}>
      <div className={cn(s[`wrapper-${type}`], "relative p-8")}>
        <div
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center"
          onClick={onCancel}>
          <RiCloseLine className="h-4 w-4 text-gray-500" />
        </div>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xl">
          {CONFIRM_MAP[type].icon}
        </div>
        <div className="text-xl font-semibold text-gray-900">{title}</div>
        {desc && <div className="mt-1 text-sm text-gray-500">{desc}</div>}
        {showOperate && (
          <div className="mt-10 flex items-center justify-end">
            {showOperateCancel && (
              <Button className="mr-2" onClick={onCancel}>
                {t("common.operation.cancel")}
              </Button>
            )}
            <Button
              variant="primary"
              className={confirmBtnClassName || ""}
              onClick={onConfirm}
              disabled={confirmDisabled}>
              {confirmText || CONFIRM_MAP[type].confirmText}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ConfirmCommon
