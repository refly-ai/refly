"use client"
import type { FC } from "react"
import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { RiCloseLine } from "@remixicon/react"
import Toast from "../../base/toast"
import { ModelTypeEnum } from "../../header/account-setting/model-provider-page/declarations"
import type { RetrievalConfig } from "@/types/app"
import RetrievalMethodConfig from "@/components/datasets/common/retrieval-method-config"
import EconomicalRetrievalMethodConfig from "@/components/datasets/common/economical-retrieval-method-config"
import Button from "@/components/base/button"
import {
  ensureRerankModelSelected,
  isReRankModelSelected,
} from "@/components/datasets/common/check-rerank-model"
import { useModelListAndDefaultModelAndCurrentProviderAndModel } from "@/components/header/account-setting/model-provider-page/hooks"

type Props = {
  indexMethod: string
  value: RetrievalConfig
  isShow: boolean
  onHide: () => void
  onSave: (value: RetrievalConfig) => void
}

const ModifyRetrievalModal: FC<Props> = ({
  indexMethod,
  value,
  isShow,
  onHide,
  onSave,
}) => {
  const ref = useRef(null)
  const { t } = useTranslation()
  const [retrievalConfig, setRetrievalConfig] = useState(value)

  // useClickAway(() => {
  //   if (ref)
  //     onHide()
  // }, ref)

  const {
    modelList: rerankModelList,
    defaultModel: rerankDefaultModel,
    currentModel: isRerankDefaultModelVaild,
  } = useModelListAndDefaultModelAndCurrentProviderAndModel(
    ModelTypeEnum.rerank,
  )

  const handleSave = () => {
    if (
      !isReRankModelSelected({
        rerankDefaultModel,
        isRerankDefaultModelVaild: !!isRerankDefaultModelVaild,
        rerankModelList,
        retrievalConfig,
        indexMethod,
      })
    ) {
      Toast.notify({
        type: "error",
        message: t("appDebug.datasetConfig.rerankModelRequired"),
      })
      return
    }
    onSave(
      ensureRerankModelSelected({
        rerankDefaultModel: rerankDefaultModel!,
        retrievalConfig,
        indexMethod,
      }),
    )
  }

  if (!isShow) return null

  return (
    <div
      className="flex w-full flex-col rounded-xl border-[0.5px] border-gray-200 bg-white shadow-xl"
      style={{
        height: "calc(100vh - 72px)",
      }}
      ref={ref}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-b-gray-100 pl-6 pr-5">
        <div className="text-base font-semibold text-gray-900">
          <div>{t("datasetSettings.form.retrievalSetting.title")}</div>
          <div className="text-xs font-normal leading-[18px] text-gray-500">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.dify.ai/features/retrieval-augment"
              className="text-[#155eef]">
              {t("datasetSettings.form.retrievalSetting.learnMore")}
            </a>
            {t("datasetSettings.form.retrievalSetting.description")}
          </div>
        </div>
        <div className="flex items-center">
          <div
            onClick={onHide}
            className="flex h-6 w-6 cursor-pointer items-center justify-center">
            <RiCloseLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>

      <div
        className="border-b p-6"
        style={{
          borderBottom: "rgba(0, 0, 0, 0.05)",
        }}>
        {indexMethod === "high_quality" ? (
          <RetrievalMethodConfig
            value={retrievalConfig}
            onChange={setRetrievalConfig}
          />
        ) : (
          <EconomicalRetrievalMethodConfig
            value={retrievalConfig}
            onChange={setRetrievalConfig}
          />
        )}
      </div>
      <div
        className="flex justify-end border-t px-6 pt-6"
        style={{
          borderColor: "rgba(0, 0, 0, 0.05)",
        }}>
        <Button className="mr-2 flex-shrink-0" onClick={onHide}>
          {t("common.operation.cancel")}
        </Button>
        <Button
          variant="primary"
          className="flex-shrink-0"
          onClick={handleSave}>
          {t("common.operation.save")}
        </Button>
      </div>
    </div>
  )
}
export default React.memo(ModifyRetrievalModal)
