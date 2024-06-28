"use client"
import type { FC } from "react"
import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiArrowDownSLine } from "@remixicon/react"
import type { MultipleRetrievalConfig, SingleRetrievalConfig } from "../types"
import type { ModelConfig } from "../../../types"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import ConfigRetrievalContent from "@/components/configuration/dataset-config/params-config/config-content"
import { RETRIEVE_TYPE } from "@/types/app"
import { DATASET_DEFAULT } from "@/config"
import { useModelListAndDefaultModelAndCurrentProviderAndModel } from "@/components/header/account-setting/model-provider-page/hooks"
import { ModelTypeEnum } from "@/components/header/account-setting/model-provider-page/declarations"

import type { DatasetConfigs } from "@/models/debug"

type Props = {
  payload: {
    retrieval_mode: RETRIEVE_TYPE
    multiple_retrieval_config?: MultipleRetrievalConfig
    single_retrieval_config?: SingleRetrievalConfig
  }
  onRetrievalModeChange: (mode: RETRIEVE_TYPE) => void
  onMultipleRetrievalConfigChange: (config: MultipleRetrievalConfig) => void
  singleRetrievalModelConfig?: ModelConfig
  onSingleRetrievalModelChange?: (config: ModelConfig) => void
  onSingleRetrievalModelParamsChange?: (config: ModelConfig) => void
  readonly?: boolean
}

const RetrievalConfig: FC<Props> = ({
  payload,
  onRetrievalModeChange,
  onMultipleRetrievalConfigChange,
  singleRetrievalModelConfig,
  onSingleRetrievalModelChange,
  onSingleRetrievalModelParamsChange,
  readonly,
}) => {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const { defaultModel: rerankDefaultModel } =
    useModelListAndDefaultModelAndCurrentProviderAndModel(ModelTypeEnum.rerank)

  const { multiple_retrieval_config } = payload
  const handleChange = useCallback(
    (configs: DatasetConfigs, isRetrievalModeChange?: boolean) => {
      if (isRetrievalModeChange) {
        onRetrievalModeChange(configs.retrieval_model)
        return
      }
      onMultipleRetrievalConfigChange({
        top_k: configs.top_k,
        score_threshold: configs.score_threshold_enabled
          ? configs.score_threshold || DATASET_DEFAULT.score_threshold
          : null,
        reranking_model:
          payload.retrieval_mode === RETRIEVE_TYPE.oneWay
            ? undefined
            : !configs.reranking_model?.reranking_provider_name
              ? {
                  provider: rerankDefaultModel?.provider?.provider || "",
                  model: rerankDefaultModel?.model || "",
                }
              : {
                  provider: configs.reranking_model?.reranking_provider_name,
                  model: configs.reranking_model?.reranking_model_name,
                },
      })
    },
    [
      onMultipleRetrievalConfigChange,
      payload.retrieval_mode,
      rerankDefaultModel?.provider?.provider,
      rerankDefaultModel?.model,
      onRetrievalModeChange,
    ],
  )

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={{
        // mainAxis: 12,
        crossAxis: -2,
      }}>
      <PortalToFollowElemTrigger
        onClick={() => {
          if (readonly) return
          setOpen(v => !v)
        }}>
        <div
          className={cn(
            !readonly && "cursor-pointer",
            open && "bg-gray-100",
            "group flex h-6 select-none items-center rounded-md px-2 hover:bg-gray-100",
          )}>
          <div
            className={cn(
              open ? "text-gray-700" : "text-gray-500",
              "text-xs font-medium leading-[18px] group-hover:bg-gray-100",
            )}>
            {payload.retrieval_mode === RETRIEVE_TYPE.oneWay
              ? t("appDebug.datasetConfig.retrieveOneWay.title")
              : t("appDebug.datasetConfig.retrieveMultiWay.title")}
          </div>
          {!readonly && <RiArrowDownSLine className="ml-1 h-3 w-3" />}
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent style={{ zIndex: 1001 }}>
        <div className="w-[404px] rounded-2xl border border-gray-200 bg-white px-4 pb-4 pt-3 shadow-xl">
          <ConfigRetrievalContent
            datasetConfigs={{
              retrieval_model: payload.retrieval_mode,
              reranking_model: !multiple_retrieval_config?.reranking_model
                ?.provider
                ? {
                    reranking_provider_name:
                      rerankDefaultModel?.provider?.provider || "",
                    reranking_model_name: rerankDefaultModel?.model || "",
                  }
                : {
                    reranking_provider_name:
                      multiple_retrieval_config?.reranking_model?.provider ||
                      "",
                    reranking_model_name:
                      multiple_retrieval_config?.reranking_model?.model || "",
                  },
              top_k: multiple_retrieval_config?.top_k || DATASET_DEFAULT.top_k,
              score_threshold_enabled: !(
                multiple_retrieval_config?.score_threshold === undefined ||
                multiple_retrieval_config?.score_threshold === null
              ),
              score_threshold: multiple_retrieval_config?.score_threshold,
              datasets: {
                datasets: [],
              },
            }}
            onChange={handleChange}
            isInWorkflow
            singleRetrievalModelConfig={singleRetrievalModelConfig}
            onSingleRetrievalModelChange={onSingleRetrievalModelChange}
            onSingleRetrievalModelParamsChange={
              onSingleRetrievalModelParamsChange
            }
          />
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}
export default React.memo(RetrievalConfig)
