import { RETRIEVE_METHOD, type RetrievalConfig } from "@/types/app"
import type {
  DefaultModelResponse,
  Model,
} from "@/components/header/account-setting/model-provider-page/declarations"

export const isReRankModelSelected = ({
  rerankDefaultModel,
  isRerankDefaultModelVaild,
  retrievalConfig,
  rerankModelList,
  indexMethod,
}: {
  rerankDefaultModel?: DefaultModelResponse
  isRerankDefaultModelVaild: boolean
  retrievalConfig: RetrievalConfig
  rerankModelList: Model[]
  indexMethod?: string
}) => {
  const rerankModelSelected = (() => {
    if (retrievalConfig.reranking_model?.reranking_model_name) {
      const provider = rerankModelList.find(
        ({ provider }) =>
          provider === retrievalConfig.reranking_model?.reranking_provider_name,
      )

      return provider?.models.find(
        ({ model }) =>
          model === retrievalConfig.reranking_model?.reranking_model_name,
      )
    }

    if (isRerankDefaultModelVaild) return !!rerankDefaultModel

    return false
  })()

  if (
    indexMethod === "high_quality" &&
    (retrievalConfig.reranking_enable ||
      retrievalConfig.search_method === RETRIEVE_METHOD.hybrid) &&
    !rerankModelSelected
  )
    return false

  return true
}

export const ensureRerankModelSelected = ({
  rerankDefaultModel,
  indexMethod,
  retrievalConfig,
}: {
  rerankDefaultModel: DefaultModelResponse
  retrievalConfig: RetrievalConfig
  indexMethod?: string
}) => {
  const rerankModel = retrievalConfig.reranking_model?.reranking_model_name
    ? retrievalConfig.reranking_model
    : undefined
  if (
    indexMethod === "high_quality" &&
    (retrievalConfig.reranking_enable ||
      retrievalConfig.search_method === RETRIEVE_METHOD.hybrid) &&
    !rerankModel
  ) {
    return {
      ...retrievalConfig,
      reranking_model: {
        reranking_provider_name: rerankDefaultModel.provider.provider,
        reranking_model_name: rerankDefaultModel.model,
      },
    }
  }
  return retrievalConfig
}
