"use client"
import type { FC } from "react"
import React from "react"
import { useContext } from "use-context-selector"
import { useTranslation } from "react-i18next"
import { RiQuestionLine } from "@remixicon/react"
import RadioGroup from "./radio-group"
import ConfigContext from "@/context/debug-configuration"
import { Resolution, TransferMethod } from "@/types/app"
import ParamItem from "@/components/base/param-item"
import Tooltip from "@/components/base/tooltip"

const MIN = 1
const MAX = 6
const ParamConfigContent: FC = () => {
  const { t } = useTranslation()

  const { visionConfig, setVisionConfig } = useContext(ConfigContext)

  const transferMethod = (() => {
    if (
      !visionConfig.transfer_methods ||
      visionConfig.transfer_methods.length === 2
    )
      return TransferMethod.all

    return visionConfig.transfer_methods[0]
  })()

  return (
    <div>
      <div>
        <div className="text-base font-semibold leading-6 text-gray-800">
          {t("appDebug.vision.visionSettings.title")}
        </div>
        <div className="space-y-6 pt-3">
          <div>
            <div className="mb-2 flex items-center space-x-1">
              <div className="text-[13px] font-semibold leading-[18px] text-gray-800">
                {t("appDebug.vision.visionSettings.resolution")}
              </div>
              <Tooltip
                htmlContent={
                  <div className="w-[180px]">
                    {t("appDebug.vision.visionSettings.resolutionTooltip")
                      .split("\n")
                      .map(item => (
                        <div key={item}>{item}</div>
                      ))}
                  </div>
                }
                selector="config-resolution-tooltip">
                <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
              </Tooltip>
            </div>
            <RadioGroup
              className="space-x-3"
              options={[
                {
                  label: t("appDebug.vision.visionSettings.high"),
                  value: Resolution.high,
                },
                {
                  label: t("appDebug.vision.visionSettings.low"),
                  value: Resolution.low,
                },
              ]}
              value={visionConfig.detail}
              onChange={(value: Resolution) => {
                setVisionConfig({
                  ...visionConfig,
                  detail: value,
                })
              }}
            />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold leading-[18px] text-gray-800">
              {t("appDebug.vision.visionSettings.uploadMethod")}
            </div>
            <RadioGroup
              className="space-x-3"
              options={[
                {
                  label: t("appDebug.vision.visionSettings.both"),
                  value: TransferMethod.all,
                },
                {
                  label: t("appDebug.vision.visionSettings.localUpload"),
                  value: TransferMethod.local_file,
                },
                {
                  label: t("appDebug.vision.visionSettings.url"),
                  value: TransferMethod.remote_url,
                },
              ]}
              value={transferMethod}
              onChange={(value: TransferMethod) => {
                if (value === TransferMethod.all) {
                  setVisionConfig({
                    ...visionConfig,
                    transfer_methods: [
                      TransferMethod.remote_url,
                      TransferMethod.local_file,
                    ],
                  })
                  return
                }
                setVisionConfig({
                  ...visionConfig,
                  transfer_methods: [value],
                })
              }}
            />
          </div>
          <div>
            <ParamItem
              id="upload_limit"
              className=""
              name={t("appDebug.vision.visionSettings.uploadLimit")}
              noTooltip
              {...{
                default: 2,
                step: 1,
                min: MIN,
                max: MAX,
              }}
              value={visionConfig.number_limits}
              enable={true}
              onChange={(_key: string, value: number) => {
                if (!value) return

                setVisionConfig({
                  ...visionConfig,
                  number_limits: value,
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(ParamConfigContent)
