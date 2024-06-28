"use client"
import useSWR from "swr"
import type { FC } from "react"
import { useContext } from "use-context-selector"
import React, { Fragment } from "react"
import classNames from "classnames"
import { RiQuestionLine } from "@remixicon/react"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Listbox, Transition } from "@headlessui/react"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import type { Item } from "@/components/base/select"
import ConfigContext from "@/context/debug-configuration"
import { fetchAppVoices } from "@/service/apps"
import Tooltip from "@/components/base/tooltip"
import { languages } from "@/i18n/language"
const VoiceParamConfig: FC = () => {
  const { t } = useTranslation()
  const pathname = usePathname()
  const matched = pathname.match(/\/app\/([^/]+)/)
  const appId = matched?.length && matched[1] ? matched[1] : ""

  const { textToSpeechConfig, setTextToSpeechConfig } =
    useContext(ConfigContext)

  const languageItem = languages.find(
    item => item.value === textToSpeechConfig.language,
  )
  const localLanguagePlaceholder =
    languageItem?.name || t("common.placeholder.select")

  const language = languageItem?.value
  const voiceItems = useSWR({ appId, language }, fetchAppVoices).data
  const voiceItem = voiceItems?.find(
    item => item.value === textToSpeechConfig.voice,
  )
  const localVoicePlaceholder =
    voiceItem?.name || t("common.placeholder.select")

  return (
    <div>
      <div>
        <div className="text-base font-semibold leading-6 text-gray-800">
          {t("appDebug.voice.voiceSettings.title")}
        </div>
        <div className="space-y-6 pt-3">
          <div>
            <div className="mb-2 flex items-center space-x-1">
              <div className="text-[13px] font-semibold leading-[18px] text-gray-800">
                {t("appDebug.voice.voiceSettings.language")}
              </div>
              <Tooltip
                htmlContent={
                  <div className="w-[180px]">
                    {t("appDebug.voice.voiceSettings.resolutionTooltip")
                      .split("\n")
                      .map(item => (
                        <div key={item}>{item}</div>
                      ))}
                  </div>
                }
                selector="config-resolution-tooltip">
                <RiQuestionLine className="h-[14px] w-[14px] text-gray-400" />
              </Tooltip>
            </div>
            <Listbox
              value={languageItem}
              onChange={(value: Item) => {
                setTextToSpeechConfig({
                  ...textToSpeechConfig,
                  language: String(value.value),
                })
              }}>
              <div className={"relative h-9"}>
                <Listbox.Button
                  className={
                    "h-full w-full cursor-pointer rounded-lg border-0 bg-gray-100 py-1.5 pl-3 pr-10 focus-visible:bg-gray-200 focus-visible:outline-none group-hover:bg-gray-200 sm:text-sm sm:leading-6"
                  }>
                  <span
                    className={classNames(
                      "block truncate text-left",
                      !languageItem?.name && "text-gray-400",
                    )}>
                    {languageItem?.name
                      ? t(
                          `common.voice.language.${languageItem?.value.replace("-", "")}`,
                        )
                      : localLanguagePlaceholder}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0">
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border-[0.5px] border-gray-200 bg-white px-1 py-1 text-base shadow-lg focus:outline-none sm:text-sm">
                    {languages.map((item: Item) => (
                      <Listbox.Option
                        key={item.value}
                        className={({ active }) =>
                          `relative cursor-pointer select-none rounded-lg py-2 pl-3 pr-9 text-gray-700 hover:bg-gray-100 ${
                            active ? "bg-gray-100" : ""
                          }`
                        }
                        value={item}
                        disabled={false}>
                        {({ /* active, */ selected }) => (
                          <>
                            <span
                              className={classNames(
                                "block",
                                selected && "font-normal",
                              )}>
                              {t(
                                `common.voice.language.${item.value.toString().replace("-", "")}`,
                              )}
                            </span>
                            {(selected ||
                              item.value === textToSpeechConfig.language) && (
                              <span
                                className={classNames(
                                  "absolute inset-y-0 right-0 flex items-center pr-4 text-gray-700",
                                )}>
                                <CheckIcon
                                  className="h-5 w-5"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold leading-[18px] text-gray-800">
              {t("appDebug.voice.voiceSettings.voice")}
            </div>
            <Listbox
              value={voiceItem}
              disabled={!languageItem}
              onChange={(value: Item) => {
                setTextToSpeechConfig({
                  ...textToSpeechConfig,
                  voice: String(value.value),
                })
              }}>
              <div className={"relative h-9"}>
                <Listbox.Button
                  className={
                    "h-full w-full cursor-pointer rounded-lg border-0 bg-gray-100 py-1.5 pl-3 pr-10 focus-visible:bg-gray-200 focus-visible:outline-none group-hover:bg-gray-200 sm:text-sm sm:leading-6"
                  }>
                  <span
                    className={classNames(
                      "block truncate text-left",
                      !voiceItem?.name && "text-gray-400",
                    )}>
                    {voiceItem?.name ?? localVoicePlaceholder}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0">
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border-[0.5px] border-gray-200 bg-white px-1 py-1 text-base shadow-lg focus:outline-none sm:text-sm">
                    {voiceItems?.map((item: Item) => (
                      <Listbox.Option
                        key={item.value}
                        className={({ active }) =>
                          `relative cursor-pointer select-none rounded-lg py-2 pl-3 pr-9 text-gray-700 hover:bg-gray-100 ${
                            active ? "bg-gray-100" : ""
                          }`
                        }
                        value={item}
                        disabled={false}>
                        {({ /* active, */ selected }) => (
                          <>
                            <span
                              className={classNames(
                                "block",
                                selected && "font-normal",
                              )}>
                              {item.name}
                            </span>
                            {(selected ||
                              item.value === textToSpeechConfig.voice) && (
                              <span
                                className={classNames(
                                  "absolute inset-y-0 right-0 flex items-center pr-4 text-gray-700",
                                )}>
                                <CheckIcon
                                  className="h-5 w-5"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(VoiceParamConfig)
