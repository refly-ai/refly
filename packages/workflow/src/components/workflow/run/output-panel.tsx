"use client"
import type { FC } from "react"
import CodeEditor from "@/components/workflow/nodes/_base/components/editor/code-editor"
import { CodeLanguage } from "@/components/workflow/nodes/code/types"
import { Markdown } from "@/components/base/markdown"
import LoadingAnim from "@/components/base/chat/chat/loading-anim"

type OutputPanelProps = {
  isRunning?: boolean
  outputs?: any
  error?: string
  height?: number
}

const OutputPanel: FC<OutputPanelProps> = ({
  isRunning,
  outputs,
  error,
  height,
}) => {
  return (
    <div className="bg-gray-50 py-2">
      {isRunning && (
        <div className="pl-[26px] pt-4">
          <LoadingAnim type="text" />
        </div>
      )}
      {!isRunning && error && (
        <div className="px-4">
          <div className="shadow-xs rounded-lg border-[0.5px] border-[rbga(0,0,0,0.05)] !bg-[#fef3f2] px-3 py-[10px]">
            <div className="text-xs leading-[18px] text-[#d92d20]">{error}</div>
          </div>
        </div>
      )}
      {!isRunning && !outputs && (
        <div className="px-4 py-2">
          <Markdown content="No Output" />
        </div>
      )}
      {outputs && Object.keys(outputs).length === 1 && (
        <div className="px-4 py-2">
          <Markdown content={outputs[Object.keys(outputs)[0]] || ""} />
        </div>
      )}
      {outputs && Object.keys(outputs).length > 1 && height! > 0 && (
        <div className="flex flex-col gap-2 px-4 py-2">
          <CodeEditor
            readOnly
            title={<div></div>}
            language={CodeLanguage.json}
            value={outputs}
            isJSONStringifyBeauty
            height={height}
          />
        </div>
      )}
    </div>
  )
}

export default OutputPanel
