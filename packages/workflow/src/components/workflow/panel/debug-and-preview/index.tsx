import { memo, useRef } from "react"
import { useKeyPress } from "ahooks"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import { useTranslation } from "react-i18next"
import {
  useEdgesInteractions,
  useNodesInteractions,
  useWorkflowInteractions,
} from "../../hooks"
import ChatWrapper from "./chat-wrapper"
import Button from "@/components/base/button"
import { RefreshCcw01 } from "@/components/base/icons/src/vender/line/arrows"

export type ChatWrapperRefType = {
  handleRestart: () => void
}
const DebugAndPreview = () => {
  const { t } = useTranslation()
  const chatRef = useRef({ handleRestart: () => {} })
  const { handleCancelDebugAndPreviewPanel } = useWorkflowInteractions()
  const { handleNodeCancelRunningStatus } = useNodesInteractions()
  const { handleEdgeCancelRunningStatus } = useEdgesInteractions()

  const handleRestartChat = () => {
    handleNodeCancelRunningStatus()
    handleEdgeCancelRunningStatus()
    chatRef.current.handleRestart()
  }

  useKeyPress(
    "shift.r",
    () => {
      handleRestartChat()
    },
    {
      exactMatch: true,
    },
  )

  return (
    <div
      className={cn(
        "border-black/2 flex h-full w-[400px] flex-col rounded-l-2xl border",
      )}
      style={{
        background:
          "linear-gradient(156deg, rgba(242, 244, 247, 0.80) 0%, rgba(242, 244, 247, 0.00) 99.43%), var(--white, #FFF)",
      }}>
      <div className="flex shrink-0 items-center justify-between pb-2 pl-4 pr-3 pt-3 font-semibold text-gray-900">
        {t("workflow.common.debugAndPreview").toLocaleUpperCase()}
        <div className="flex items-center">
          <Button onClick={() => handleRestartChat()}>
            <RefreshCcw01 className="mr-1 h-3 w-3 shrink-0 text-gray-500" />
            <div
              className="grow truncate uppercase"
              title={t("common.operation.refresh") || ""}>
              {t("common.operation.refresh")}
            </div>
            <div className="ml-1 shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1 text-[11px] font-medium leading-[18px] text-gray-500">
              Shift
            </div>
            <div className="ml-0.5 shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1 text-[11px] font-medium leading-[18px] text-gray-500">
              R
            </div>
          </Button>
          <div className="mx-3 h-3.5 w-[1px] bg-gray-200"></div>
          <div
            className="flex h-6 w-6 cursor-pointer items-center justify-center"
            onClick={handleCancelDebugAndPreviewPanel}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>
      <div className="grow overflow-y-auto rounded-b-2xl">
        <ChatWrapper ref={chatRef} />
      </div>
    </div>
  )
}

export default memo(DebugAndPreview)
