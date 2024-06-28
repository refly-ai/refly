import type { FC } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { RiSearchLine } from "@remixicon/react"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"

type SearchInputProps = {
  placeholder?: string
  className?: string
  value: string
  onChange: (v: string) => void
  white?: boolean
}
const SearchInput: FC<SearchInputProps> = ({
  placeholder,
  className,
  value,
  onChange,
  white,
}) => {
  const { t } = useTranslation()
  const [focus, setFocus] = useState<boolean>(false)

  return (
    <div
      className={cn(
        "group flex h-8 items-center overflow-hidden rounded-lg border border-transparent bg-gray-200 px-2 hover:bg-gray-300",
        focus && "shawdow-xs !border-gray-300 !bg-white hover:bg-white",
        !focus &&
          value &&
          "hover:!shawdow-xs hover:!border-black/5 hover:!bg-gray-200",
        white &&
          "shawdow-xs !border-gray-300 !bg-white hover:!border-gray-300 hover:!bg-white",
        className,
      )}>
      <div className="pointer-events-none mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <RiSearchLine
          className="h-3.5 w-3.5 text-gray-500"
          aria-hidden="true"
        />
      </div>
      <input
        type="text"
        name="query"
        className={cn(
          "block h-[18px] grow appearance-none rounded-md border-0 bg-gray-200 text-[13px] text-gray-700 caret-blue-600 outline-none placeholder:text-gray-500 group-hover:bg-gray-300",
          focus &&
            "!bg-white placeholder:!text-gray-400 hover:bg-white group-hover:bg-white",
          !focus && value && "hover:!bg-gray-200 group-hover:!bg-gray-200",
          white &&
            "!bg-white placeholder:!text-gray-400 hover:!bg-white group-hover:!bg-white",
        )}
        placeholder={placeholder || t("common.operation.search")!}
        value={value}
        onChange={e => {
          onChange(e.target.value)
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        autoComplete="off"
      />
      {value && (
        <div
          className="group/clear flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
          onClick={() => onChange("")}>
          <XCircle className="h-3.5 w-3.5 text-gray-400 group-hover/clear:text-gray-600" />
        </div>
      )}
    </div>
  )
}

export default SearchInput
