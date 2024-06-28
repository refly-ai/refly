"use client"
import produce from "immer"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { OnFeaturesChange } from "../../types"
import { useFeatures, useFeaturesStore } from "../../hooks"
import ParamConfig from "./param-config"
import Switch from "@/components/base/switch"
import { File05 } from "@/components/base/icons/src/vender/solid/files"

type FileUploadProps = {
  onChange?: OnFeaturesChange
  disabled?: boolean
}
const FileUpload = ({ onChange, disabled }: FileUploadProps) => {
  const { t } = useTranslation()
  const featuresStore = useFeaturesStore()
  const file = useFeatures(s => s.features.file)

  const handleSwitch = useCallback(
    (value: boolean) => {
      const { features, setFeatures } = featuresStore!.getState()
      const newFeatures = produce(features, draft => {
        if (draft.file?.image) draft.file.image.enabled = value
      })
      setFeatures(newFeatures)

      if (onChange) onChange(newFeatures)
    },
    [featuresStore, onChange],
  )

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl bg-gray-50 px-3">
      <div className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center">
        <File05 className="h-4 w-4 shrink-0 text-[#6938EF]" />
      </div>
      <div className="mr-2 shrink-0 whitespace-nowrap text-sm font-semibold text-gray-800">
        {t("common.imageUploader.imageUpload")}
      </div>
      <div className="grow" />
      <div className="flex items-center">
        <ParamConfig onChange={onChange} disabled={disabled} />
        <div className="ml-4 mr-3 h-3.5 w-[1px] bg-gray-200"></div>
        <Switch
          defaultValue={file?.image?.enabled}
          onChange={handleSwitch}
          disabled={disabled}
          size="md"
        />
      </div>
    </div>
  )
}
export default React.memo(FileUpload)
