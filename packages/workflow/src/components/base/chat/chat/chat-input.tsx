import type { FC } from "react"
import { memo, useRef, useState } from "react"
import { useContext } from "use-context-selector"
import Recorder from "js-audio-recorder"
import { useTranslation } from "react-i18next"
import Textarea from "rc-textarea"
import type { EnableType, OnSend, VisionConfig } from "../types"
import { TransferMethod } from "../types"
import { useChatWithHistoryContext } from "../chat-with-history/context"
import type { Theme } from "../embedded-chatbot/theme/theme-context"
import { CssTransform } from "../embedded-chatbot/theme/utils"
import TooltipPlus from "@/components/base/tooltip-plus"
import { ToastContext } from "@/components/base/toast"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"
import VoiceInput from "@/components/base/voice-input"
import { Microphone01 } from "@/components/base/icons/src/vender/line/mediaAndDevices"
import { Microphone01 as Microphone01Solid } from "@/components/base/icons/src/vender/solid/mediaAndDevices"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"
import { Send03 } from "@/components/base/icons/src/vender/solid/communication"
import ChatImageUploader from "@/components/base/image-uploader/chat-image-uploader"
import ImageList from "@/components/base/image-uploader/image-list"
import {
  useClipboardUploader,
  useDraggableUploader,
  useImageFiles,
} from "@/components/base/image-uploader/hooks"

type ChatInputProps = {
  visionConfig?: VisionConfig
  speechToTextConfig?: EnableType
  onSend?: OnSend
  theme?: Theme | null
}
const ChatInput: FC<ChatInputProps> = ({
  visionConfig,
  speechToTextConfig,
  onSend,
  theme,
}) => {
  const { appData } = useChatWithHistoryContext()
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)
  const [voiceInputShow, setVoiceInputShow] = useState(false)
  const {
    files,
    onUpload,
    onRemove,
    onReUpload,
    onImageLinkLoadError,
    onImageLinkLoadSuccess,
    onClear,
  } = useImageFiles()
  const { onPaste } = useClipboardUploader({ onUpload, visionConfig, files })
  const { onDragEnter, onDragLeave, onDragOver, onDrop, isDragActive } =
    useDraggableUploader<HTMLTextAreaElement>({ onUpload, files, visionConfig })
  const isUseInputMethod = useRef(false)
  const [query, setQuery] = useState("")
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setQuery(value)
  }

  const handleSend = () => {
    if (onSend) {
      if (
        files.find(
          item => item.type === TransferMethod.local_file && !item.fileId,
        )
      ) {
        notify({
          type: "info",
          message: t("appDebug.errorMessage.waitForImgUpload"),
        })
        return
      }
      if (!query || !query.trim()) {
        notify({
          type: "info",
          message: t("appAnnotation.errorMessage.queryRequired"),
        })
        return
      }
      onSend(
        query,
        files
          .filter(file => file.progress !== -1)
          .map(fileItem => ({
            type: "image",
            transfer_method: fileItem.type,
            url: fileItem.url,
            upload_file_id: fileItem.fileId,
          })),
      )
      setQuery("")
      onClear()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.code === "Enter") {
      e.preventDefault()
      // prevent send message when using input method enter
      if (!e.shiftKey && !isUseInputMethod.current) handleSend()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    isUseInputMethod.current = e.nativeEvent.isComposing
    if (e.code === "Enter" && !e.shiftKey) {
      setQuery(query.replace(/\n$/, ""))
      e.preventDefault()
    }
  }

  const logError = (message: string) => {
    notify({ type: "error", message, duration: 3000 })
  }
  const handleVoiceInputShow = () => {
    ;(Recorder as any).getPermission().then(
      () => {
        setVoiceInputShow(true)
      },
      () => {
        logError(t("common.voiceInput.notAllow"))
      },
    )
  }

  const [isActiveIconFocused, setActiveIconFocused] = useState(false)

  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile
  const sendIconThemeStyle = theme
    ? {
        color:
          isActiveIconFocused || query || query.trim() !== ""
            ? theme.primaryColor
            : "#d1d5db",
      }
    : {}
  const sendBtn = (
    <div
      className="group flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[#EBF5FF]"
      onMouseEnter={() => setActiveIconFocused(true)}
      onMouseLeave={() => setActiveIconFocused(false)}
      onClick={handleSend}
      style={
        isActiveIconFocused
          ? CssTransform(theme?.chatBubbleColorStyle ?? "")
          : {}
      }>
      <Send03
        style={sendIconThemeStyle}
        className={`group-hover:text-primary-600 h-5 w-5 text-gray-300 ${!!query.trim() && "text-primary-600"} `}
      />
    </div>
  )

  return (
    <>
      <div className="relative">
        <div
          className={`max-h-[150px] overflow-y-auto rounded-xl border-[1.5px] border-gray-200 bg-white p-[5.5px] ${isDragActive && "border-primary-600"} mb-2`}>
          {visionConfig?.enabled && (
            <>
              <div className="absolute bottom-2 left-2 flex items-center">
                <ChatImageUploader
                  settings={visionConfig}
                  onUpload={onUpload}
                  disabled={files.length >= visionConfig.number_limits}
                />
                <div className="mx-1 h-4 w-[1px] bg-black/5" />
              </div>
              <div className="pl-[52px]">
                <ImageList
                  list={files}
                  onRemove={onRemove}
                  onReUpload={onReUpload}
                  onImageLinkLoadSuccess={onImageLinkLoadSuccess}
                  onImageLinkLoadError={onImageLinkLoadError}
                />
              </div>
            </>
          )}
          <Textarea
            className={`block max-h-none w-full resize-none appearance-none px-2 py-[7px] pr-[118px] text-sm leading-5 text-gray-700 outline-none ${visionConfig?.enabled && "pl-12"} `}
            value={query}
            onChange={handleContentChange}
            onKeyUp={handleKeyUp}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            autoSize
          />
          <div className="absolute bottom-[7px] right-2 flex h-8 items-center">
            <div className="flex h-5 items-center rounded-md bg-gray-100 px-1 text-xs font-medium text-gray-500">
              {query.trim().length}
            </div>
            {query ? (
              <div
                className="ml-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"
                onClick={() => setQuery("")}>
                <XCircle className="h-4 w-4 text-[#98A2B3]" />
              </div>
            ) : speechToTextConfig?.enabled ? (
              <div
                className="hover:bg-primary-50 group ml-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg"
                onClick={handleVoiceInputShow}>
                <Microphone01 className="block h-4 w-4 text-gray-500 group-hover:hidden" />
                <Microphone01Solid className="text-primary-600 hidden h-4 w-4 group-hover:block" />
              </div>
            ) : null}
            <div className="mx-2 h-4 w-[1px] bg-black opacity-5" />
            {isMobile ? (
              sendBtn
            ) : (
              <TooltipPlus
                popupContent={
                  <div>
                    <div>{t("common.operation.send")} Enter</div>
                    <div>{t("common.operation.lineBreak")} Shift Enter</div>
                  </div>
                }>
                {sendBtn}
              </TooltipPlus>
            )}
          </div>
          {voiceInputShow && (
            <VoiceInput
              onCancel={() => setVoiceInputShow(false)}
              onConverted={text => setQuery(text)}
            />
          )}
        </div>
      </div>
      {appData?.site?.custom_disclaimer && (
        <div className="mt-1 text-center text-xs text-gray-500">
          {appData.site.custom_disclaimer}
        </div>
      )}
    </>
  )
}

export default memo(ChatInput)
