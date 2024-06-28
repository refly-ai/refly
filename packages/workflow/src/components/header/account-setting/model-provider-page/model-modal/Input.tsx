import type { FC } from "react"
import { CheckCircle } from "@/components/base/icons/src/vender/solid/general"

type InputProps = {
  value?: string
  onChange: (v: string) => void
  onFocus?: () => void
  placeholder?: string
  validated?: boolean
  className?: string
  disabled?: boolean
  type?: string
  min?: number
  max?: number
}
const Input: FC<InputProps> = ({
  value,
  onChange,
  onFocus,
  placeholder,
  validated,
  className,
  disabled,
  type = "text",
  min,
  max,
}) => {
  const toLimit = (v: string) => {
    const minNum = parseFloat(`${min}`)
    const maxNum = parseFloat(`${max}`)
    if (!isNaN(minNum) && parseFloat(v) < minNum) {
      onChange(`${min}`)
      return
    }

    if (!isNaN(maxNum) && parseFloat(v) > maxNum) onChange(`${max}`)
  }
  return (
    <div className="relative">
      <input
        tabIndex={0}
        className={`caret-primary-600 focus:shadow-xs block h-9 w-full appearance-none rounded-lg border border-transparent bg-gray-100 px-3 text-sm outline-none placeholder:text-sm placeholder:text-gray-400 hover:border-[rgba(0,0,0,0.08)] hover:bg-gray-50 focus:border-gray-300 focus:bg-white ${validated && "pr-[30px]"} ${className} `}
        placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)}
        onBlur={e => toLimit(e.target.value)}
        onFocus={onFocus}
        value={value || ""}
        disabled={disabled}
        type={type}
        min={min}
        max={max}
      />
      {validated && (
        <div className="absolute right-2.5 top-2.5">
          <CheckCircle className="h-4 w-4 text-[#039855]" />
        </div>
      )}
    </div>
  )
}

export default Input
