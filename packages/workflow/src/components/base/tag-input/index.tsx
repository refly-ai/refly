import { useState } from "react"
import type { ChangeEvent, FC, KeyboardEvent } from "react"
import {} from "use-context-selector"
import { useTranslation } from "react-i18next"
import AutosizeInput from "react-18-input-autosize"
import cn from "classnames"
import { X } from "@/components/base/icons/src/vender/line/general"
import { useToastContext } from "@/components/base/toast"

type TagInputProps = {
  items: string[]
  onChange: (items: string[]) => void
  disableRemove?: boolean
  disableAdd?: boolean
  customizedConfirmKey?: "Enter" | "Tab"
  isInWorkflow?: boolean
}

const TagInput: FC<TagInputProps> = ({
  items,
  onChange,
  disableAdd,
  disableRemove,
  customizedConfirmKey = "Enter",
  isInWorkflow,
}) => {
  const { t } = useTranslation()
  const { notify } = useToastContext()
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)

  const isSpecialMode = customizedConfirmKey === "Tab"

  const handleRemove = (index: number) => {
    const copyItems = [...items]
    copyItems.splice(index, 1)

    onChange(copyItems)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isSpecialMode && e.key === "Enter") setValue(`${value}↵`)

    if (e.key === customizedConfirmKey) {
      if (isSpecialMode) e.preventDefault()

      const valueTrimed = value.trim()
      if (!valueTrimed || items.find(item => item === valueTrimed)) return

      if (valueTrimed.length > 20) {
        notify({
          type: "error",
          message: t("datasetDocuments.segment.keywordError"),
        })
        return
      }

      onChange([...items, valueTrimed])
      setTimeout(() => {
        setValue("")
      })
    }
  }

  const handleBlur = () => {
    setValue("")
    setFocused(false)
  }

  return (
    <div
      className={cn(
        "flex flex-wrap",
        !isInWorkflow && "min-w-[200px]",
        isSpecialMode ? "rounded-lg bg-gray-100 pb-1 pl-1" : "",
      )}>
      {(items || []).map((item, index) => (
        <div
          key={item}
          className={cn(
            "mr-1 mt-1 flex items-center border border-gray-200 px-2 py-1 text-sm text-gray-700",
            isSpecialMode ? "rounded-md bg-white" : "rounded-lg",
          )}>
          {item}
          {!disableRemove && (
            <X
              className="ml-0.5 h-3 w-3 cursor-pointer text-gray-500"
              onClick={() => handleRemove(index)}
            />
          )}
        </div>
      ))}
      {!disableAdd && (
        <AutosizeInput
          inputClassName={cn(
            "outline-none appearance-none placeholder:text-gray-300 caret-primary-600 hover:placeholder:text-gray-400",
            isSpecialMode ? "bg-transparent" : "",
          )}
          className={cn(
            !isInWorkflow && "max-w-[300px]",
            isInWorkflow && "max-w-[146px]",
            `mt-1 overflow-hidden rounded-lg border border-transparent py-1 text-sm ${focused && "border !border-dashed !border-gray-200 px-2"} `,
          )}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t(
            isSpecialMode
              ? "common.model.params.stop_sequencesPlaceholder"
              : "datasetDocuments.segment.addKeyWord",
          )}
        />
      )}
    </div>
  )
}

export default TagInput
