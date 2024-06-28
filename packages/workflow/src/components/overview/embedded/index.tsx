import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import copy from "copy-to-clipboard"
import style from "./style.module.css"
import Modal from "@/components/base/modal"
import copyStyle from "@/components/base/copy-btn/style.module.css"
import Tooltip from "@/components/base/tooltip"
import { useAppContext } from "@/context/app-context"
import { IS_CE_EDITION } from "@/config"
import type { SiteInfo } from "@/models/share"
import { useThemeContext } from "@/components/base/chat/embedded-chatbot/theme/theme-context"

type Props = {
  siteInfo?: SiteInfo
  isShow: boolean
  onClose: () => void
  accessToken: string
  appBaseUrl: string
  className?: string
}

const OPTION_MAP = {
  iframe: {
    getContent: (url: string, token: string) =>
      `<iframe
 src="${url}/chatbot/${token}"
 style="width: 100%; height: 100%; min-height: 700px"
 frameborder="0"
 allow="microphone">
</iframe>`,
  },
  scripts: {
    getContent: (
      url: string,
      token: string,
      primaryColor: string,
      isTestEnv?: boolean,
    ) =>
      `<script>
 window.difyChatbotConfig = {
  token: '${token}'${
    isTestEnv
      ? `,
  isDev: true`
      : ""
  }${
    IS_CE_EDITION
      ? `,
  baseUrl: '${url}'`
      : ""
  }
 }
</script>
<script
 src="${url}/embed.min.js"
 id="${token}"
 defer>
</script>
<style>
  #dify-chatbot-bubble-button {
    background-color: ${primaryColor} !important;
  }
</style>`,
  },
  chromePlugin: {
    getContent: (url: string, token: string) =>
      `ChatBot URL: ${url}/chatbot/${token}`,
  },
}
const prefixEmbedded = "appOverview.overview.appInfo.embedded"

type Option = keyof typeof OPTION_MAP

type OptionStatus = {
  iframe: boolean
  scripts: boolean
  chromePlugin: boolean
}

const Embedded = ({
  siteInfo,
  isShow,
  onClose,
  appBaseUrl,
  accessToken,
  className,
}: Props) => {
  const { t } = useTranslation()
  const [option, setOption] = useState<Option>("iframe")
  const [isCopied, setIsCopied] = useState<OptionStatus>({
    iframe: false,
    scripts: false,
    chromePlugin: false,
  })

  const { langeniusVersionInfo } = useAppContext()
  const themeBuilder = useThemeContext()
  themeBuilder.buildTheme(
    siteInfo?.chat_color_theme ?? null,
    siteInfo?.chat_color_theme_inverted ?? false,
  )
  const isTestEnv =
    langeniusVersionInfo.current_env === "TESTING" ||
    langeniusVersionInfo.current_env === "DEVELOPMENT"
  const onClickCopy = () => {
    if (option === "chromePlugin") {
      const splitUrl = OPTION_MAP[option]
        .getContent(appBaseUrl, accessToken)
        .split(": ")
      if (splitUrl.length > 1) copy(splitUrl[1])
    } else {
      copy(
        OPTION_MAP[option].getContent(
          appBaseUrl,
          accessToken,
          themeBuilder.theme?.primaryColor ?? "#1C64F2",
          isTestEnv,
        ),
      )
    }
    setIsCopied({ ...isCopied, [option]: true })
  }

  // when toggle option, reset then copy status
  const resetCopyStatus = () => {
    const cache = { ...isCopied }
    Object.keys(cache).forEach(key => {
      cache[key as keyof OptionStatus] = false
    })
    setIsCopied(cache)
  }

  const navigateToChromeUrl = () => {
    window.open(
      "https://chrome.google.com/webstore/detail/dify-chatbot/ceehdapohffmjmkdcifjofadiaoeggaf",
      "_blank",
    )
  }

  useEffect(() => {
    resetCopyStatus()
  }, [isShow])

  return (
    <Modal
      title={t(`${prefixEmbedded}.title`)}
      isShow={isShow}
      onClose={onClose}
      className="w-[640px] !max-w-2xl"
      wrapperClassName={className}
      closable={true}>
      <div className="mb-4 mt-8 text-[14px] font-medium leading-tight text-gray-900">
        {t(`${prefixEmbedded}.explanation`)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        {Object.keys(OPTION_MAP).map((v, index) => {
          return (
            <div
              key={index}
              className={cn(
                style.option,
                style[`${v}Icon`],
                option === v && style.active,
              )}
              onClick={() => {
                setOption(v as Option)
                resetCopyStatus()
              }}></div>
          )
        })}
      </div>
      {option === "chromePlugin" && (
        <div className="mt-6 w-full">
          <div
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg py-3",
              "bg-primary-600 hover:bg-primary-600/75 flex-shrink-0 cursor-pointer text-white hover:shadow-md hover:shadow-sm",
            )}>
            <div
              className={`relative h-4 w-4 ${style.pluginInstallIcon}`}></div>
            <div
              className="font-['Inter'] text-sm font-medium leading-tight text-white"
              onClick={navigateToChromeUrl}>
              {t(`${prefixEmbedded}.chromePlugin`)}
            </div>
          </div>
        </div>
      )}
      <div
        className={cn(
          "inline-flex w-full flex-col items-start justify-start rounded-lg bg-gray-100",
          "mt-6",
        )}>
        <div className="inline-flex items-center justify-start gap-2 self-stretch rounded-tl-lg rounded-tr-lg border border-black border-opacity-5 bg-gray-50 py-1 pl-3 pr-1">
          <div className="shrink grow basis-0 text-[13px] font-medium leading-none text-slate-700">
            {t(`${prefixEmbedded}.${option}`)}
          </div>
          <div className="flex items-center justify-center gap-1 rounded-lg p-2">
            <Tooltip
              selector={"code-copy-feedback"}
              content={
                (isCopied[option]
                  ? t(`${prefixEmbedded}.copied`)
                  : t(`${prefixEmbedded}.copy`)) || ""
              }>
              <div className="h-8 w-8 cursor-pointer rounded-lg hover:bg-gray-100">
                <div
                  onClick={onClickCopy}
                  className={`h-full w-full ${copyStyle.copyIcon} ${isCopied[option] ? copyStyle.copied : ""}`}></div>
              </div>
            </Tooltip>
          </div>
        </div>
        <div className="flex w-full items-start justify-start gap-2 overflow-x-auto p-3">
          <div className="shrink grow basis-0 font-mono text-[13px] leading-tight text-slate-700">
            <pre className="select-text">
              {OPTION_MAP[option].getContent(
                appBaseUrl,
                accessToken,
                themeBuilder.theme?.primaryColor ?? "#1C64F2",
                isTestEnv,
              )}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default Embedded
