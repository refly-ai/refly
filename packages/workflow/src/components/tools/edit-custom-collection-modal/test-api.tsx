"use client"
import type { FC } from "react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import { Settings01 } from "../../base/icons/src/vender/line/general"
import ConfigCredentials from "./config-credentials"
import {
  AuthType,
  type Credential,
  type CustomCollectionBackend,
  type CustomParamSchema,
} from "@/components/tools/types"
import Button from "@/components/base/button"
import Drawer from "@/components/base/drawer-plus"
import I18n from "@/context/i18n"
import { testAPIAvailable } from "@/service/tools"
import { getLanguage } from "@/i18n/language"

type Props = {
  positionCenter?: boolean
  customCollection: CustomCollectionBackend
  tool: CustomParamSchema
  onHide: () => void
}

const keyClassNames = "py-2 leading-5 text-sm font-medium text-gray-900"

const TestApi: FC<Props> = ({
  positionCenter,
  customCollection,
  tool,
  onHide,
}) => {
  const { t } = useTranslation()
  const { locale } = useContext(I18n)
  const language = getLanguage(locale)
  const [credentialsModalShow, setCredentialsModalShow] = useState(false)
  const [tempCredential, setTempCredential] = React.useState<Credential>(
    customCollection.credentials,
  )
  const [result, setResult] = useState<string>("")
  const { operation_id: toolName, parameters } = tool
  const [parametersValue, setParametersValue] = useState<
    Record<string, string>
  >({})
  const handleTest = async () => {
    // clone test schema
    const credentials = JSON.parse(JSON.stringify(tempCredential)) as Credential
    if (credentials.auth_type === AuthType.none) {
      delete credentials.api_key_header_prefix
      delete credentials.api_key_header
      delete credentials.api_key_value
    }
    const data = {
      provider_name: customCollection.provider,
      tool_name: toolName,
      credentials,
      schema_type: customCollection.schema_type,
      schema: customCollection.schema,
      parameters: parametersValue,
    }
    const res = (await testAPIAvailable(data)) as any
    setResult(res.error || res.result)
  }

  return (
    <>
      <Drawer
        isShow
        positionCenter={positionCenter}
        onHide={onHide}
        title={`${t("tools.test.title")}  ${toolName}`}
        panelClassName="mt-2 !w-[600px]"
        maxWidthClassName="!max-w-[600px]"
        height="calc(100vh - 16px)"
        headerClassName="!border-b-black/5"
        body={
          <div className="overflow-y-auto px-6 pt-2">
            <div className="space-y-4">
              <div>
                <div className={keyClassNames}>
                  {t("tools.createTool.authMethod.title")}
                </div>
                <div
                  className="flex h-9 cursor-pointer items-center justify-between rounded-lg bg-gray-100 px-2.5"
                  onClick={() => setCredentialsModalShow(true)}>
                  <div className="text-sm font-normal text-gray-900">
                    {t(
                      `tools.createTool.authMethod.types.${tempCredential.auth_type}`,
                    )}
                  </div>
                  <Settings01 className="h-4 w-4 text-gray-700 opacity-60" />
                </div>
              </div>

              <div>
                <div className={keyClassNames}>
                  {t("tools.test.parametersValue")}
                </div>
                <div className="rounded-lg border border-gray-200">
                  <table className="w-full text-xs font-normal leading-[18px] text-gray-700">
                    <thead className="uppercase text-gray-500">
                      <tr className="border-b border-gray-200">
                        <th className="p-2 pl-3 font-medium">
                          {t("tools.test.parameters")}
                        </th>
                        <th className="p-2 pl-3 font-medium">
                          {t("tools.test.value")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parameters.map((item, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-200 last:border-0">
                          <td className="py-2 pl-3 pr-2.5">
                            {item.label[language]}
                          </td>
                          <td className="">
                            <input
                              value={parametersValue[item.name] || ""}
                              onChange={e =>
                                setParametersValue({
                                  ...parametersValue,
                                  [item.name]: e.target.value,
                                })
                              }
                              type="text"
                              className="h-[34px] w-full px-3 outline-none focus:bg-gray-100"></input>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-4 h-10 w-full"
              onClick={handleTest}>
              {t("tools.test.title")}
            </Button>
            <div className="mt-6">
              <div className="flex items-center space-x-3">
                <div className="text-xs font-semibold leading-[18px] text-gray-500">
                  {t("tools.test.testResult")}
                </div>
                <div className="bg-[rgb(243, 244, 246)] h-px w-0 grow"></div>
              </div>
              <div className="mt-2 h-[200px] overflow-y-auto overflow-x-hidden rounded-lg bg-gray-100 px-3 py-2 text-xs font-normal leading-4 text-gray-700">
                {result || (
                  <span className="text-gray-400">
                    {t("tools.test.testResultPlaceholder")}
                  </span>
                )}
              </div>
            </div>
          </div>
        }
      />
      {credentialsModalShow && (
        <ConfigCredentials
          positionCenter={positionCenter}
          credential={tempCredential}
          onChange={setTempCredential}
          onHide={() => setCredentialsModalShow(false)}
        />
      )}
    </>
  )
}
export default React.memo(TestApi)
