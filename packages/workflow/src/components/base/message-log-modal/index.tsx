import type { FC } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { useCallback, useEffect, useRef, useState } from "react"
import { useBoolean, useClickAway } from "ahooks"
import { RiCloseLine } from "@remixicon/react"
import IterationResultPanel from "../../workflow/run/iteration-result-panel"
import type { IChatItem } from "@/components/base/chat/chat/type"
import Run from "@/components/workflow/run"
import type { NodeTracing } from "@/types/workflow"

type MessageLogModalProps = {
  currentLogItem?: IChatItem
  defaultTab?: string
  width: number
  fixedWidth?: boolean
  onCancel: () => void
}
const MessageLogModal: FC<MessageLogModalProps> = ({
  currentLogItem,
  defaultTab = "DETAIL",
  width,
  fixedWidth,
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

  const [iterationRunResult, setIterationRunResult] = useState<NodeTracing[][]>(
    [],
  )
  const [
    isShowIterationDetail,
    { setTrue: doShowIterationDetail, setFalse: doHideIterationDetail },
  ] = useBoolean(false)

  const handleShowIterationDetail = useCallback(
    (detail: NodeTracing[][]) => {
      setIterationRunResult(detail)
      doShowIterationDetail()
    },
    [doShowIterationDetail],
  )

  if (!currentLogItem || !currentLogItem.workflow_run_id) return null

  return (
    <div
      className={cn(
        "relative z-10 flex flex-col rounded-xl border-[0.5px] border-gray-200 bg-white py-3 shadow-xl",
      )}
      style={{
        width: fixedWidth ? width : 480,
        ...(!fixedWidth
          ? {
              position: "fixed",
              top: 56 + 8,
              left: 8 + (width - 480),
              bottom: 16,
            }
          : {
              marginRight: 8,
            }),
      }}
      ref={ref}>
      {isShowIterationDetail ? (
        <IterationResultPanel
          list={iterationRunResult}
          onHide={doHideIterationDetail}
          onBack={doHideIterationDetail}
        />
      ) : (
        <>
          <h1 className="text-md shrink-0 px-4 py-1 font-semibold text-gray-900">
            {t("appLog.runDetail.title")}
          </h1>
          <span
            className="absolute right-3 top-4 z-20 cursor-pointer p-1"
            onClick={onCancel}>
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </span>
          <Run
            hideResult
            activeTab={defaultTab as any}
            runID={currentLogItem.workflow_run_id}
            onShowIterationDetail={handleShowIterationDetail}
          />
        </>
      )}
    </div>
  )
}

export default MessageLogModal
