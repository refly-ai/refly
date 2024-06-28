"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import { RiQuestionLine } from "@remixicon/react"
import { useContext } from "use-context-selector"
import Panel from "../base/feature-panel"
import ParamConfig from "./param-config"
import Tooltip from "@/components/base/tooltip"
import Switch from "@/components/base/switch"
import { Eye } from "@/components/base/icons/src/vender/solid/general"
import ConfigContext from "@/context/debug-configuration"

const ConfigVision: FC = () => {
  const { t } = useTranslation()
  const { isShowVisionConfig, visionConfig, setVisionConfig } =
    useContext(ConfigContext)

  if (!isShowVisionConfig) return null

  return (
    <>
      <Panel
        className="mt-4"
        headerIcon={<Eye className="h-4 w-4 text-[#6938EF]" />}
        title={
          <div className="flex items-center">
            <div className="mr-1">{t("appDebug.vision.name")}</div>
            <Tooltip
              htmlContent={
                <div className="w-[180px]">
                  {t("appDebug.vision.description")}
                </div>
              }
              selector="config-vision-tooltip">
              <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
            </Tooltip>
          </div>
        }
        headerRight={
          <div className="flex items-center">
            <ParamConfig />
            <div className="ml-4 mr-3 h-3.5 w-[1px] bg-gray-200"></div>
            <Switch
              defaultValue={visionConfig.enabled}
              onChange={value =>
                setVisionConfig({
                  ...visionConfig,
                  enabled: value,
                })
              }
              size="md"
            />
          </div>
        }
        noBodySpacing
      />
    </>
  )
}
export default React.memo(ConfigVision)
