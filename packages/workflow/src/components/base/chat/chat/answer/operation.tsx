import type { FC } from "react"
import { memo, useMemo, useState } from "react"
import cn from "classnames"
import { useTranslation } from "react-i18next"
import type { ChatItem } from "../../types"
import { useChatContext } from "../context"
import CopyBtn from "@/components/base/copy-btn"
import { MessageFast } from "@/components/base/icons/src/vender/solid/communication"
import AudioBtn from "@/components/base/audio-btn"
import AnnotationCtrlBtn from "@/components/configuration/toolbox/annotation/annotation-ctrl-btn"
import EditReplyModal from "@/components/annotation/edit-annotation-modal"
import {
  ThumbsDown,
  ThumbsUp,
} from "@/components/base/icons/src/vender/line/alertsAndFeedback"
import TooltipPlus from "@/components/base/tooltip-plus"
import Log from "@/components/base/chat/chat/log"

type OperationProps = {
  item: ChatItem
  question: string
  index: number
  showPromptLog?: boolean
  maxSize: number
  contentWidth: number
  hasWorkflowProcess: boolean
}
const Operation: FC<OperationProps> = ({
  item,
  question,
  index,
  showPromptLog,
  maxSize,
  contentWidth,
  hasWorkflowProcess,
}) => {
  const { t } = useTranslation()
  const {
    config,
    onAnnotationAdded,
    onAnnotationEdited,
    onAnnotationRemoved,
    onFeedback,
  } = useChatContext()
  const [isShowReplyModal, setIsShowReplyModal] = useState(false)
  const {
    id,
    isOpeningStatement,
    content: messageContent,
    annotation,
    feedback,
    agent_thoughts,
  } = item
  const hasAnnotation = !!annotation?.id
  const [localFeedback, setLocalFeedback] = useState(feedback)

  const content = useMemo(() => {
    if (agent_thoughts?.length)
      return agent_thoughts.reduce((acc, cur) => acc + cur.thought, "")

    return messageContent
  }, [agent_thoughts, messageContent])

  const handleFeedback = async (rating: "like" | "dislike" | null) => {
    if (!config?.supportFeedback || !onFeedback) return

    await onFeedback?.(id, { rating })
    setLocalFeedback({ rating })
  }

  const operationWidth = useMemo(() => {
    let width = 0
    if (!isOpeningStatement) width += 28
    if (!isOpeningStatement && showPromptLog) width += 102 + 8
    if (!isOpeningStatement && config?.text_to_speech?.enabled) width += 33
    if (
      !isOpeningStatement &&
      config?.supportAnnotation &&
      config?.annotation_reply?.enabled
    )
      width += 56 + 8
    if (
      config?.supportFeedback &&
      !localFeedback?.rating &&
      onFeedback &&
      !isOpeningStatement
    )
      width += 60 + 8
    if (
      config?.supportFeedback &&
      localFeedback?.rating &&
      onFeedback &&
      !isOpeningStatement
    )
      width += 28 + 8
    return width
  }, [
    isOpeningStatement,
    showPromptLog,
    config?.text_to_speech?.enabled,
    config?.supportAnnotation,
    config?.annotation_reply?.enabled,
    config?.supportFeedback,
    localFeedback?.rating,
    onFeedback,
  ])

  const positionRight = useMemo(
    () => operationWidth < maxSize,
    [operationWidth, maxSize],
  )

  return (
    <>
      <div
        className={cn(
          "absolute flex justify-end gap-1",
          hasWorkflowProcess && "-right-3.5 -top-3.5",
          !positionRight && "-right-3.5 -top-3.5",
          !hasWorkflowProcess && positionRight && "!top-[9px]",
        )}
        style={
          !hasWorkflowProcess && positionRight ? { left: contentWidth + 8 } : {}
        }>
        {!isOpeningStatement && (
          <CopyBtn value={content} className="hidden group-hover:block" />
        )}

        {!isOpeningStatement &&
          (showPromptLog || config?.text_to_speech?.enabled) && (
            <div className="hidden h-[28px] w-max shrink-0 items-center rounded-lg border-[0.5px] border-gray-100 bg-white p-0.5 shadow-md group-hover:flex">
              {showPromptLog && <Log logItem={item} />}
              {config?.text_to_speech?.enabled && (
                <>
                  <div className="mx-1 h-[14px] w-[1px] bg-gray-200" />
                  <AudioBtn
                    value={content}
                    noCache={false}
                    voice={config?.text_to_speech?.voice}
                    className="hidden group-hover:block"
                  />
                </>
              )}
            </div>
          )}

        {!isOpeningStatement &&
          config?.supportAnnotation &&
          config.annotation_reply?.enabled && (
            <AnnotationCtrlBtn
              appId={config?.appId || ""}
              messageId={id}
              annotationId={annotation?.id || ""}
              className="ml-1 hidden shrink-0 group-hover:block"
              cached={hasAnnotation}
              query={question}
              answer={content}
              onAdded={(id, authorName) =>
                onAnnotationAdded?.(id, authorName, question, content, index)
              }
              onEdit={() => setIsShowReplyModal(true)}
              onRemoved={() => onAnnotationRemoved?.(index)}
            />
          )}
        {!positionRight && annotation?.id && (
          <div className="relative box-border flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white p-0.5 text-[#444CE7] shadow-md group-hover:hidden">
            <div className="rounded-lg bg-[#EEF4FF] p-1">
              <MessageFast className="h-4 w-4" />
            </div>
          </div>
        )}
        {config?.supportFeedback &&
          !localFeedback?.rating &&
          onFeedback &&
          !isOpeningStatement && (
            <div className="ml-1 hidden shrink-0 items-center rounded-lg border-[0.5px] border-gray-100 bg-white px-0.5 text-gray-500 shadow-md group-hover:flex">
              <TooltipPlus popupContent={t("appDebug.operation.agree")}>
                <div
                  className="mr-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5 hover:text-gray-800"
                  onClick={() => handleFeedback("like")}>
                  <ThumbsUp className="h-4 w-4" />
                </div>
              </TooltipPlus>
              <TooltipPlus popupContent={t("appDebug.operation.disagree")}>
                <div
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5 hover:text-gray-800"
                  onClick={() => handleFeedback("dislike")}>
                  <ThumbsDown className="h-4 w-4" />
                </div>
              </TooltipPlus>
            </div>
          )}
        {config?.supportFeedback &&
          localFeedback?.rating &&
          onFeedback &&
          !isOpeningStatement && (
            <TooltipPlus
              popupContent={
                localFeedback.rating === "like"
                  ? t("appDebug.operation.cancelAgree")
                  : t("appDebug.operation.cancelDisagree")
              }>
              <div
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-[10px] border-[2px] border-white ${localFeedback.rating === "like" && "bg-blue-50 text-blue-600"} ${localFeedback.rating === "dislike" && "bg-red-100 text-red-600"} `}
                onClick={() => handleFeedback(null)}>
                {localFeedback.rating === "like" && (
                  <ThumbsUp className="h-4 w-4" />
                )}
                {localFeedback.rating === "dislike" && (
                  <ThumbsDown className="h-4 w-4" />
                )}
              </div>
            </TooltipPlus>
          )}
      </div>
      <EditReplyModal
        isShow={isShowReplyModal}
        onHide={() => setIsShowReplyModal(false)}
        query={question}
        answer={content}
        onEdited={(editedQuery, editedAnswer) =>
          onAnnotationEdited?.(editedQuery, editedAnswer, index)
        }
        onAdded={(annotationId, authorName, editedQuery, editedAnswer) =>
          onAnnotationAdded?.(
            annotationId,
            authorName,
            editedQuery,
            editedAnswer,
            index,
          )
        }
        appId={config?.appId || ""}
        messageId={id}
        annotationId={annotation?.id || ""}
        createdAt={annotation?.created_at}
        onRemove={() => onAnnotationRemoved?.(index)}
      />
    </>
  )
}

export default memo(Operation)
