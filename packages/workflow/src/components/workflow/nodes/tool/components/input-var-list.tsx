"use client"
import type { FC } from "react"
import React, { useCallback, useState } from "react"
import produce from "immer"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import type { ToolVarInputs } from "../types"
import { VarType as VarKindType } from "../types"
import type { ValueSelector, Var } from "@/components/workflow/types"
import type { CredentialFormSchema } from "@/components/header/account-setting/model-provider-page/declarations"
import { FormTypeEnum } from "@/components/header/account-setting/model-provider-page/declarations"
import { useLanguage } from "@/components/header/account-setting/model-provider-page/hooks"
import VarReferencePicker from "@/components/workflow/nodes/_base/components/variable/var-reference-picker"
import Input from "@/components/workflow/nodes/_base/components/input-support-select-var"
import useAvailableVarList from "@/components/workflow/nodes/_base/hooks/use-available-var-list"
import { VarType } from "@/components/workflow/types"
type Props = {
  readOnly: boolean
  nodeId: string
  schema: CredentialFormSchema[]
  value: ToolVarInputs
  onChange: (value: ToolVarInputs) => void
  onOpen?: (index: number) => void
  isSupportConstantValue?: boolean
  filterVar?: (payload: Var, valueSelector: ValueSelector) => boolean
}

const InputVarList: FC<Props> = ({
  readOnly,
  nodeId,
  schema,
  value,
  onChange,
  onOpen = () => {},
  isSupportConstantValue,
  filterVar,
}) => {
  const language = useLanguage()
  const { t } = useTranslation()
  const { availableVars, availableNodesWithParent } = useAvailableVarList(
    nodeId,
    {
      onlyLeafNodeVar: false,
      filterVar: (varPayload: Var) => {
        return [VarType.string, VarType.number].includes(varPayload.type)
      },
    },
  )
  const paramType = (type: string) => {
    if (type === FormTypeEnum.textNumber) return "Number"
    else if (type === FormTypeEnum.files) return "Files"
    else return "String"
  }

  const handleNotMixedTypeChange = useCallback(
    (variable: string) => {
      return (varValue: ValueSelector | string, varKindType: VarKindType) => {
        const newValue = produce(value, (draft: ToolVarInputs) => {
          const target = draft[variable]
          if (target) {
            if (
              !isSupportConstantValue ||
              varKindType === VarKindType.variable
            ) {
              if (isSupportConstantValue) target.type = VarKindType.variable

              target.value = varValue as ValueSelector
            } else {
              target.type = VarKindType.constant
              target.value = varValue as string
            }
          } else {
            draft[variable] = {
              type: varKindType,
              value: varValue,
            }
          }
        })
        onChange(newValue)
      }
    },
    [value, onChange, isSupportConstantValue],
  )

  const handleMixedTypeChange = useCallback(
    (variable: string) => {
      return (itemValue: string) => {
        const newValue = produce(value, (draft: ToolVarInputs) => {
          const target = draft[variable]
          if (target) {
            target.value = itemValue
          } else {
            draft[variable] = {
              type: VarKindType.mixed,
              value: itemValue,
            }
          }
        })
        onChange(newValue)
      }
    },
    [value, onChange],
  )

  const [inputsIsFocus, setInputsIsFocus] = useState<Record<string, boolean>>(
    {},
  )
  const handleInputFocus = useCallback((variable: string) => {
    return (value: boolean) => {
      setInputsIsFocus(prev => {
        return {
          ...prev,
          [variable]: value,
        }
      })
    }
  }, [])
  const handleOpen = useCallback(
    (index: number) => {
      return () => onOpen(index)
    },
    [onOpen],
  )
  return (
    <div className="space-y-3">
      {schema.map(({ variable, label, type, required, tooltip }, index) => {
        const varInput = value[variable]
        const isNumber = type === FormTypeEnum.textNumber
        const isFile = type === FormTypeEnum.files
        const isString =
          type !== FormTypeEnum.textNumber && type !== FormTypeEnum.files
        return (
          <div key={variable} className="space-y-1">
            <div className="flex h-[18px] items-center space-x-2">
              <span className="text-[13px] font-medium text-gray-900">
                {label[language] || label.en_US}
              </span>
              <span className="text-xs font-normal text-gray-500">
                {paramType(type)}
              </span>
              {required && (
                <span className="text-xs font-normal leading-[18px] text-[#EC4A0A]">
                  Required
                </span>
              )}
            </div>
            {isString && (
              <Input
                className={cn(
                  inputsIsFocus[variable]
                    ? "shadow-xs border-gray-300 bg-gray-50"
                    : "border-gray-100 bg-gray-100",
                  "rounded-lg border px-3 py-[6px]",
                )}
                value={(varInput?.value as string) || ""}
                onChange={handleMixedTypeChange(variable)}
                readOnly={readOnly}
                nodesOutputVars={availableVars}
                availableNodes={availableNodesWithParent}
                onFocusChange={handleInputFocus(variable)}
                placeholder={t("workflow.nodes.http.insertVarPlaceholder")!}
                placeholderClassName="!leading-[21px]"
              />
            )}
            {isNumber && (
              <VarReferencePicker
                readonly={readOnly}
                isShowNodeName
                nodeId={nodeId}
                value={
                  varInput?.type === VarKindType.constant
                    ? varInput?.value || ""
                    : varInput?.value || []
                }
                onChange={handleNotMixedTypeChange(variable)}
                onOpen={handleOpen(index)}
                isSupportConstantValue={isSupportConstantValue}
                defaultVarKindType={varInput?.type}
                filterVar={filterVar}
              />
            )}
            {isFile && (
              <VarReferencePicker
                readonly={readOnly}
                isShowNodeName
                nodeId={nodeId}
                value={
                  varInput?.type === VarKindType.constant
                    ? varInput?.value || ""
                    : varInput?.value || []
                }
                onChange={handleNotMixedTypeChange(variable)}
                onOpen={handleOpen(index)}
                defaultVarKindType={VarKindType.variable}
                filterVar={(varPayload: Var) =>
                  varPayload.type === VarType.arrayFile
                }
              />
            )}
            {tooltip && (
              <div className="text-xs font-normal leading-[18px] text-gray-600">
                {tooltip[language] || tooltip.en_US}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
export default React.memo(InputVarList)
