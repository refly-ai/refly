import type { FC } from "react"
import { useEffect, useRef, useState } from "react"
import cn from "classnames"
import { RiQuestionLine } from "@remixicon/react"
import type { ModelParameterRule } from "../declarations"
import { useLanguage } from "../hooks"
import { isNullOrUndefined } from "../utils"
import Switch from "@/components/base/switch"
import Tooltip from "@/components/base/tooltip"
import Slider from "@/components/base/slider"
import Radio from "@/components/base/radio"
import { SimpleSelect } from "@/components/base/select"
import TagInput from "@/components/base/tag-input"

export type ParameterValue = number | string | string[] | boolean | undefined

type ParameterItemProps = {
  parameterRule: ModelParameterRule
  value?: ParameterValue
  onChange?: (value: ParameterValue) => void
  className?: string
  onSwitch?: (checked: boolean, assignValue: ParameterValue) => void
  isInWorkflow?: boolean
}
const ParameterItem: FC<ParameterItemProps> = ({
  parameterRule,
  value,
  onChange,
  className,
  onSwitch,
  isInWorkflow,
}) => {
  const language = useLanguage()
  const [localValue, setLocalValue] = useState(value)
  const numberInputRef = useRef<HTMLInputElement>(null)

  const getDefaultValue = () => {
    let defaultValue: ParameterValue

    if (parameterRule.type === "int" || parameterRule.type === "float")
      defaultValue = isNullOrUndefined(parameterRule.default)
        ? parameterRule.min || 0
        : parameterRule.default
    else if (parameterRule.type === "string")
      defaultValue = parameterRule.options?.length
        ? parameterRule.default || ""
        : parameterRule.default || ""
    else if (parameterRule.type === "boolean")
      defaultValue = !isNullOrUndefined(parameterRule.default)
        ? parameterRule.default
        : false
    else if (parameterRule.type === "tag")
      defaultValue = !isNullOrUndefined(parameterRule.default)
        ? parameterRule.default
        : []

    return defaultValue
  }

  const renderValue = value ?? localValue ?? getDefaultValue()

  const handleInputChange = (newValue: ParameterValue) => {
    setLocalValue(newValue)

    if (
      onChange &&
      (parameterRule.name === "stop" || !isNullOrUndefined(value))
    )
      onChange(newValue)
  }

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = +e.target.value

    if (!isNullOrUndefined(parameterRule.max) && num > parameterRule.max!) {
      num = parameterRule.max as number
      numberInputRef.current!.value = `${num}`
    }

    if (!isNullOrUndefined(parameterRule.min) && num < parameterRule.min!)
      num = parameterRule.min as number

    handleInputChange(num)
  }

  const handleNumberInputBlur = () => {
    if (numberInputRef.current)
      numberInputRef.current.value = renderValue as string
  }

  const handleSlideChange = (num: number) => {
    if (!isNullOrUndefined(parameterRule.max) && num > parameterRule.max!) {
      handleInputChange(parameterRule.max)
      numberInputRef.current!.value = `${parameterRule.max}`
      return
    }

    if (!isNullOrUndefined(parameterRule.min) && num < parameterRule.min!) {
      handleInputChange(parameterRule.min)
      numberInputRef.current!.value = `${parameterRule.min}`
      return
    }

    handleInputChange(num)
    numberInputRef.current!.value = `${num}`
  }

  const handleRadioChange = (v: number) => {
    handleInputChange(v === 1)
  }

  const handleStringInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e.target.value)
  }

  const handleSelect = (option: { value: string | number; name: string }) => {
    handleInputChange(option.value)
  }

  const handleTagChange = (newSequences: string[]) => {
    handleInputChange(newSequences)
  }

  const handleSwitch = (checked: boolean) => {
    if (onSwitch) {
      const assignValue: ParameterValue = localValue || getDefaultValue()

      onSwitch(checked, assignValue)
    }
  }

  useEffect(() => {
    if (
      (parameterRule.type === "int" || parameterRule.type === "float") &&
      numberInputRef.current
    )
      numberInputRef.current.value = `${renderValue}`
  }, [value])

  const renderInput = () => {
    const numberInputWithSlide =
      (parameterRule.type === "int" || parameterRule.type === "float") &&
      !isNullOrUndefined(parameterRule.min) &&
      !isNullOrUndefined(parameterRule.max)

    if (parameterRule.type === "int" || parameterRule.type === "float") {
      let step = 100
      if (parameterRule.max) {
        if (parameterRule.max < 10) step = 0.1
        else if (parameterRule.max < 100) step = 1
        else if (parameterRule.max < 1000) step = 10
        else if (parameterRule.max < 10000) step = 100
      }

      return (
        <>
          {numberInputWithSlide && (
            <Slider
              className="w-[120px]"
              value={renderValue as number}
              min={parameterRule.min}
              max={parameterRule.max}
              step={step}
              onChange={handleSlideChange}
            />
          )}
          <input
            ref={numberInputRef}
            className="text-gra-900 ml-4 block h-8 w-16 shrink-0 appearance-none rounded-lg bg-gray-100 pl-3 text-[13px] outline-none"
            type="number"
            max={parameterRule.max}
            min={parameterRule.min}
            step={
              numberInputWithSlide ? step : +`0.${parameterRule.precision || 0}`
            }
            onChange={handleNumberInputChange}
            onBlur={handleNumberInputBlur}
          />
        </>
      )
    }

    if (parameterRule.type === "boolean") {
      return (
        <Radio.Group
          className="flex w-[200px] items-center"
          value={renderValue ? 1 : 0}
          onChange={handleRadioChange}>
          <Radio value={1} className="!mr-1 w-[94px]">
            True
          </Radio>
          <Radio value={0} className="w-[94px]">
            False
          </Radio>
        </Radio.Group>
      )
    }

    if (parameterRule.type === "string" && !parameterRule.options?.length) {
      return (
        <input
          className={cn(
            isInWorkflow ? "w-[200px]" : "w-full",
            "text-gra-900 ml-4 flex h-8 appearance-none items-center rounded-lg bg-gray-100 px-3 text-[13px] outline-none",
          )}
          value={renderValue as string}
          onChange={handleStringInputChange}
        />
      )
    }

    if (parameterRule.type === "string" && !!parameterRule?.options?.length) {
      return (
        <SimpleSelect
          className="!py-0"
          wrapperClassName={cn(
            isInWorkflow ? "!w-[200px]" : "w-full",
            "ml-4 !h-8",
          )}
          defaultValue={renderValue as string}
          onSelect={handleSelect}
          items={parameterRule.options.map(option => ({
            value: option,
            name: option,
          }))}
        />
      )
    }

    if (parameterRule.type === "tag") {
      return (
        <div className={cn(isInWorkflow ? "w-[200px]" : "w-full", "ml-4")}>
          <TagInput
            items={renderValue as string[]}
            onChange={handleTagChange}
            customizedConfirmKey="Tab"
            isInWorkflow={isInWorkflow}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <div
          className={cn(
            isInWorkflow ? "w-[140px]" : "w-full",
            "ml-4 flex shrink-0 items-center",
          )}>
          <div
            className="mr-0.5 truncate text-[13px] font-medium text-gray-700"
            title={parameterRule.label[language] || parameterRule.label.en_US}>
            {parameterRule.label[language] || parameterRule.label.en_US}
          </div>
          {parameterRule.help && (
            <Tooltip
              selector={`model-parameter-rule-${parameterRule.name}`}
              htmlContent={
                <div className="w-[200px] whitespace-pre-wrap">
                  {parameterRule.help[language] || parameterRule.help.en_US}
                </div>
              }>
              <RiQuestionLine className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
            </Tooltip>
          )}
          {!parameterRule.required && parameterRule.name !== "stop" && (
            <Switch
              defaultValue={!isNullOrUndefined(value)}
              onChange={handleSwitch}
              size="md"
            />
          )}
        </div>
        {parameterRule.type === "tag" && (
          <div
            className={cn(
              !isInWorkflow && "w-[200px]",
              "text-xs font-normal text-gray-400",
            )}>
            {parameterRule?.tagPlaceholder?.[language]}
          </div>
        )}
      </div>
      {renderInput()}
    </div>
  )
}

export default ParameterItem
