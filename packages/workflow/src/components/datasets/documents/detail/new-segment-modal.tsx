import { memo, useState } from "react"
import type { FC } from "react"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import { useParams } from "next/navigation"
import { RiCloseLine } from "@remixicon/react"
import Modal from "@/components/base/modal"
import Button from "@/components/base/button"
import AutoHeightTextarea from "@/components/base/auto-height-textarea/common"
import { Hash02 } from "@/components/base/icons/src/vender/line/general"
import { ToastContext } from "@/components/base/toast"
import type { SegmentUpdator } from "@/models/datasets"
import { addSegment } from "@/service/datasets"
import TagInput from "@/components/base/tag-input"

type NewSegmentModalProps = {
  isShow: boolean
  onCancel: () => void
  docForm: string
  onSave: () => void
}

const NewSegmentModal: FC<NewSegmentModalProps> = ({
  isShow,
  onCancel,
  docForm,
  onSave,
}) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const { datasetId, documentId } = useParams()
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleCancel = () => {
    setQuestion("")
    setAnswer("")
    onCancel()
    setKeywords([])
  }

  const handleSave = async () => {
    const params: SegmentUpdator = { content: "" }
    if (docForm === "qa_model") {
      if (!question.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.questionEmpty"),
        })
      if (!answer.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.answerEmpty"),
        })

      params.content = question
      params.answer = answer
    } else {
      if (!question.trim())
        return notify({
          type: "error",
          message: t("datasetDocuments.segment.contentEmpty"),
        })

      params.content = question
    }

    if (keywords?.length) params.keywords = keywords

    setLoading(true)
    try {
      await addSegment({ datasetId, documentId, body: params })
      notify({
        type: "success",
        message: t("common.actionMsg.modifiedSuccessfully"),
      })
      handleCancel()
      onSave()
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    if (docForm === "qa_model") {
      return (
        <>
          <div className="mb-1 text-xs font-medium text-gray-500">QUESTION</div>
          <AutoHeightTextarea
            outerClassName="mb-4"
            className="text-md leading-6 text-gray-800"
            value={question}
            placeholder={
              t("datasetDocuments.segment.questionPlaceholder") || ""
            }
            onChange={e => setQuestion(e.target.value)}
            autoFocus
          />
          <div className="mb-1 text-xs font-medium text-gray-500">ANSWER</div>
          <AutoHeightTextarea
            outerClassName="mb-4"
            className="text-md leading-6 text-gray-800"
            value={answer}
            placeholder={t("datasetDocuments.segment.answerPlaceholder") || ""}
            onChange={e => setAnswer(e.target.value)}
          />
        </>
      )
    }

    return (
      <AutoHeightTextarea
        className="text-md leading-6 text-gray-800"
        value={question}
        placeholder={t("datasetDocuments.segment.contentPlaceholder") || ""}
        onChange={e => setQuestion(e.target.value)}
        autoFocus
      />
    )
  }

  return (
    <Modal
      isShow={isShow}
      onClose={() => {}}
      className="!max-w-[640px] !rounded-xl px-8 pb-6 pt-8">
      <div className={"relative flex flex-col"}>
        <div className="absolute -top-0.5 right-0 flex h-6 items-center">
          <div
            className="flex h-6 w-6 cursor-pointer items-center justify-center"
            onClick={handleCancel}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
        <div className="mb-[14px]">
          <span className="inline-flex h-5 items-center rounded-md border border-gray-200 px-1.5">
            <Hash02 className="mr-0.5 h-3 w-3 text-gray-400" />
            <span className="text-[11px] font-medium italic text-gray-500">
              {docForm === "qa_model"
                ? t("datasetDocuments.segment.newQaSegment")
                : t("datasetDocuments.segment.newTextSegment")}
            </span>
          </span>
        </div>
        <div className="mb-4 h-[420px] overflow-auto py-1.5">
          {renderContent()}
        </div>
        <div className="text-xs font-medium text-gray-500">
          {t("datasetDocuments.segment.keywords")}
        </div>
        <div className="mb-8">
          <TagInput
            items={keywords}
            onChange={newKeywords => setKeywords(newKeywords)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCancel}>{t("common.operation.cancel")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {t("common.operation.save")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default memo(NewSegmentModal)
