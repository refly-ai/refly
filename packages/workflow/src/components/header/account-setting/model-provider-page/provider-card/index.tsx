import type { FC } from "react"
import { useTranslation } from "react-i18next"
import { RiAddLine } from "@remixicon/react"
import type { ModelProvider } from "../declarations"
import { ConfigurationMethodEnum } from "../declarations"
import { DEFAULT_BACKGROUND_COLOR, modelTypeFormat } from "../utils"
import { useLanguage } from "../hooks"
import ModelBadge from "../model-badge"
import ProviderIcon from "../provider-icon"
import s from "./index.module.css"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import Button from "@/components/base/button"

type ProviderCardProps = {
  provider: ModelProvider
  onOpenModal: (configurateMethod: ConfigurationMethodEnum) => void
}

const ProviderCard: FC<ProviderCardProps> = ({ provider, onOpenModal }) => {
  const { t } = useTranslation()
  const language = useLanguage()
  const configurateMethods = provider.configurate_methods.filter(
    method => method !== ConfigurationMethodEnum.fetchFromRemote,
  )

  return (
    <div
      className="shadow-xs group relative flex h-[148px] flex-col justify-between rounded-xl border-[0.5px] border-black/5 px-4 py-3 hover:shadow-lg"
      style={{ background: provider.background || DEFAULT_BACKGROUND_COLOR }}>
      <div>
        <div className="py-0.5">
          <ProviderIcon provider={provider} />
        </div>
        {provider.description && (
          <div className="mt-1 text-xs leading-4 text-black/[48]">
            {provider.description[language] || provider.description.en_US}
          </div>
        )}
      </div>
      <div>
        <div className={"flex flex-wrap gap-0.5 group-hover:hidden"}>
          {provider.supported_model_types.map(modelType => (
            <ModelBadge key={modelType}>
              {modelTypeFormat(modelType)}
            </ModelBadge>
          ))}
        </div>
        <div
          className={`hidden group-hover:grid grid-cols-${configurateMethods.length} gap-1`}>
          {configurateMethods.map(method => {
            if (method === ConfigurationMethodEnum.predefinedModel) {
              return (
                <Button
                  key={method}
                  className={"h-7 shrink-0 text-xs"}
                  onClick={() => onOpenModal(method)}>
                  <Settings01 className={`mr-[5px] h-3.5 w-3.5 ${s.icon}`} />
                  <span className="inline-flex shrink-0 items-center justify-center overflow-ellipsis text-xs">
                    {t("common.operation.setup")}
                  </span>
                </Button>
              )
            }
            return (
              <Button
                key={method}
                className="h-7 px-0 text-xs"
                onClick={() => onOpenModal(method)}>
                <RiAddLine className="mr-[5px] h-3.5 w-3.5" />
                {t("common.modelProvider.addModel")}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ProviderCard
