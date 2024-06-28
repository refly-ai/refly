"use client"
import type { FC } from "react"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce, useGetState } from "ahooks"
import cn from "classnames"
import produce from "immer"
import {
  LinkExternal02,
  Settings01,
} from "../../base/icons/src/vender/line/general"
import type {
  Credential,
  CustomCollectionBackend,
  CustomParamSchema,
  Emoji,
} from "../types"
import { AuthHeaderPrefix, AuthType } from "../types"
import GetSchema from "./get-schema"
import ConfigCredentials from "./config-credentials"
import TestApi from "./test-api"
import Drawer from "@/components/base/drawer-plus"
import Button from "@/components/base/button"
import EmojiPicker from "@/components/base/emoji-picker"
import AppIcon from "@/components/base/app-icon"
import { parseParamsSchema } from "@/service/tools"
import LabelSelector from "@/components/tools/labels/selector"

const fieldNameClassNames = "py-2 leading-5 text-sm font-medium text-gray-900"
type Props = {
  positionLeft?: boolean
  payload: any
  onHide: () => void
  onAdd?: (payload: CustomCollectionBackend) => void
  onRemove?: () => void
  onEdit?: (payload: CustomCollectionBackend) => void
}
// Add and Edit
const EditCustomCollectionModal: FC<Props> = ({
  positionLeft,
  payload,
  onHide,
  onAdd,
  onEdit,
  onRemove,
}) => {
  const { t } = useTranslation()
  const isAdd = !payload
  const isEdit = !!payload

  const [editFirst, setEditFirst] = useState(!isAdd)
  const [paramsSchemas, setParamsSchemas] = useState<CustomParamSchema[]>(
    payload?.tools || [],
  )
  const [customCollection, setCustomCollection, getCustomCollection] =
    useGetState<CustomCollectionBackend>(
      isAdd
        ? {
            provider: "",
            credentials: {
              auth_type: AuthType.none,
              api_key_header: "Authorization",
              api_key_header_prefix: AuthHeaderPrefix.basic,
            },
            icon: {
              content: "🕵️",
              background: "#FEF7C3",
            },
            schema_type: "",
            schema: "",
          }
        : payload,
    )

  const originalProvider = isEdit ? payload.provider : ""

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emoji = customCollection.icon
  const setEmoji = (emoji: Emoji) => {
    const newCollection = produce(customCollection, draft => {
      draft.icon = emoji
    })
    setCustomCollection(newCollection)
  }
  const schema = customCollection.schema
  const debouncedSchema = useDebounce(schema, { wait: 500 })
  const setSchema = (schema: string) => {
    const newCollection = produce(customCollection, draft => {
      draft.schema = schema
    })
    setCustomCollection(newCollection)
  }

  useEffect(() => {
    if (!debouncedSchema) return
    if (isEdit && editFirst) {
      setEditFirst(false)
      return
    }
    ;(async () => {
      const customCollection = getCustomCollection()
      try {
        const { parameters_schema, schema_type } =
          await parseParamsSchema(debouncedSchema)
        const newCollection = produce(customCollection, draft => {
          draft.schema_type = schema_type
        })
        setCustomCollection(newCollection)
        setParamsSchemas(parameters_schema)
      } catch (e) {
        const newCollection = produce(customCollection, draft => {
          draft.schema_type = ""
        })
        setCustomCollection(newCollection)
        setParamsSchemas([])
      }
    })()
  }, [debouncedSchema])

  const [credentialsModalShow, setCredentialsModalShow] = useState(false)
  const credential = customCollection.credentials
  const setCredential = (credential: Credential) => {
    const newCollection = produce(customCollection, draft => {
      draft.credentials = credential
    })
    setCustomCollection(newCollection)
  }

  const [currTool, setCurrTool] = useState<CustomParamSchema | null>(null)
  const [isShowTestApi, setIsShowTestApi] = useState(false)

  const [labels, setLabels] = useState<string[]>(payload?.labels || [])
  const handleLabelSelect = (value: string[]) => {
    setLabels(value)
  }

  const handleSave = () => {
    // const postData = clone(customCollection)
    const postData = produce(customCollection, draft => {
      delete draft.tools

      if (draft.credentials.auth_type === AuthType.none) {
        delete draft.credentials.api_key_header
        delete draft.credentials.api_key_header_prefix
        delete draft.credentials.api_key_value
      }

      draft.labels = labels
    })

    if (isAdd) {
      onAdd?.(postData)
      return
    }

    onEdit?.({
      ...postData,
      original_provider: originalProvider,
    })
  }

  const getPath = (url: string) => {
    if (!url) return ""

    try {
      const path = new URL(url).pathname
      return path || ""
    } catch (e) {
      return url
    }
  }

  return (
    <>
      <Drawer
        isShow
        positionCenter={isAdd && !positionLeft}
        onHide={onHide}
        title={t(`tools.createTool.${isAdd ? "title" : "editTitle"}`)!}
        panelClassName="mt-2 !w-[630px]"
        maxWidthClassName="!max-w-[630px]"
        height="calc(100vh - 16px)"
        headerClassName="!border-b-black/5"
        body={
          <div className="flex h-full flex-col">
            <div className="h-0 grow space-y-4 overflow-y-auto px-6 py-3">
              <div>
                <div className={fieldNameClassNames}>
                  {t("tools.createTool.name")}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <AppIcon
                    size="large"
                    onClick={() => {
                      setShowEmojiPicker(true)
                    }}
                    className="cursor-pointer"
                    icon={emoji.content}
                    background={emoji.background}
                  />
                  <input
                    className="h-10 grow rounded-lg bg-gray-100 px-3 text-sm font-normal"
                    placeholder={t("tools.createTool.toolNamePlaceHolder")!}
                    value={customCollection.provider}
                    onChange={e => {
                      const newCollection = produce(customCollection, draft => {
                        draft.provider = e.target.value
                      })
                      setCustomCollection(newCollection)
                    }}
                  />
                </div>
              </div>

              {/* Schema */}
              <div className="select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={fieldNameClassNames}>
                      {t("tools.createTool.schema")}
                    </div>
                    <div className="mx-2 h-3 w-px bg-black/5"></div>
                    <a
                      href="https://swagger.io/specification/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-[18px] items-center space-x-1 text-[#155EEF]">
                      <div className="text-xs font-normal">
                        {t("tools.createTool.viewSchemaSpec")}
                      </div>
                      <LinkExternal02 className="h-3 w-3" />
                    </a>
                  </div>
                  <GetSchema onChange={setSchema} />
                </div>
                <textarea
                  value={schema}
                  onChange={e => setSchema(e.target.value)}
                  className="h-[240px] w-full overflow-y-auto rounded-lg bg-gray-100 px-3 py-2 text-xs font-normal leading-4 text-gray-900"
                  placeholder={
                    t("tools.createTool.schemaPlaceHolder")!
                  }></textarea>
              </div>

              {/* Available Tools  */}
              <div>
                <div className={fieldNameClassNames}>
                  {t("tools.createTool.availableTools.title")}
                </div>
                <div className="w-full overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs font-normal leading-[18px] text-gray-700">
                    <thead className="uppercase text-gray-500">
                      <tr
                        className={cn(
                          paramsSchemas.length > 0 && "border-b",
                          "border-gray-200",
                        )}>
                        <th className="p-2 pl-3 font-medium">
                          {t("tools.createTool.availableTools.name")}
                        </th>
                        <th className="w-[236px] p-2 pl-3 font-medium">
                          {t("tools.createTool.availableTools.description")}
                        </th>
                        <th className="p-2 pl-3 font-medium">
                          {t("tools.createTool.availableTools.method")}
                        </th>
                        <th className="p-2 pl-3 font-medium">
                          {t("tools.createTool.availableTools.path")}
                        </th>
                        <th className="w-[54px] p-2 pl-3 font-medium">
                          {t("tools.createTool.availableTools.action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paramsSchemas.map((item, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-200 last:border-0">
                          <td className="p-2 pl-3">{item.operation_id}</td>
                          <td className="w-[236px] p-2 pl-3 text-gray-500">
                            {item.summary}
                          </td>
                          <td className="p-2 pl-3">{item.method}</td>
                          <td className="p-2 pl-3">
                            {getPath(item.server_url)}
                          </td>
                          <td className="w-[62px] p-2 pl-3">
                            <Button
                              size="small"
                              onClick={() => {
                                setCurrTool(item)
                                setIsShowTestApi(true)
                              }}>
                              {t("tools.createTool.availableTools.test")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Authorization method */}
              <div>
                <div className={fieldNameClassNames}>
                  {t("tools.createTool.authMethod.title")}
                </div>
                <div
                  className="flex h-9 cursor-pointer items-center justify-between rounded-lg bg-gray-100 px-2.5"
                  onClick={() => setCredentialsModalShow(true)}>
                  <div className="text-sm font-normal text-gray-900">
                    {t(
                      `tools.createTool.authMethod.types.${credential.auth_type}`,
                    )}
                  </div>
                  <Settings01 className="h-4 w-4 text-gray-700 opacity-60" />
                </div>
              </div>

              {/* Labels */}
              <div>
                <div className="py-2 text-sm font-medium leading-5 text-gray-900">
                  {t("tools.createTool.toolInput.label")}
                </div>
                <LabelSelector value={labels} onChange={handleLabelSelect} />
              </div>

              {/* Privacy Policy */}
              <div>
                <div className={fieldNameClassNames}>
                  {t("tools.createTool.privacyPolicy")}
                </div>
                <input
                  value={customCollection.privacy_policy}
                  onChange={e => {
                    const newCollection = produce(customCollection, draft => {
                      draft.privacy_policy = e.target.value
                    })
                    setCustomCollection(newCollection)
                  }}
                  className="h-10 w-full grow rounded-lg bg-gray-100 px-3 text-sm font-normal"
                  placeholder={
                    t("tools.createTool.privacyPolicyPlaceholder") || ""
                  }
                />
              </div>

              <div>
                <div className={fieldNameClassNames}>
                  {t("tools.createTool.customDisclaimer")}
                </div>
                <input
                  value={customCollection.custom_disclaimer}
                  onChange={e => {
                    const newCollection = produce(customCollection, draft => {
                      draft.custom_disclaimer = e.target.value
                    })
                    setCustomCollection(newCollection)
                  }}
                  className="h-10 w-full grow rounded-lg bg-gray-100 px-3 text-sm font-normal"
                  placeholder={
                    t("tools.createTool.customDisclaimerPlaceholder") || ""
                  }
                />
              </div>
            </div>
            <div
              className={cn(
                isEdit ? "justify-between" : "justify-end",
                "mt-2 flex shrink-0 rounded-b-[10px] border-t border-black/5 bg-gray-50 px-6 py-4",
              )}>
              {isEdit && (
                <Button
                  onClick={onRemove}
                  className="border-red-50 text-red-500 hover:border-red-500">
                  {t("common.operation.delete")}
                </Button>
              )}
              <div className="flex space-x-2">
                <Button onClick={onHide}>{t("common.operation.cancel")}</Button>
                <Button variant="primary" onClick={handleSave}>
                  {t("common.operation.save")}
                </Button>
              </div>
            </div>
          </div>
        }
        isShowMask={true}
        clickOutsideNotOpen={true}
      />
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(icon, icon_background) => {
            setEmoji({ content: icon, background: icon_background })
            setShowEmojiPicker(false)
          }}
          onClose={() => {
            setShowEmojiPicker(false)
          }}
        />
      )}
      {credentialsModalShow && (
        <ConfigCredentials
          positionCenter={isAdd}
          credential={credential}
          onChange={setCredential}
          onHide={() => setCredentialsModalShow(false)}
        />
      )}
      {isShowTestApi && (
        <TestApi
          positionCenter={isAdd}
          tool={currTool as CustomParamSchema}
          customCollection={customCollection}
          onHide={() => setIsShowTestApi(false)}
        />
      )}
    </>
  )
}
export default React.memo(EditCustomCollectionModal)
