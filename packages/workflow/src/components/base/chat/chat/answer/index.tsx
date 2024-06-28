import type { FC, ReactNode } from "react"
import { memo, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ChatConfig, ChatItem } from "../../types"
import Operation from "./operation"
import AgentContent from "./agent-content"
import BasicContent from "./basic-content"
import SuggestedQuestions from "./suggested-questions"
import More from "./more"
import WorkflowProcess from "./workflow-process"
import { AnswerTriangle } from "@/components/base/icons/src/vender/solid/general"
import { MessageFast } from "@/components/base/icons/src/vender/solid/communication"
import LoadingAnim from "@/components/base/chat/chat/loading-anim"
import Citation from "@/components/base/chat/chat/citation"
import { EditTitle } from "@/components/annotation/edit-annotation-modal/edit-item"
import type { Emoji } from "@/components/tools/types"
import type { AppData } from "@/models/share"

type AnswerProps = {
  item: ChatItem
  question: string
  index: number
  config?: ChatConfig
  answerIcon?: ReactNode
  responding?: boolean
  allToolIcons?: Record<string, string | Emoji>
  showPromptLog?: boolean
  chatAnswerContainerInner?: string
  hideProcessDetail?: boolean
  appData?: AppData
}
const Answer: FC<AnswerProps> = ({
  item,
  question,
  index,
  config,
  answerIcon,
  responding,
  allToolIcons,
  showPromptLog,
  chatAnswerContainerInner,
  hideProcessDetail,
  appData,
}) => {
  const { t } = useTranslation()
  const {
    content,
    citation,
    agent_thoughts,
    more,
    annotation,
    workflowProcess,
  } = item
  const hasAgentThoughts = !!agent_thoughts?.length

  const [containerWidth, setContainerWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const getContainerWidth = () => {
    if (containerRef.current)
      setContainerWidth(containerRef.current?.clientWidth + 16)
  }
  const getContentWidth = () => {
    if (contentRef.current) setContentWidth(contentRef.current?.clientWidth)
  }

  useEffect(() => {
    getContainerWidth()
  }, [])

  useEffect(() => {
    if (!responding) getContentWidth()
  }, [responding])

  return (
    <div className="mb-2 flex last:mb-0">
      <div className="relative h-10 w-10 shrink-0">
        {answerIcon || (
          <div className="flex h-full w-full items-center justify-center rounded-full border-[0.5px] border-black/5 bg-[#d5f5f6] text-xl">
            🤖
          </div>
        )}
        {responding && (
          <div className="shadow-xs absolute -left-[3px] -top-[3px] flex h-4 w-4 items-center rounded-full border-[0.5px] border-gray-50 bg-white pl-[6px]">
            <LoadingAnim type="avatar" />
          </div>
        )}
      </div>
      <div
        className="chat-answer-container group ml-4 w-0 grow"
        ref={containerRef}>
        <div className={`group relative pr-10 ${chatAnswerContainerInner}`}>
          <AnswerTriangle className="absolute -left-2 top-0 h-3 w-2 text-gray-100" />
          <div
            ref={contentRef}
            className={`relative inline-block max-w-full rounded-b-2xl rounded-tr-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900 ${workflowProcess && "w-full"} `}>
            {annotation?.id && (
              <div className="absolute -right-3.5 -top-3.5 box-border flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white p-0.5 text-[#444CE7] shadow-md group-hover:hidden">
                <div className="rounded-lg bg-[#EEF4FF] p-1">
                  <MessageFast className="h-4 w-4" />
                </div>
              </div>
            )}
            {!responding && (
              <Operation
                hasWorkflowProcess={!!workflowProcess}
                maxSize={containerWidth - contentWidth - 4}
                contentWidth={contentWidth}
                item={item}
                question={question}
                index={index}
                showPromptLog={showPromptLog}
              />
            )}
            {/** Render the normal steps */}
            {workflowProcess && !hideProcessDetail && (
              <WorkflowProcess
                data={workflowProcess}
                item={item}
                hideInfo
                hideProcessDetail={hideProcessDetail}
              />
            )}
            {/** Hide workflow steps by it's settings in siteInfo */}
            {workflowProcess &&
              hideProcessDetail &&
              appData &&
              appData.site.show_workflow_steps && (
                <WorkflowProcess
                  data={workflowProcess}
                  item={item}
                  hideInfo
                  hideProcessDetail={hideProcessDetail}
                />
              )}
            {responding && !content && !hasAgentThoughts && (
              <div className="flex h-5 w-6 items-center justify-center">
                <LoadingAnim type="text" />
              </div>
            )}
            {content && !hasAgentThoughts && <BasicContent item={item} />}
            {hasAgentThoughts && (
              <AgentContent
                item={item}
                responding={responding}
                allToolIcons={allToolIcons}
              />
            )}
            {annotation?.id && annotation.authorName && (
              <EditTitle
                className="mt-1"
                title={t("appAnnotation.editBy", {
                  author: annotation.authorName,
                })}
              />
            )}
            <SuggestedQuestions item={item} />
            {!!citation?.length && !responding && (
              <Citation
                data={citation}
                showHitInfo={config?.supportCitationHitInfo}
              />
            )}
          </div>
        </div>
        <More more={more} />
      </div>
    </div>
  )
}

export default memo(Answer)
