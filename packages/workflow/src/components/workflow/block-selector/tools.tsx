import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import BlockIcon from "../block-icon"
import { BlockEnum } from "../types"
import type { ToolWithProvider } from "../types"
import type { ToolDefaultValue } from "./types"
import Tooltip from "@/components/base/tooltip"
import Empty from "@/components/tools/add-tool-modal/empty"
import { useGetLanguage } from "@/context/i18n"

type ToolsProps = {
  showWorkflowEmpty: boolean
  onSelect: (type: BlockEnum, tool?: ToolDefaultValue) => void
  tools: ToolWithProvider[]
}
const Blocks = ({ showWorkflowEmpty, onSelect, tools }: ToolsProps) => {
  const { t } = useTranslation()
  const language = useGetLanguage()

  const renderGroup = useCallback(
    (toolWithProvider: ToolWithProvider) => {
      const list = toolWithProvider.tools

      return (
        <div key={toolWithProvider.id} className="mb-1 last-of-type:mb-0">
          <div className="flex h-[22px] items-start px-3 text-xs font-medium text-gray-500">
            {toolWithProvider.label[language]}
          </div>
          {list.map(tool => (
            <Tooltip
              key={tool.name}
              selector={`workflow-block-tool-${tool.name}`}
              position="right"
              className="!w-[200px] !rounded-xl !border-[0.5px] !border-black/5 !bg-transparent !p-0 !px-3 !py-2.5 !text-xs !leading-[18px] !text-gray-700 !shadow-lg"
              htmlContent={
                <div>
                  <BlockIcon
                    size="md"
                    className="mb-2"
                    type={BlockEnum.Tool}
                    toolIcon={toolWithProvider.icon}
                  />
                  <div className="mb-1 text-sm leading-5 text-gray-900">
                    {tool.label[language]}
                  </div>
                  <div className="text-xs leading-[18px] text-gray-700">
                    {tool.description[language]}
                  </div>
                </div>
              }
              noArrow>
              <div
                className="flex h-8 w-full cursor-pointer items-center rounded-lg px-3 hover:bg-gray-50"
                onClick={() =>
                  onSelect(BlockEnum.Tool, {
                    provider_id: toolWithProvider.id,
                    provider_type: toolWithProvider.type,
                    provider_name: toolWithProvider.name,
                    tool_name: tool.name,
                    tool_label: tool.label[language],
                    title: tool.label[language],
                  })
                }>
                <BlockIcon
                  className="mr-2 shrink-0"
                  type={BlockEnum.Tool}
                  toolIcon={toolWithProvider.icon}
                />
                <div className="truncate text-sm text-gray-900">
                  {tool.label[language]}
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      )
    },
    [onSelect, language],
  )

  return (
    <div className="max-h-[464px] max-w-[320px] overflow-y-auto p-1">
      {!tools.length && !showWorkflowEmpty && (
        <div className="flex h-[22px] items-center px-3 text-xs font-medium text-gray-500">
          {t("workflow.tabs.noResult")}
        </div>
      )}
      {!tools.length && showWorkflowEmpty && (
        <div className="py-10">
          <Empty />
        </div>
      )}
      {!!tools.length && tools.map(renderGroup)}
    </div>
  )
}

export default memo(Blocks)
