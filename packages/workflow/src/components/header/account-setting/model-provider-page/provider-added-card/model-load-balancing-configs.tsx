import classNames from "classnames"
import type { Dispatch, SetStateAction } from "react"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RiDeleteBinLine, RiQuestionLine } from "@remixicon/react"
import type {
  ConfigurationMethodEnum,
  CustomConfigurationModelFixedFields,
  ModelLoadBalancingConfig,
  ModelLoadBalancingConfigEntry,
  ModelProvider,
} from "../declarations"
import Indicator from "../../../indicator"
import CooldownTimer from "./cooldown-timer"
import TooltipPlus from "@/components/base/tooltip-plus"
import Switch from "@/components/base/switch"
import { Balance } from "@/components/base/icons/src/vender/line/financeAndECommerce"
import { Edit02, Plus02 } from "@/components/base/icons/src/vender/line/general"
import { AlertTriangle } from "@/components/base/icons/src/vender/solid/alertsAndFeedback"
import { useModalContextSelector } from "@/context/modal-context"
import UpgradeBtn from "@/components/billing/upgrade-btn"
import s from "@/components/custom/style.module.css"
import GridMask from "@/components/base/grid-mask"
import { useProviderContextSelector } from "@/context/provider-context"
import { IS_CE_EDITION } from "@/config"

export type ModelLoadBalancingConfigsProps = {
  draftConfig?: ModelLoadBalancingConfig
  setDraftConfig: Dispatch<SetStateAction<ModelLoadBalancingConfig | undefined>>
  provider: ModelProvider
  configurationMethod: ConfigurationMethodEnum
  currentCustomConfigurationModelFixedFields?: CustomConfigurationModelFixedFields
  withSwitch?: boolean
  className?: string
}

const ModelLoadBalancingConfigs = ({
  draftConfig,
  setDraftConfig,
  provider,
  configurationMethod,
  currentCustomConfigurationModelFixedFields,
  withSwitch = false,
  className,
}: ModelLoadBalancingConfigsProps) => {
  const { t } = useTranslation()
  const modelLoadBalancingEnabled = useProviderContextSelector(
    state => state.modelLoadBalancingEnabled,
  )

  const updateConfigEntry = useCallback(
    (
      index: number,
      modifier: (
        entry: ModelLoadBalancingConfigEntry,
      ) => ModelLoadBalancingConfigEntry | undefined,
    ) => {
      setDraftConfig(prev => {
        if (!prev) return prev
        const newConfigs = [...prev.configs]
        const modifiedConfig = modifier(newConfigs[index])
        if (modifiedConfig) newConfigs[index] = modifiedConfig
        else newConfigs.splice(index, 1)
        return {
          ...prev,
          configs: newConfigs,
        }
      })
    },
    [setDraftConfig],
  )

  const toggleModalBalancing = useCallback(
    (enabled: boolean) => {
      if ((modelLoadBalancingEnabled || !enabled) && draftConfig) {
        setDraftConfig({
          ...draftConfig,
          enabled,
        })
      }
    },
    [draftConfig, modelLoadBalancingEnabled, setDraftConfig],
  )

  const toggleConfigEntryEnabled = useCallback(
    (index: number, state?: boolean) => {
      updateConfigEntry(index, entry => ({
        ...entry,
        enabled: typeof state === "boolean" ? state : !entry.enabled,
      }))
    },
    [updateConfigEntry],
  )

  const setShowModelLoadBalancingEntryModal = useModalContextSelector(
    state => state.setShowModelLoadBalancingEntryModal,
  )

  const toggleEntryModal = useCallback(
    (index?: number, entry?: ModelLoadBalancingConfigEntry) => {
      setShowModelLoadBalancingEntryModal({
        payload: {
          currentProvider: provider,
          currentConfigurationMethod: configurationMethod,
          currentCustomConfigurationModelFixedFields,
          entry,
          index,
        },
        onSaveCallback: ({ entry: result }) => {
          if (entry) {
            // edit
            setDraftConfig(prev => ({
              ...prev,
              enabled: !!prev?.enabled,
              configs:
                prev?.configs.map((config, i) =>
                  i === index ? result! : config,
                ) || [],
            }))
          } else {
            // add
            setDraftConfig(prev => ({
              ...prev,
              enabled: !!prev?.enabled,
              configs: (prev?.configs || []).concat([
                { ...result!, enabled: true },
              ]),
            }))
          }
        },
        onRemoveCallback: ({ index }) => {
          if (
            index !== undefined &&
            (draftConfig?.configs?.length ?? 0) > index
          ) {
            setDraftConfig(prev => ({
              ...prev,
              enabled: !!prev?.enabled,
              configs: prev?.configs.filter((_, i) => i !== index) || [],
            }))
          }
        },
      })
    },
    [
      configurationMethod,
      currentCustomConfigurationModelFixedFields,
      draftConfig?.configs?.length,
      provider,
      setDraftConfig,
      setShowModelLoadBalancingEntryModal,
    ],
  )

  const clearCountdown = useCallback(
    (index: number) => {
      updateConfigEntry(index, ({ ttl: _, ...entry }) => {
        return {
          ...entry,
          in_cooldown: false,
        }
      })
    },
    [updateConfigEntry],
  )

  if (!draftConfig) return null

  return (
    <>
      <div
        className={classNames(
          "min-h-16 rounded-xl border bg-gray-50 transition-colors",
          withSwitch || !draftConfig.enabled
            ? "border-gray-200"
            : "border-primary-400",
          withSwitch || draftConfig.enabled
            ? "cursor-default"
            : "cursor-pointer",
          className,
        )}
        onClick={
          !withSwitch && !draftConfig.enabled
            ? () => toggleModalBalancing(true)
            : undefined
        }>
        <div className="flex select-none items-center gap-2 px-[15px] py-3">
          <div className="flex items-center justify-center w-8 h-8 border border-indigo-100 rounded-lg text-primary-600 shrink-0 grow-0 bg-indigo-50">
            <Balance className="w-4 h-4" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-1 text-sm">
              {t("common.modelProvider.loadBalancing")}
              <TooltipPlus
                popupContent={t("common.modelProvider.loadBalancingInfo")}
                popupClassName="max-w-[300px]">
                <RiQuestionLine className="w-3 h-3 text-gray-400" />
              </TooltipPlus>
            </div>
            <div className="text-xs text-gray-500">
              {t("common.modelProvider.loadBalancingDescription")}
            </div>
          </div>
          {withSwitch && (
            <Switch
              defaultValue={Boolean(draftConfig.enabled)}
              size="l"
              className="ml-3 justify-self-end"
              disabled={!modelLoadBalancingEnabled && !draftConfig.enabled}
              onChange={value => toggleModalBalancing(value)}
            />
          )}
        </div>
        {draftConfig.enabled && (
          <div className="flex flex-col gap-1 px-3 pb-3">
            {draftConfig.configs.map((config, index) => {
              const isProviderManaged = config.name === "__inherit__"
              return (
                <div
                  key={config.id || index}
                  className="flex items-center h-10 px-3 bg-white border border-gray-200 rounded-lg shadow-xs group">
                  <div className="flex items-center grow">
                    <div className="flex items-center justify-center w-3 h-3 mr-2">
                      {config.in_cooldown && Boolean(config.ttl) ? (
                        <CooldownTimer
                          secondsRemaining={config.ttl}
                          onFinish={() => clearCountdown(index)}
                        />
                      ) : (
                        <TooltipPlus
                          popupContent={t(
                            "common.modelProvider.apiKeyStatusNormal",
                          )}>
                          <Indicator color="green" />
                        </TooltipPlus>
                      )}
                    </div>
                    <div className="mr-1 text-[13px]">
                      {isProviderManaged
                        ? t("common.modelProvider.defaultConfig")
                        : config.name}
                    </div>
                    {isProviderManaged && (
                      <span className="text-2xs border-black/8 rounded-[5px] border px-1 uppercase text-gray-500">
                        {t("common.modelProvider.providerManaged")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isProviderManaged && (
                      <>
                        <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                          <span
                            className="flex items-center justify-center w-8 h-8 text-gray-500 transition-colors bg-white rounded-lg cursor-pointer hover:bg-black/5"
                            onClick={() => toggleEntryModal(index, config)}>
                            <Edit02 className="w-4 h-4" />
                          </span>
                          <span
                            className="flex items-center justify-center w-8 h-8 text-gray-500 transition-colors bg-white rounded-lg cursor-pointer hover:bg-black/5"
                            onClick={() =>
                              updateConfigEntry(index, () => undefined)
                            }>
                            <RiDeleteBinLine className="w-4 h-4" />
                          </span>
                          <span className="h-3 mr-2 border-r border-r-gray-100" />
                        </div>
                      </>
                    )}
                    <Switch
                      defaultValue={Boolean(config.enabled)}
                      size="md"
                      className="justify-self-end"
                      onChange={value => toggleConfigEntryEnabled(index, value)}
                    />
                  </div>
                </div>
              )
            })}

            <div
              className="text-primary-600 mt-1 flex h-8 items-center px-3 text-[13px] font-medium"
              onClick={() => toggleEntryModal()}>
              <div className="flex items-center cursor-pointer">
                <Plus02 className="w-3 h-3 mr-2" />
                {t("common.modelProvider.addConfig")}
              </div>
            </div>
          </div>
        )}
        {draftConfig.enabled && draftConfig.configs.length < 2 && (
          <div className="bg-black/2 flex h-[34px] items-center border-t border-t-black/5 px-6 text-xs text-gray-700">
            <AlertTriangle className="mr-1 h-3 w-3 text-[#f79009]" />
            {t("common.modelProvider.loadBalancingLeastKeyWarning")}
          </div>
        )}
      </div>

      {!modelLoadBalancingEnabled && !IS_CE_EDITION && (
        <GridMask canvasClassName="!rounded-xl">
          <div className="mt-2 flex h-14 items-center justify-between rounded-xl border-[0.5px] border-gray-200 px-4 shadow-md">
            <div
              className={classNames(
                "text-gradient text-sm font-semibold leading-tight",
                s.textGradient,
              )}>
              {t("common.modelProvider.upgradeForLoadBalancing")}
            </div>
            <UpgradeBtn />
          </div>
        </GridMask>
      )}
    </>
  )
}

export default ModelLoadBalancingConfigs
