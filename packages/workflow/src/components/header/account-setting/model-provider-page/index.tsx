import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import SystemModelSelector from "./system-model-selector"
import ProviderAddedCard, {
  UPDATE_MODEL_PROVIDER_CUSTOM_MODEL_LIST,
} from "./provider-added-card"
import ProviderCard from "./provider-card"
import type {
  CustomConfigurationModelFixedFields,
  ModelProvider,
} from "./declarations"
import {
  ConfigurationMethodEnum,
  CustomConfigurationStatusEnum,
  ModelTypeEnum,
} from "./declarations"
import {
  useDefaultModel,
  useUpdateModelList,
  useUpdateModelProviders,
} from "./hooks"
import { AlertTriangle } from "@/components/base/icons/src/vender/solid/alertsAndFeedback"
import { useProviderContext } from "@/context/provider-context"
import { useModalContextSelector } from "@/context/modal-context"
import { useEventEmitterContextContext } from "@/context/event-emitter"

const ModelProviderPage = () => {
  const { t } = useTranslation()
  const { eventEmitter } = useEventEmitterContextContext()
  const updateModelProviders = useUpdateModelProviders()
  const updateModelList = useUpdateModelList()
  const { data: textGenerationDefaultModel } = useDefaultModel(
    ModelTypeEnum.textGeneration,
  )
  const { data: embeddingsDefaultModel } = useDefaultModel(
    ModelTypeEnum.textEmbedding,
  )
  const { data: rerankDefaultModel } = useDefaultModel(ModelTypeEnum.rerank)
  const { data: speech2textDefaultModel } = useDefaultModel(
    ModelTypeEnum.speech2text,
  )
  const { data: ttsDefaultModel } = useDefaultModel(ModelTypeEnum.tts)
  const { modelProviders: providers } = useProviderContext()
  const setShowModelModal = useModalContextSelector(
    state => state.setShowModelModal,
  )
  const defaultModelNotConfigured =
    !textGenerationDefaultModel &&
    !embeddingsDefaultModel &&
    !speech2textDefaultModel &&
    !rerankDefaultModel &&
    !ttsDefaultModel
  const [configedProviders, notConfigedProviders] = useMemo(() => {
    const configedProviders: ModelProvider[] = []
    const notConfigedProviders: ModelProvider[] = []

    providers.forEach(provider => {
      if (
        provider.custom_configuration.status ===
          CustomConfigurationStatusEnum.active ||
        (provider.system_configuration.enabled === true &&
          provider.system_configuration.quota_configurations.find(
            item =>
              item.quota_type ===
              provider.system_configuration.current_quota_type,
          ))
      )
        configedProviders.push(provider)
      else notConfigedProviders.push(provider)
    })

    return [configedProviders, notConfigedProviders]
  }, [providers])

  const handleOpenModal = (
    provider: ModelProvider,
    configurateMethod: ConfigurationMethodEnum,
    CustomConfigurationModelFixedFields?: CustomConfigurationModelFixedFields,
  ) => {
    setShowModelModal({
      payload: {
        currentProvider: provider,
        currentConfigurationMethod: configurateMethod,
        currentCustomConfigurationModelFixedFields:
          CustomConfigurationModelFixedFields,
      },
      onSaveCallback: () => {
        updateModelProviders()

        if (configurateMethod === ConfigurationMethodEnum.predefinedModel) {
          provider.supported_model_types.forEach(type => {
            updateModelList(type)
          })
        }

        if (
          configurateMethod === ConfigurationMethodEnum.customizableModel &&
          provider.custom_configuration.status ===
            CustomConfigurationStatusEnum.active
        ) {
          eventEmitter?.emit({
            type: UPDATE_MODEL_PROVIDER_CUSTOM_MODEL_LIST,
            payload: provider.provider,
          } as any)

          if (CustomConfigurationModelFixedFields?.__model_type)
            updateModelList(CustomConfigurationModelFixedFields?.__model_type)
        }
      },
    })
  }

  return (
    <div className="relative -mt-2 pt-1">
      <div
        className={`mb-2 flex h-8 items-center justify-between ${defaultModelNotConfigured && "rounded-lg border border-[#FEF0C7] bg-[#FFFAEB] px-3"}`}>
        {defaultModelNotConfigured ? (
          <div className="flex items-center text-xs font-medium text-gray-700">
            <AlertTriangle className="mr-1 h-3 w-3 text-[#F79009]" />
            {t("common.modelProvider.notConfigured")}
          </div>
        ) : (
          <div className="text-sm font-medium text-gray-800">
            {t("common.modelProvider.models")}
          </div>
        )}
        <SystemModelSelector
          textGenerationDefaultModel={textGenerationDefaultModel}
          embeddingsDefaultModel={embeddingsDefaultModel}
          rerankDefaultModel={rerankDefaultModel}
          speech2textDefaultModel={speech2textDefaultModel}
          ttsDefaultModel={ttsDefaultModel}
        />
      </div>
      {!!configedProviders?.length && (
        <div className="pb-3">
          {configedProviders?.map(provider => (
            <ProviderAddedCard
              key={provider.provider}
              provider={provider}
              onOpenModal={(
                configurateMethod: ConfigurationMethodEnum,
                currentCustomConfigurationModelFixedFields?: CustomConfigurationModelFixedFields,
              ) =>
                handleOpenModal(
                  provider,
                  configurateMethod,
                  currentCustomConfigurationModelFixedFields,
                )
              }
            />
          ))}
        </div>
      )}
      {!!notConfigedProviders?.length && (
        <>
          <div className="mb-2 flex items-center text-xs font-semibold text-gray-500">
            + {t("common.modelProvider.addMoreModelProvider")}
            <span className="ml-3 h-[1px] grow bg-gradient-to-r from-[#f3f4f6]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {notConfigedProviders?.map(provider => (
              <ProviderCard
                key={provider.provider}
                provider={provider}
                onOpenModal={(configurateMethod: ConfigurationMethodEnum) =>
                  handleOpenModal(provider, configurateMethod)
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ModelProviderPage
