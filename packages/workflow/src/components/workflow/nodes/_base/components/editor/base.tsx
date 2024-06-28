"use client"
import type { FC } from "react"
import React, { useCallback, useRef, useState } from "react"
import copy from "copy-to-clipboard"
import cn from "classnames"
import Wrap from "./wrap"
import PromptEditorHeightResizeWrap from "@/components/configuration/config-prompt/prompt-editor-height-resize-wrap"
import {
  Clipboard,
  ClipboardCheck,
} from "@/components/base/icons/src/vender/line/files"
import ToggleExpandBtn from "@/components/workflow/nodes/_base/components/toggle-expand-btn"
import useToggleExpend from "@/components/workflow/nodes/_base/hooks/use-toggle-expend"

type Props = {
  className?: string
  title: JSX.Element | string
  headerRight?: JSX.Element
  children: JSX.Element
  minHeight?: number
  value: string
  isFocus: boolean
  isInNode?: boolean
}

const Base: FC<Props> = ({
  className,
  title,
  headerRight,
  children,
  minHeight = 120,
  value,
  isFocus,
  isInNode,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const {
    wrapClassName,
    wrapStyle,
    isExpand,
    setIsExpand,
    editorExpandHeight,
  } = useToggleExpend({ ref, hasFooter: false, isInNode })

  const editorContentMinHeight = minHeight - 28
  const [editorContentHeight, setEditorContentHeight] = useState(
    editorContentMinHeight,
  )

  const [isCopied, setIsCopied] = React.useState(false)
  const handleCopy = useCallback(() => {
    copy(value)
    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }, [value])

  return (
    <Wrap
      className={cn(wrapClassName)}
      style={wrapStyle}
      isInNode={isInNode}
      isExpand={isExpand}>
      <div
        ref={ref}
        className={cn(
          className,
          isExpand && "h-full",
          "rounded-lg border",
          isFocus
            ? "border-gray-200 bg-white"
            : "overflow-hidden border-gray-100 bg-gray-100",
        )}>
        <div className="flex h-7 items-center justify-between pl-3 pr-2 pt-1">
          <div className="text-xs font-semibold text-gray-700">{title}</div>
          <div
            className="flex items-center"
            onClick={e => {
              e.nativeEvent.stopImmediatePropagation()
              e.stopPropagation()
            }}>
            {headerRight}
            {!isCopied ? (
              <Clipboard
                className="mx-1 h-3.5 w-3.5 cursor-pointer text-gray-500"
                onClick={handleCopy}
              />
            ) : (
              <ClipboardCheck className="mx-1 h-3.5 w-3.5 text-gray-500" />
            )}
            <div className="ml-1">
              <ToggleExpandBtn
                isExpand={isExpand}
                onExpandChange={setIsExpand}
              />
            </div>
          </div>
        </div>
        <PromptEditorHeightResizeWrap
          height={isExpand ? editorExpandHeight : editorContentHeight}
          minHeight={editorContentMinHeight}
          onHeightChange={setEditorContentHeight}
          hideResize={isExpand}>
          <div className="h-full pb-2">{children}</div>
        </PromptEditorHeightResizeWrap>
      </div>
    </Wrap>
  )
}
export default React.memo(Base)
