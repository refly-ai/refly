"use client"
import type { FC } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import Indicator from "@/components/header/indicator"

type ResultProps = {
  status: string
  time?: number
  tokens?: number
  error?: string
}

const StatusPanel: FC<ResultProps> = ({ status, time, tokens, error }) => {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "shadow-xs rounded-lg border-[0.5px] border-[rbga(0,0,0,0.05)] px-3 py-[10px]",
        status === "running" && "!bg-primary-50",
        status === "succeeded" && "!bg-[#ecfdf3]",
        status === "failed" && "!bg-[#fef3f2]",
        status === "stopped" && "!bg-[#fffaeb]",
      )}>
      <div className="flex">
        <div className="max-w-[120px] flex-[33%]">
          <div className="text-xs font-medium leading-[18px] text-gray-400">
            {t("runLog.resultPanel.status")}
          </div>
          <div
            className={cn(
              "flex h-[18px] items-center gap-1 text-xs font-semibold leading-3",
              status === "running" && "!text-primary-600",
              status === "succeeded" && "!text-[#039855]",
              status === "failed" && "!text-[#d92d20]",
              status === "stopped" && "!text-[#f79009]",
            )}>
            {status === "running" && <span>Running</span>}
            {status === "succeeded" && (
              <>
                <Indicator color={"green"} />
                <span>SUCCESS</span>
              </>
            )}
            {status === "failed" && (
              <>
                <Indicator color={"red"} />
                <span>FAIL</span>
              </>
            )}
            {status === "stopped" && (
              <>
                <Indicator color={"yellow"} />
                <span>STOP</span>
              </>
            )}
          </div>
        </div>
        <div className="max-w-[152px] flex-[33%]">
          <div className="text-xs font-medium leading-[18px] text-gray-400">
            {t("runLog.resultPanel.time")}
          </div>
          <div className="flex h-[18px] items-center gap-1 text-xs font-semibold leading-3 text-gray-700">
            {status === "running" && (
              <div className="h-2 w-16 rounded-sm bg-[rgba(0,0,0,0.05)]" />
            )}
            {status !== "running" && <span>{`${time?.toFixed(3)}s`}</span>}
          </div>
        </div>
        <div className="flex-[33%]">
          <div className="text-xs font-medium leading-[18px] text-gray-400">
            {t("runLog.resultPanel.tokens")}
          </div>
          <div className="flex h-[18px] items-center gap-1 text-xs font-semibold leading-3 text-gray-700">
            {status === "running" && (
              <div className="h-2 w-20 rounded-sm bg-[rgba(0,0,0,0.05)]" />
            )}
            {status !== "running" && <span>{`${tokens || 0} Tokens`}</span>}
          </div>
        </div>
      </div>
      {status === "failed" && error && (
        <>
          <div className="my-2 h-[0.5px] bg-black opacity-5" />
          <div className="text-xs leading-[18px] text-[#d92d20]">{error}</div>
        </>
      )}
    </div>
  )
}

export default StatusPanel
