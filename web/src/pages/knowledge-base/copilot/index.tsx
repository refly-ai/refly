import { Tabs, Input } from "@arco-design/web-react"
import { Breadcrumb, Button } from "@arco-design/web-react"

// 自定义组件
import { DigestToday } from "@/pages/digest-today"
import { ThreadLibrary } from "@/components/thread-library"

// 自定义组件
import {
  IconBook,
  IconCaretDown,
  IconFolder,
  IconHistory,
  IconMessage,
  IconMore,
  IconPlusCircle,
  IconTranslate,
} from "@arco-design/web-react/icon"
// 自定义样式
import "./index.scss"
import { fakeConversations } from "@/fake-data/conversation"
// 自定义组件
import { SearchTargetSelector } from "@/components/search-target-selector"
import { useSearchParams } from "react-router-dom"
import { SearchTarget, useSearchStateStore } from "@/stores/search-state"
import { ContextStateDisplay } from "./context-state-display"
import { useCopilotContextState } from "@/hooks/use-copilot-context-state"
import { useEffect, useState } from "react"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ConvListModal } from "./conv-list-modal"
import { KnowledgeBaseListModal } from "./knowledge-base-list-modal"

// requests
import getThreadMessages from "@/requests/getThreadMessages"

// state
import { useChatStore } from "@/stores/chat"
import { Conversation, LOCALE } from "@/types"
import { useConversationStore } from "@/stores/conversation"
import { useResetState } from "@/hooks/use-reset-state"
import { useBuildThreadAndRun } from "@/hooks/use-build-thread-and-run"
import { delay } from "@/utils/delay"
import { useKnowledgeBaseStore } from "@/stores/knowledge-base"
// utils
import { localeToLanguageName } from "@/utils/i18n"
import { OutputLocaleList } from "@/components/output-locale-list"
import { useTranslation } from "react-i18next"
import { useUserStore } from "@/stores/user"

const TextArea = Input.TextArea

export const AICopilot = () => {
  const [searchParams] = useSearchParams()
  const [copilotBodyHeight, setCopilotBodyHeight] = useState(215 - 32)
  const userStore = useUserStore()
  const knowledgeBaseStore = useKnowledgeBaseStore()
  const { contextCardHeight, showContextCard, showContextState } =
    useCopilotContextState()
  const chatStore = useChatStore()
  const conversationStore = useConversationStore()
  const [isFetching, setIsFetching] = useState(false)
  const { runTask } = useBuildThreadAndRun()
  const searchStateStore = useSearchStateStore()

  const convId = searchParams.get("convId")
  const { resetState } = useResetState()
  const actualCopilotBodyHeight =
    copilotBodyHeight + (showContextCard ? contextCardHeight : 0)

  const { t, i18n } = useTranslation()
  const uiLocale = i18n?.languages?.[0] as LOCALE
  const outputLocale = userStore?.localSettings?.outputLocale

  const handleSwitchSearchTarget = () => {
    if (showContextState) {
      searchStateStore.setSearchTarget(SearchTarget.CurrentPage)
    }
  }

  const handleNewTempConv = () => {
    conversationStore.resetState()
    chatStore.resetState()
  }

  const handleNewTempKb = () => {
    knowledgeBaseStore.updateKbModalVisible(true)
  }

  const handleNewOpenConvList = () => {
    knowledgeBaseStore.updateConvModalVisible(true)
  }

  const handleGetThreadMessages = async (convId: string) => {
    // 异步操作
    const res = await getThreadMessages({
      body: {
        convId,
      },
    })

    console.log("getThreadMessages", res)

    // 清空之前的状态
    resetState()

    // 设置会话和消息
    conversationStore.setCurrentConversation(res?.data as Conversation)

    //
    const messages = (res?.data?.messages || [])?.map(item => {
      const {
        content = "",
        relatedQuestions = [],
        sources,
        type,
        selectedWeblinkConfig = "", // 这里需要构建进来
        ...extraInfo
      } = item || {}

      return {
        ...extraInfo,
        data: {
          content,
          relatedQuestions,
          sources,
          type,
          selectedWeblinkConfig,
        },
      }
    })
    chatStore.setMessages(messages)
  }

  const handleConvTask = async (convId: string) => {
    try {
      setIsFetching(true)
      const { isNewConversation } = useChatStore.getState()

      // 新会话，需要手动构建第一条消息
      if (isNewConversation && convId) {
        // 更换成基于 task 的消息模式，核心是基于 task 来处理
        runTask()
      } else if (convId) {
        handleGetThreadMessages(convId)
      }
    } catch (err) {
      console.log("thread error")
    }

    await delay(1500)
    setIsFetching(false)
  }

  useEffect(() => {
    if (convId) {
      handleConvTask(convId)
    }
  }, [convId])
  useEffect(() => {
    handleSwitchSearchTarget()
  }, [showContextState])

  return (
    <div className="ai-copilot-container">
      <div className="knowledge-base-detail-header">
        <div className="knowledge-base-detail-navigation-bar">
          {conversationStore?.currentConversation?.title ? (
            <div className="conv-meta">
              <IconMessage style={{ color: "rgba(0, 0, 0, .6)" }} />
              <p className="conv-title">
                {conversationStore?.currentConversation?.title}
              </p>
            </div>
          ) : null}
        </div>
        <div className="knowledge-base-detail-menu">
          <Button
            type="text"
            icon={<IconMore style={{ fontSize: 16 }} />}></Button>
        </div>
      </div>
      <div
        className="ai-copilot-message-container"
        style={{ height: `calc(100% - ${actualCopilotBodyHeight}px - 50px)` }}>
        <ChatMessages />
      </div>
      <div
        className="ai-copilot-body"
        style={{ height: actualCopilotBodyHeight }}>
        {showContextCard ? (
          <div className="ai-copilot-context-display">
            <ContextStateDisplay />
          </div>
        ) : null}
        <div className="ai-copilot-chat-container">
          <div className="chat-setting-container">
            <div className="chat-operation-container">
              <Button
                icon={<IconFolder />}
                type="text"
                onClick={() => {
                  handleNewTempKb()
                }}
                className="chat-input-assist-action-item">
                选择知识库
              </Button>
            </div>
            <div className="conv-operation-container">
              <Button
                icon={<IconHistory />}
                type="text"
                onClick={() => {
                  handleNewOpenConvList()
                }}
                className="chat-input-assist-action-item">
                会话历史
              </Button>
              <Button
                icon={<IconPlusCircle />}
                type="text"
                onClick={() => {
                  handleNewTempConv()
                }}
                className="chat-input-assist-action-item">
                新会话
              </Button>
            </div>
          </div>

          {/* <div className="skill-container">
            {["搜索", "写作", "翻译", "数据分析", "更多技能"].map(
              (item, index) => (
                <div key={index} className="skill-item">
                  {item}
                </div>
              ),
            )}
          </div> */}
          <div className="chat-input-container">
            <div className="chat-input-body">
              <ChatInput
                placeholder="提出问题，发现新知"
                autoSize={{ minRows: 3, maxRows: 3 }}
              />
            </div>
            <div className="chat-input-assist-action">
              <SearchTargetSelector classNames="chat-input-assist-action-item" />

              <OutputLocaleList>
                <Button
                  icon={<IconTranslate />}
                  type="text"
                  className="chat-input-assist-action-item">
                  <span>
                    {localeToLanguageName?.[uiLocale]?.[outputLocale]}{" "}
                  </span>
                  <IconCaretDown />
                </Button>
              </OutputLocaleList>
            </div>
          </div>
        </div>
      </div>
      {knowledgeBaseStore?.convModalVisible ? (
        <ConvListModal
          title="会话库"
          classNames="conv-list-modal"
          getPopupContainer={() => {
            return document.querySelector(".ai-copilot-container") as Element
          }}
        />
      ) : null}
      {knowledgeBaseStore?.kbModalVisible ? (
        <KnowledgeBaseListModal
          title="知识库"
          classNames="kb-list-modal"
          getPopupContainer={() => {
            return document.querySelector(".ai-copilot-container") as Element
          }}
        />
      ) : null}
    </div>
  )
}
