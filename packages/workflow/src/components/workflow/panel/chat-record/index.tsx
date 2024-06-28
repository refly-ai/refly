import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { RiCloseLine } from "@remixicon/react"
import { useStore, useWorkflowStore } from "../../store"
import { useWorkflowRun } from "../../hooks"
import UserInput from "./user-input"
import Chat from "@/components/base/chat/chat"
import type { ChatItem } from "@/components/base/chat/types"
import { fetchConversationMessages } from "@/service/debug"
import { useStore as useAppStore } from "@/store"
import Loading from "@/components/base/loading"

const ChatRecord = () => {
  const [fetched, setFetched] = useState(false)
  const [chatList, setChatList] = useState([])
  const appDetail = useAppStore(s => s.appDetail)
  const workflowStore = useWorkflowStore()
  const { handleLoadBackupDraft } = useWorkflowRun()
  const historyWorkflowData = useStore(s => s.historyWorkflowData)
  const currentConversationID = historyWorkflowData?.conversation_id

  const chatMessageList = useMemo(() => {
    const res: ChatItem[] = []
    if (chatList.length) {
      chatList.forEach((item: any) => {
        res.push({
          id: `question-${item.id}`,
          content: item.query,
          isAnswer: false,
          message_files:
            item.message_files?.filter(
              (file: any) => file.belongs_to === "user",
            ) || [],
        })
        res.push({
          id: item.id,
          content: item.answer,
          feedback: item.feedback,
          isAnswer: true,
          citation: item.metadata?.retriever_resources,
          message_files:
            item.message_files?.filter(
              (file: any) => file.belongs_to === "assistant",
            ) || [],
          workflow_run_id: item.workflow_run_id,
        })
      })
    }
    return res
  }, [chatList])

  const handleFetchConversationMessages = useCallback(async () => {
    if (appDetail && currentConversationID) {
      try {
        setFetched(false)
        const res = await fetchConversationMessages(
          appDetail.id,
          currentConversationID,
        )
        setFetched(true)
        setChatList((res as any).data)
      } catch (e) {}
    }
  }, [appDetail, currentConversationID])
  useEffect(() => {
    handleFetchConversationMessages()
  }, [currentConversationID, appDetail, handleFetchConversationMessages])

  return (
    <div
      className={`border-black/2 flex h-full w-[400px] flex-col rounded-l-2xl border shadow-xl`}
      style={{
        background:
          "linear-gradient(156deg, rgba(242, 244, 247, 0.80) 0%, rgba(242, 244, 247, 0.00) 99.43%), var(--white, #FFF)",
      }}>
      {!fetched && (
        <div className="flex h-full items-center justify-center">
          <Loading />
        </div>
      )}
      {fetched && (
        <>
          <div className="flex shrink-0 items-center justify-between p-4 pb-1 text-base font-semibold text-gray-900">
            {`TEST CHAT#${historyWorkflowData?.sequence_number}`}
            <div
              className="flex h-6 w-6 cursor-pointer items-center justify-center"
              onClick={() => {
                handleLoadBackupDraft()
                workflowStore.setState({ historyWorkflowData: undefined })
              }}>
              <RiCloseLine className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          <div className="h-0 grow">
            <Chat
              config={
                {
                  supportCitationHitInfo: true,
                } as any
              }
              chatList={chatMessageList}
              chatContainerClassName="px-4"
              chatContainerInnerClassName="pt-6"
              chatFooterClassName="px-4 rounded-b-2xl"
              chatFooterInnerClassName="pb-4"
              chatNode={<UserInput />}
              noChatInput
              allToolIcons={{}}
              showPromptLog
            />
          </div>
        </>
      )}
    </div>
  )
}

export default memo(ChatRecord)
