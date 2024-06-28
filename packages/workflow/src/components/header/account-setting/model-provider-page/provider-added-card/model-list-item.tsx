import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import classNames from "classnames"
import { useDebounceFn } from "ahooks"
import type {
  CustomConfigurationModelFixedFields,
  ModelItem,
  ModelProvider,
} from "../declarations"
import { ConfigurationMethodEnum, ModelStatusEnum } from "../declarations"
import ModelBadge from "../model-badge"
import ModelIcon from "../model-icon"
import ModelName from "../model-name"
import Button from "@/components/base/button"
import { Balance } from "@/components/base/icons/src/vender/line/financeAndECommerce"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import Switch from "@/components/base/switch"
import TooltipPlus from "@/components/base/tooltip-plus"
import {
  useProviderContext,
  useProviderContextSelector,
} from "@/context/provider-context"
import { disableModel, enableModel } from "@/service/common"
import { Plan } from "@/components/billing/type"

export type ModelListItemProps = {
  model: ModelItem
  provider: ModelProvider
  isConfigurable: boolean
  onConfig: (
    currentCustomConfigurationModelFixedFields?: CustomConfigurationModelFixedFields,
  ) => void
  onModifyLoadBalancing?: (model: ModelItem) => void
}

const ModelListItem = ({
  model,
  provider,
  isConfigurable,
  onConfig,
  onModifyLoadBalancing,
}: ModelListItemProps) => {
  const { t } = useTranslation()
  const { plan } = useProviderContext()
  const modelLoadBalancingEnabled = useProviderContextSelector(
    state => state.modelLoadBalancingEnabled,
  )

  const toggleModelEnablingStatus = useCallback(
    async (enabled: boolean) => {
      if (enabled)
        await enableModel(
          `/workspaces/current/model-providers/${provider.provider}/models/enable`,
          { model: model.model, model_type: model.model_type },
        )
      else
        await disableModel(
          `/workspaces/current/model-providers/${provider.provider}/models/disable`,
          { model: model.model, model_type: model.model_type },
        )
    },
    [model.model, model.model_type, provider.provider],
  )

  const { run: debouncedToggleModelEnablingStatus } = useDebounceFn(
    toggleModelEnablingStatus,
    { wait: 500 },
  )

  const onEnablingStateChange = useCallback(
    async (value: boolean) => {
      debouncedToggleModelEnablingStatus(value)
    },
    [debouncedToggleModelEnablingStatus],
  )

  return (
    <div
      key={model.model}
      className={classNames(
        "group flex h-8 items-center rounded-lg pl-2 pr-2.5",
        isConfigurable && "hover:bg-gray-50",
        model.deprecated && "opacity-60",
      )}>
      <ModelIcon
        className="mr-2 shrink-0"
        provider={provider}
        modelName={model.model}
      />
      <ModelName
        className="grow text-sm font-normal text-gray-900"
        modelItem={model}
        showModelType
        showMode
        showContextSize>
        {modelLoadBalancingEnabled &&
          !model.deprecated &&
          model.load_balancing_enabled && (
            <ModelBadge className="ml-1 border-indigo-300 uppercase text-indigo-600">
              <Balance className="mr-0.5 h-3 w-3" />
              {t("common.modelProvider.loadBalancingHeadline")}
            </ModelBadge>
          )}
      </ModelName>
      <div className="flex shrink-0 items-center">
        {model.fetch_from === ConfigurationMethodEnum.customizableModel ? (
          <Button
            className="hidden h-7 group-hover:flex"
            onClick={() =>
              onConfig({
                __model_name: model.model,
                __model_type: model.model_type,
              })
            }>
            <Settings01 className="mr-[5px] h-3.5 w-3.5" />
            {t("common.modelProvider.config")}
          </Button>
        ) : (modelLoadBalancingEnabled || plan.type === Plan.sandbox) &&
          !model.deprecated &&
          [ModelStatusEnum.active, ModelStatusEnum.disabled].includes(
            model.status,
          ) ? (
          <Button
            className="h-[28px] opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onModifyLoadBalancing?.(model)}>
            <Balance className="mr-1 h-[14px] w-[14px]" />
            {t("common.modelProvider.configLoadBalancing")}
          </Button>
        ) : null}
        {model.deprecated ? (
          <TooltipPlus
            popupContent={
              <span className="font-semibold">
                {t("common.modelProvider.modelHasBeenDeprecated")}
              </span>
            }
            offset={{ mainAxis: 4 }}>
            <Switch defaultValue={false} disabled size="md" />
          </TooltipPlus>
        ) : (
          <Switch
            className="ml-2"
            defaultValue={model?.status === ModelStatusEnum.active}
            disabled={
              ![ModelStatusEnum.active, ModelStatusEnum.disabled].includes(
                model.status,
              )
            }
            size="md"
            onChange={onEnablingStateChange}
          />
        )}
      </div>
    </div>
  )
}

export default memo(ModelListItem)
