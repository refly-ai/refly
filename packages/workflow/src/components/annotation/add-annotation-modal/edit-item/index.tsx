"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import Textarea from "rc-textarea"
import { Robot, User } from "@/components/base/icons/src/public/avatar"

export enum EditItemType {
  Query = "query",
  Answer = "answer",
}
type Props = {
  type: EditItemType
  content: string
  onChange: (content: string) => void
}

const EditItem: FC<Props> = ({ type, content, onChange }) => {
  const { t } = useTranslation()
  const avatar =
    type === EditItemType.Query ? (
      <User className="h-6 w-6" />
    ) : (
      <Robot className="h-6 w-6" />
    )
  const name =
    type === EditItemType.Query
      ? t("appAnnotation.addModal.queryName")
      : t("appAnnotation.addModal.answerName")
  const placeholder =
    type === EditItemType.Query
      ? t("appAnnotation.addModal.queryPlaceholder")
      : t("appAnnotation.addModal.answerPlaceholder")

  return (
    <div className="flex" onClick={e => e.stopPropagation()}>
      <div className="mr-3 shrink-0">{avatar}</div>
      <div className="grow">
        <div className="mb-1 text-xs font-semibold leading-[18px] text-gray-900">
          {name}
        </div>
        <Textarea
          className="mt-1 block max-h-none w-full resize-none appearance-none text-sm leading-5 text-gray-700 outline-none"
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange(e.target.value)
          }
          autoSize={{ minRows: 3 }}
          placeholder={placeholder}
          autoFocus
        />
      </div>
    </div>
  )
}
export default React.memo(EditItem)
