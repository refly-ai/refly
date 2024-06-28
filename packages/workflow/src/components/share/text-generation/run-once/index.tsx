import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { PlayIcon } from "@heroicons/react/24/solid"
import Select from "@/components/select"
import type { SiteInfo } from "@/models/share"
import type { PromptConfig } from "@/models/debug"
import Button from "@/components/button"
import { DEFAULT_VALUE_MAX_LEN } from "@/config"
import TextGenerationImageUploader from "@/components/image-uploader/text-generation-image-uploader"
import type { VisionFile, VisionSettings } from "@/types/app"

export type IRunOnceProps = {
  siteInfo: SiteInfo
  promptConfig: PromptConfig
  inputs: Record<string, any>
  onInputsChange: (inputs: Record<string, any>) => void
  onSend: () => void
  visionConfig: VisionSettings
  onVisionFilesChange: (files: VisionFile[]) => void
}
const RunOnce: FC<IRunOnceProps> = ({
  promptConfig,
  inputs,
  onInputsChange,
  onSend,
  visionConfig,
  onVisionFilesChange,
}) => {
  const { t } = useTranslation()

  const onClear = () => {
    const newInputs: Record<string, any> = {}
    promptConfig.prompt_variables.forEach(item => {
      newInputs[item.key] = ""
    })
    onInputsChange(newInputs)
  }

  return (
    <div className="">
      <section>
        {/* input form */}
        <form>
          {promptConfig.prompt_variables.map(item => (
            <div className="mt-4 w-full" key={item.key}>
              <label className="text-sm font-medium text-gray-900">
                {item.name}
              </label>
              <div className="mt-2">
                {item.type === "select" && (
                  <Select
                    className="w-full"
                    defaultValue={inputs[item.key]}
                    onSelect={i => {
                      onInputsChange({ ...inputs, [item.key]: i.value })
                    }}
                    items={(item.options || []).map(i => ({
                      name: i,
                      value: i,
                    }))}
                    allowSearch={false}
                    bgClassName="bg-gray-50"
                  />
                )}
                {item.type === "string" && (
                  <input
                    type="text"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 sm:text-xs"
                    placeholder={`${item.name}${!item.required ? `(${t("appDebug.variableTable.optional")})` : ""}`}
                    value={inputs[item.key]}
                    onChange={e => {
                      onInputsChange({ ...inputs, [item.key]: e.target.value })
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        onSend()
                      }
                    }}
                    maxLength={item.max_length || DEFAULT_VALUE_MAX_LEN}
                  />
                )}
                {item.type === "paragraph" && (
                  <textarea
                    className="block h-[104px] w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 sm:text-xs"
                    placeholder={`${item.name}${!item.required ? `(${t("appDebug.variableTable.optional")})` : ""}`}
                    value={inputs[item.key]}
                    onChange={e => {
                      onInputsChange({ ...inputs, [item.key]: e.target.value })
                    }}
                  />
                )}
                {item.type === "number" && (
                  <input
                    type="number"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 sm:text-xs"
                    placeholder={`${item.name}${!item.required ? `(${t("appDebug.variableTable.optional")})` : ""}`}
                    value={inputs[item.key]}
                    onChange={e => {
                      onInputsChange({ ...inputs, [item.key]: e.target.value })
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {visionConfig?.enabled && (
            <div className="mt-4 w-full">
              <div className="text-sm font-medium text-gray-900">
                {t("common.imageUploader.imageUpload")}
              </div>
              <div className="mt-2">
                <TextGenerationImageUploader
                  settings={visionConfig}
                  onFilesChange={files =>
                    onVisionFilesChange(
                      files
                        .filter(file => file.progress !== -1)
                        .map(fileItem => ({
                          type: "image",
                          transfer_method: fileItem.type,
                          url: fileItem.url,
                          upload_file_id: fileItem.fileId,
                        })),
                    )
                  }
                />
              </div>
            </div>
          )}
          {promptConfig.prompt_variables.length > 0 && (
            <div className="mt-4 h-[1px] bg-gray-100"></div>
          )}
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between">
              <Button onClick={onClear} disabled={false}>
                <span className="text-[13px]">
                  {t("common.operation.clear")}
                </span>
              </Button>
              <Button variant="primary" onClick={onSend} disabled={false}>
                <PlayIcon
                  className="mr-1 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[13px]">{t("share.generation.run")}</span>
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
export default React.memo(RunOnce)
