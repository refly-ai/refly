import type { FC } from "react"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type {
  CustomConfigurationModelFixedFields,
  ModelItem,
  ModelProvider,
} from "../declarations"
import { ConfigurationMethodEnum } from "../declarations"
// import Tab from './tab'
import AddModelButton from "./add-model-button"
import ModelListItem from "./model-list-item"
import { ChevronDownDouble } from "@/components/base/icons/src/vender/line/arrows"
import { useModalContextSelector } from "@/context/modal-context"

type ModelListProps = {
  provider: ModelProvider
  models: ModelItem[]
  onCollapse: () => void
  onConfig: (
    currentCustomConfigurationModelFixedFields?: CustomConfigurationModelFixedFields,
  ) => void
  onChange?: (provider: string) => void
}
const ModelList: FC<ModelListProps> = ({
  provider,
  models,
  onCollapse,
  onConfig,
  onChange,
}) => {
  const { t } = useTranslation()
  const configurativeMethods = provider.configurate_methods.filter(
    method => method !== ConfigurationMethodEnum.fetchFromRemote,
  )
  const isConfigurable = configurativeMethods.includes(
    ConfigurationMethodEnum.customizableModel,
  )

  const setShowModelLoadBalancingModal = useModalContextSelector(
    state => state.setShowModelLoadBalancingModal,
  )
  const onModifyLoadBalancing = useCallback(
    (model: ModelItem) => {
      setShowModelLoadBalancingModal({
        provider,
        model: model!,
        open: !!model,
        onClose: () => setShowModelLoadBalancingModal(null),
        onSave: onChange,
      })
    },
    [onChange, provider, setShowModelLoadBalancingModal],
  )

  return (
    <div className="rounded-b-xl px-2 pb-2">
      <div className="rounded-lg bg-white py-1">
        <div className="flex items-center pl-1 pr-[3px]">
          <span className="group mr-2 flex shrink-0 items-center">
            <span className="h-6 pl-1 pr-1.5 text-xs font-medium leading-6 text-gray-500 group-hover:hidden">
              {t("common.modelProvider.modelsNum", { num: models.length })}
            </span>
            <span
              className="hidden h-6 cursor-pointer items-center rounded-lg bg-gray-50 pl-1 pr-1.5 text-xs font-medium text-gray-500 group-hover:inline-flex"
              onClick={() => onCollapse()}>
              <ChevronDownDouble className="mr-0.5 h-3 w-3 rotate-180" />
              {t("common.modelProvider.collapse")}
            </span>
          </span>
          {/* {
            isConfigurable && canSystemConfig && (
              <span className='flex items-center'>
                <Tab active='all' onSelect={() => {}} />
              </span>
            )
          } */}
          {isConfigurable && (
            <div className="flex grow justify-end">
              <AddModelButton onClick={() => onConfig()} />
            </div>
          )}
        </div>
        {models.map(model => (
          <ModelListItem
            key={model.model}
            {...{
              model,
              provider,
              isConfigurable,
              onConfig,
              onModifyLoadBalancing,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default ModelList
