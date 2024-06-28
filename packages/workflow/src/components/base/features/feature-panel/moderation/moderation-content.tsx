import type { FC } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import Switch from "@/components/base/switch"
import type { ModerationContentConfig } from "@/models/debug"

type ModerationContentProps = {
  title: string
  info?: string
  showPreset?: boolean
  config: ModerationContentConfig
  onConfigChange: (config: ModerationContentConfig) => void
}
const ModerationContent: FC<ModerationContentProps> = ({
  title,
  info,
  showPreset = true,
  config,
  onConfigChange,
}) => {
  const { t } = useTranslation()

  const handleConfigChange = (field: string, value: boolean | string) => {
    if (field === "preset_response" && typeof value === "string")
      value = value.slice(0, 100)
    onConfigChange({ ...config, [field]: value })
  }

  return (
    <div className="py-2">
      <div className="rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex h-10 items-center justify-between rounded-lg px-3">
          <div className="shrink-0 text-sm font-medium text-gray-900">
            {title}
          </div>
          <div className="flex grow items-center justify-end">
            {info && (
              <div className="mr-2 truncate text-xs text-gray-500" title={info}>
                {info}
              </div>
            )}
            <Switch
              size="l"
              defaultValue={config.enabled}
              onChange={v => handleConfigChange("enabled", v)}
            />
          </div>
        </div>
        {config.enabled && showPreset && (
          <div className="rounded-lg bg-white px-3 pb-3 pt-1">
            <div className="flex h-8 items-center justify-between text-[13px] font-medium text-gray-700">
              {t("appDebug.feature.moderation.modal.content.preset")}
              <span className="text-xs font-normal text-gray-500">
                {t("appDebug.feature.moderation.modal.content.supportMarkdown")}
              </span>
            </div>
            <div className="relative h-20 rounded-lg bg-gray-100 px-3 py-2">
              <textarea
                value={config.preset_response || ""}
                className="block h-full w-full resize-none appearance-none bg-transparent text-sm outline-none"
                placeholder={
                  t("appDebug.feature.moderation.modal.content.placeholder") ||
                  ""
                }
                onChange={e =>
                  handleConfigChange("preset_response", e.target.value)
                }
              />
              <div className="absolute bottom-2 right-2 flex h-5 items-center rounded-md bg-gray-50 px-1 text-xs font-medium text-gray-300">
                <span>{(config.preset_response || "").length}</span>/
                <span className="text-gray-500">100</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ModerationContent)
