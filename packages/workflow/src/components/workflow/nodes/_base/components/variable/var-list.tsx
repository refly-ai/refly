"use client"
import type { FC } from "react"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"
import produce from "immer"
import RemoveButton from "../remove-button"
import VarReferencePicker from "./var-reference-picker"
import type { ValueSelector, Var, Variable } from "@/components/workflow/types"
import { VarType as VarKindType } from "@/components/workflow/nodes/tool/types"

type Props = {
  nodeId: string
  readonly: boolean
  list: Variable[]
  onChange: (list: Variable[]) => void
  onVarNameChange?: (oldName: string, newName: string) => void
  isSupportConstantValue?: boolean
  onlyLeafNodeVar?: boolean
  filterVar?: (payload: Var, valueSelector: ValueSelector) => boolean
}

const VarList: FC<Props> = ({
  nodeId,
  readonly,
  list,
  onChange,
  onVarNameChange,
  isSupportConstantValue,
  onlyLeafNodeVar,
  filterVar,
}) => {
  const { t } = useTranslation()

  const handleVarNameChange = useCallback(
    (index: number) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        onVarNameChange?.(list[index].variable, e.target.value)
        const newList = produce(list, draft => {
          draft[index].variable = e.target.value
        })
        onChange(newList)
      }
    },
    [list, onVarNameChange, onChange],
  )

  const handleVarReferenceChange = useCallback(
    (index: number) => {
      return (value: ValueSelector | string, varKindType: VarKindType) => {
        const newList = produce(list, draft => {
          if (!isSupportConstantValue || varKindType === VarKindType.variable) {
            draft[index].value_selector = value as ValueSelector
            if (isSupportConstantValue)
              draft[index].variable_type = VarKindType.variable

            if (!draft[index].variable)
              draft[index].variable = value[value.length - 1]
          } else {
            draft[index].variable_type = VarKindType.constant
            draft[index].value_selector = value as ValueSelector
            draft[index].value = value as string
          }
        })
        onChange(newList)
      }
    },
    [isSupportConstantValue, list, onChange],
  )

  const handleVarRemove = useCallback(
    (index: number) => {
      return () => {
        const newList = produce(list, draft => {
          draft.splice(index, 1)
        })
        onChange(newList)
      }
    },
    [list, onChange],
  )

  return (
    <div className="space-y-2">
      {list.map((item, index) => (
        <div className="flex items-center space-x-1" key={index}>
          <input
            readOnly={readonly}
            value={list[index].variable}
            onChange={handleVarNameChange(index)}
            placeholder={t("workflow.common.variableNamePlaceholder")!}
            className="h-8 w-[120px] rounded-lg border-0 bg-gray-100 px-2.5 text-[13px] leading-8 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-200"
            type="text"
          />
          <VarReferencePicker
            nodeId={nodeId}
            readonly={readonly}
            isShowNodeName
            className="grow"
            value={
              item.variable_type === VarKindType.constant
                ? item.value || ""
                : item.value_selector || []
            }
            isSupportConstantValue={isSupportConstantValue}
            onChange={handleVarReferenceChange(index)}
            defaultVarKindType={item.variable_type}
            onlyLeafNodeVar={onlyLeafNodeVar}
            filterVar={filterVar}
          />
          {!readonly && (
            <RemoveButton
              className="!bg-gray-100 !p-2 hover:!bg-gray-200"
              onClick={handleVarRemove(index)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
export default React.memo(VarList)
