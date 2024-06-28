import { memo, useEffect } from "react"
import cn from "classnames"
import { useTranslation } from "react-i18next"
// import Loading from '@/components/base/loading'
import { Markdown } from "@/components/base/markdown"
import CodeEditor from "@/components/workflow/nodes/_base/components/editor/code-editor"
import { CodeLanguage } from "@/components/workflow/nodes/code/types"
import type { WorkflowProcess } from "@/components/base/chat/types"
// import { WorkflowRunningStatus } from '@/components/workflow/types'

const ResultTab = ({
  data,
  content,
  currentTab,
  onCurrentTabChange,
}: {
  data?: WorkflowProcess
  content: any
  currentTab: string
  onCurrentTabChange: (tab: string) => void
}) => {
  const { t } = useTranslation()

  const switchTab = async (tab: string) => {
    onCurrentTabChange(tab)
  }
  useEffect(() => {
    if (data?.resultText) switchTab("RESULT")
    else switchTab("DETAIL")
  }, [data?.resultText])

  return (
    <div className="relative flex grow flex-col">
      {data?.resultText && (
        <div className="mb-2 flex shrink-0 items-center border-b-[0.5px] border-[rgba(0,0,0,0.05)]">
          <div
            className={cn(
              "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
              currentTab === "RESULT" &&
                "!border-[rgb(21,94,239)] text-gray-700",
            )}
            onClick={() => switchTab("RESULT")}>
            {t("runLog.result")}
          </div>
          <div
            className={cn(
              "mr-6 cursor-pointer border-b-2 border-transparent py-3 text-[13px] font-semibold leading-[18px] text-gray-400",
              currentTab === "DETAIL" &&
                "!border-[rgb(21,94,239)] text-gray-700",
            )}
            onClick={() => switchTab("DETAIL")}>
            {t("runLog.detail")}
          </div>
        </div>
      )}
      <div className={cn("grow bg-white")}>
        {currentTab === "RESULT" && (
          <Markdown content={data?.resultText || ""} />
        )}
        {currentTab === "DETAIL" && content && (
          <CodeEditor
            readOnly
            title={<div>JSON OUTPUT</div>}
            language={CodeLanguage.json}
            value={content}
            isJSONStringifyBeauty
          />
        )}
      </div>
    </div>
  )
}

export default memo(ResultTab)
