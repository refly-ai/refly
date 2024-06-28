import type { FC } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiCloseLine } from "@remixicon/react"
import { useEffect, useRef, useState } from "react"
import { useClickAway } from "ahooks"
import AgentLogDetail from "./detail"
import type { IChatItem } from "@/components/base/chat/chat/type"

type AgentLogModalProps = {
  currentLogItem?: IChatItem
  width: number
  onCancel: () => void
}
const AgentLogModal: FC<AgentLogModalProps> = ({
  currentLogItem,
  width,
  onCancel,
}) => {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [mounted, setMounted] = useState(false)

  useClickAway(() => {
    if (mounted) onCancel()
  }, ref)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!currentLogItem || !currentLogItem.conversationId) return null

  return (
    <div
      className={cn(
        "relative z-10 flex flex-col rounded-xl border-[0.5px] border-gray-200 bg-white py-3 shadow-xl",
      )}
      style={{
        width: 480,
        position: "fixed",
        top: 56 + 8,
        left: 8 + (width - 480),
        bottom: 16,
      }}
      ref={ref}>
      <h1 className="text-md shrink-0 px-4 py-1 font-semibold text-gray-900">
        {t("appLog.runDetail.workflowTitle")}
      </h1>
      <span
        className="absolute right-3 top-4 z-20 cursor-pointer p-1"
        onClick={onCancel}>
        <RiCloseLine className="h-4 w-4 text-gray-500" />
      </span>
      <AgentLogDetail
        conversationID={currentLogItem.conversationId}
        messageID={currentLogItem.id}
        log={currentLogItem}
      />
    </div>
  )
}

export default AgentLogModal
