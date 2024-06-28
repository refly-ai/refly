"use client"
import type { FC } from "react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import Textarea from "rc-textarea"
import cn from "classnames"
import { RiDeleteBinLine } from "@remixicon/react"
import { Robot, User } from "@/components/base/icons/src/public/avatar"
import { Edit04 } from "@/components/base/icons/src/vender/line/general"
import { Edit04 as EditSolid } from "@/components/base/icons/src/vender/solid/general"
import Button from "@/components/base/button"

export enum EditItemType {
  Query = "query",
  Answer = "answer",
}
type Props = {
  type: EditItemType
  content: string
  readonly?: boolean
  onSave: (content: string) => void
}

export const EditTitle: FC<{ className?: string; title: string }> = ({
  className,
  title,
}) => (
  <div
    className={cn(
      className,
      "height-[18px] flex items-center text-xs font-medium text-gray-500",
    )}>
    <EditSolid className="mr-1 h-3.5 w-3.5" />
    <div>{title}</div>
    <div
      className="ml-2 h-[1px] grow"
      style={{
        background:
          "linear-gradient(90deg, rgba(0, 0, 0, 0.05) -1.65%, rgba(0, 0, 0, 0.00) 100%)",
      }}></div>
  </div>
)
const EditItem: FC<Props> = ({ type, readonly, content, onSave }) => {
  const { t } = useTranslation()
  const [newContent, setNewContent] = useState("")
  const showNewContent = newContent && newContent !== content
  const avatar =
    type === EditItemType.Query ? (
      <User className="h-6 w-6" />
    ) : (
      <Robot className="h-6 w-6" />
    )
  const name =
    type === EditItemType.Query
      ? t("appAnnotation.editModal.queryName")
      : t("appAnnotation.editModal.answerName")
  const editTitle =
    type === EditItemType.Query
      ? t("appAnnotation.editModal.yourQuery")
      : t("appAnnotation.editModal.yourAnswer")
  const placeholder =
    type === EditItemType.Query
      ? t("appAnnotation.editModal.queryPlaceholder")
      : t("appAnnotation.editModal.answerPlaceholder")
  const [isEdit, setIsEdit] = useState(false)

  const handleSave = () => {
    onSave(newContent)
    setIsEdit(false)
  }

  const handleCancel = () => {
    setNewContent("")
    setIsEdit(false)
  }

  return (
    <div className="flex" onClick={e => e.stopPropagation()}>
      <div className="mr-3 shrink-0">{avatar}</div>
      <div className="grow">
        <div className="mb-1 text-xs font-semibold leading-[18px] text-gray-900">
          {name}
        </div>
        <div className="text-sm font-normal leading-5 text-gray-900">
          {content}
        </div>
        {!isEdit ? (
          <div>
            {showNewContent && (
              <div className="mt-3">
                <EditTitle title={editTitle} />
                <div className="mt-1 text-sm font-normal leading-5 text-gray-900">
                  {newContent}
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center">
              {!readonly && (
                <div
                  className="flex cursor-pointer items-center space-x-1 text-xs font-medium leading-[18px] text-[#155EEF]"
                  onClick={e => {
                    setIsEdit(true)
                  }}>
                  <Edit04 className="mr-1 h-3.5 w-3.5" />
                  <div>{t("common.operation.edit")}</div>
                </div>
              )}

              {showNewContent && (
                <div className="ml-2 flex items-center text-xs font-medium leading-[18px] text-gray-500">
                  <div className="mr-2">·</div>
                  <div
                    className="flex cursor-pointer items-center space-x-1"
                    onClick={() => {
                      setNewContent(content)
                      onSave(content)
                    }}>
                    <div className="h-3.5 w-3.5">
                      <RiDeleteBinLine className="h-3.5 w-3.5" />
                    </div>
                    <div>{t("common.operation.delete")}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <EditTitle title={editTitle} />
            <Textarea
              className="mt-1 block max-h-none w-full resize-none appearance-none text-sm leading-5 text-gray-700 outline-none"
              value={newContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setNewContent(e.target.value)
              }
              autoSize={{ minRows: 3 }}
              placeholder={placeholder}
              autoFocus
            />
            <div className="mt-2 flex space-x-2">
              <Button size="small" variant="primary" onClick={handleSave}>
                {t("common.operation.save")}
              </Button>
              <Button size="small" onClick={handleCancel}>
                {t("common.operation.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default React.memo(EditItem)
