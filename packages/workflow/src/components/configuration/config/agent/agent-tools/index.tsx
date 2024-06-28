"use client"
import type { FC } from "react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { useContext } from "use-context-selector"
import produce from "immer"
import { RiDeleteBinLine, RiHammerFill, RiQuestionLine } from "@remixicon/react"
import { useFormattingChangedDispatcher } from "../../../debug/hooks"
import SettingBuiltInTool from "./setting-built-in-tool"
import Panel from "@/components/configuration/base/feature-panel"
import Tooltip from "@/components/base/tooltip"
import { InfoCircle } from "@/components/base/icons/src/vender/line/general"
import OperationBtn from "@/components/configuration/base/operation-btn"
import AppIcon from "@/components/base/app-icon"
import Switch from "@/components/base/switch"
import ConfigContext from "@/context/debug-configuration"
import type { AgentTool } from "@/types/app"
import { type Collection, CollectionType } from "@/components/tools/types"
import { MAX_TOOLS_NUM } from "@/config"
import { AlertTriangle } from "@/components/base/icons/src/vender/solid/alertsAndFeedback"
import TooltipPlus from "@/components/base/tooltip-plus"
import { DefaultToolIcon } from "@/components/base/icons/src/public/other"
import AddToolModal from "@/components/tools/add-tool-modal"

type AgentToolWithMoreInfo =
  | (AgentTool & { icon: any; collection?: Collection })
  | null
const AgentTools: FC = () => {
  const { t } = useTranslation()
  const [isShowChooseTool, setIsShowChooseTool] = useState(false)
  const { modelConfig, setModelConfig, collectionList } =
    useContext(ConfigContext)
  const formattingChangedDispatcher = useFormattingChangedDispatcher()

  const [currentTool, setCurrentTool] = useState<AgentToolWithMoreInfo>(null)
  const [isShowSettingTool, setIsShowSettingTool] = useState(false)
  const tools = ((modelConfig?.agentConfig?.tools as AgentTool[]) || []).map(
    item => {
      const collection = collectionList.find(
        collection =>
          collection.id === item.provider_id &&
          collection.type === item.provider_type,
      )
      const icon = collection?.icon
      return {
        ...item,
        icon,
        collection,
      }
    },
  )

  const handleToolSettingChange = (value: Record<string, any>) => {
    const newModelConfig = produce(modelConfig, draft => {
      const tool = draft.agentConfig.tools.find(
        (item: any) =>
          item.provider_id === currentTool?.collection?.id &&
          item.tool_name === currentTool?.tool_name,
      )
      if (tool) (tool as AgentTool).tool_parameters = value
    })
    setModelConfig(newModelConfig)
    setIsShowSettingTool(false)
    formattingChangedDispatcher()
  }

  return (
    <>
      <Panel
        className="mt-4"
        noBodySpacing={tools.length === 0}
        headerIcon={<RiHammerFill className="text-primary-500 h-4 w-4" />}
        title={
          <div className="flex items-center">
            <div className="mr-1">{t("appDebug.agent.tools.name")}</div>
            <Tooltip
              htmlContent={
                <div className="w-[180px]">
                  {t("appDebug.agent.tools.description")}
                </div>
              }
              selector="config-tools-tooltip">
              <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
            </Tooltip>
          </div>
        }
        headerRight={
          <div className="flex items-center">
            <div className="text-xs font-normal leading-[18px] text-gray-500">
              {tools.filter((item: any) => !!item.enabled).length}/
              {tools.length}&nbsp;{t("appDebug.agent.tools.enabled")}
            </div>
            {tools.length < MAX_TOOLS_NUM && (
              <>
                <div className="ml-3 mr-1 h-3.5 w-px bg-gray-200"></div>
                <OperationBtn
                  type="add"
                  onClick={() => setIsShowChooseTool(true)}
                />
              </>
            )}
          </div>
        }>
        <div className="grid grid-cols-1 flex-wrap items-center justify-between gap-1 2xl:grid-cols-2">
          {tools.map(
            (
              item: AgentTool & { icon: any; collection?: Collection },
              index,
            ) => (
              <div
                key={index}
                className={cn(
                  item.isDeleted || item.notAuthor ? "bg-white/50" : "bg-white",
                  item.enabled &&
                    !item.isDeleted &&
                    !item.notAuthor &&
                    "shadow-xs",
                  index > 1 && "mt-1",
                  "group relative flex w-full items-center justify-between rounded-lg border-[0.5px] border-gray-200 py-2 pl-2.5 pr-3 last-of-type:mb-0",
                )}>
                <div className="flex w-0 grow items-center">
                  {item.isDeleted || item.notAuthor ? (
                    <DefaultToolIcon className="h-6 w-6" />
                  ) : typeof item.icon === "string" ? (
                    <div
                      className="h-6 w-6 rounded-md bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${item.icon})`,
                      }}></div>
                  ) : (
                    <AppIcon
                      className="rounded-md"
                      size="tiny"
                      icon={item.icon?.content}
                      background={item.icon?.background}
                    />
                  )}
                  <div
                    className={cn(
                      item.isDeleted || item.notAuthor
                        ? "line-through opacity-50"
                        : "",
                      "ml-2 w-0 grow truncate text-[13px] font-medium leading-[18px] text-gray-800",
                    )}>
                    <span className="pr-2 text-gray-800">
                      {item.provider_type === CollectionType.builtIn
                        ? item.provider_name
                        : item.tool_label}
                    </span>
                    <TooltipPlus popupContent={t("tools.toolNameUsageTip")}>
                      <span className="text-gray-500">{item.tool_name}</span>
                    </TooltipPlus>
                  </div>
                </div>
                <div className="ml-1 flex shrink-0 items-center">
                  {item.isDeleted || item.notAuthor ? (
                    <div className="flex items-center">
                      <TooltipPlus
                        popupContent={t(
                          `tools.${item.isDeleted ? "toolRemoved" : "notAuthorized"}`,
                        )}>
                        <div
                          className="mr-1 cursor-pointer rounded-md p-1 hover:bg-black/5"
                          onClick={() => {
                            if (item.notAuthor) setIsShowChooseTool(true)
                          }}>
                          <AlertTriangle className="h-4 w-4 text-[#F79009]" />
                        </div>
                      </TooltipPlus>

                      <div
                        className="cursor-pointer rounded-md p-1 hover:bg-black/5"
                        onClick={() => {
                          const newModelConfig = produce(modelConfig, draft => {
                            draft.agentConfig.tools.splice(index, 1)
                          })
                          setModelConfig(newModelConfig)
                          formattingChangedDispatcher()
                        }}>
                        <RiDeleteBinLine className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="ml-2 mr-3 h-3.5 w-px bg-gray-200"></div>
                    </div>
                  ) : (
                    <div className="hidden items-center group-hover:flex">
                      <TooltipPlus
                        popupContent={t(
                          "tools.setBuiltInTools.infoAndSetting",
                        )}>
                        <div
                          className="mr-1 cursor-pointer rounded-md p-1 hover:bg-black/5"
                          onClick={() => {
                            setCurrentTool(item)
                            setIsShowSettingTool(true)
                          }}>
                          <InfoCircle className="h-4 w-4 text-gray-500" />
                        </div>
                      </TooltipPlus>

                      <div
                        className="cursor-pointer rounded-md p-1 hover:bg-black/5"
                        onClick={() => {
                          const newModelConfig = produce(modelConfig, draft => {
                            draft.agentConfig.tools.splice(index, 1)
                          })
                          setModelConfig(newModelConfig)
                          formattingChangedDispatcher()
                        }}>
                        <RiDeleteBinLine className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="ml-2 mr-3 h-3.5 w-px bg-gray-200"></div>
                    </div>
                  )}
                  <div
                    className={cn(
                      (item.isDeleted || item.notAuthor) && "opacity-50",
                    )}>
                    <Switch
                      defaultValue={
                        item.isDeleted || item.notAuthor ? false : item.enabled
                      }
                      disabled={item.isDeleted || item.notAuthor}
                      size="md"
                      onChange={enabled => {
                        const newModelConfig = produce(modelConfig, draft => {
                          ;(draft.agentConfig.tools[index] as any).enabled =
                            enabled
                        })
                        setModelConfig(newModelConfig)
                        formattingChangedDispatcher()
                      }}
                    />
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </Panel>
      {isShowChooseTool && (
        <AddToolModal onHide={() => setIsShowChooseTool(false)} />
      )}
      {isShowSettingTool && (
        <SettingBuiltInTool
          toolName={currentTool?.tool_name as string}
          setting={currentTool?.tool_parameters as any}
          collection={currentTool?.collection as Collection}
          isBuiltIn={currentTool?.collection?.type === CollectionType.builtIn}
          isModel={currentTool?.collection?.type === CollectionType.model}
          onSave={handleToolSettingChange}
          onHide={() => setIsShowSettingTool(false)}
        />
      )}
    </>
  )
}
export default React.memo(AgentTools)
