import type { FC, ReactNode } from "react"
import { memo } from "react"
import type { ChatItem } from "../types"
import type { Theme } from "../embedded-chatbot/theme/theme-context"
import { CssTransform } from "../embedded-chatbot/theme/utils"
import { QuestionTriangle } from "@/components/base/icons/src/vender/solid/general"
import { User } from "@/components/base/icons/src/public/avatar"
import { Markdown } from "@/components/base/markdown"
import ImageGallery from "@/components/base/image-gallery"

type QuestionProps = {
  item: ChatItem
  questionIcon?: ReactNode
  theme: Theme | null | undefined
}
const Question: FC<QuestionProps> = ({ item, questionIcon, theme }) => {
  const { content, message_files } = item

  const imgSrcs = message_files?.length
    ? message_files.map(item => item.url)
    : []
  return (
    <div className="mb-2 flex justify-end pl-10 last:mb-0">
      <div className="group relative mr-4">
        <QuestionTriangle
          className="absolute -right-2 top-0 h-3 w-2 text-[#D1E9FF]/50"
          style={theme ? { color: theme.chatBubbleColor } : {}}
        />
        <div
          className="rounded-b-2xl rounded-tl-2xl bg-[#D1E9FF]/50 px-4 py-3 text-sm text-gray-900"
          style={
            theme?.chatBubbleColorStyle
              ? CssTransform(theme.chatBubbleColorStyle)
              : {}
          }>
          {!!imgSrcs.length && <ImageGallery srcs={imgSrcs} />}
          <Markdown content={content} />
        </div>
        <div className="mt-1 h-[18px]" />
      </div>
      <div className="h-10 w-10 shrink-0">
        {questionIcon || (
          <div className="h-full w-full rounded-full border-[0.5px] border-black/5">
            <User className="h-full w-full" />
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(Question)
