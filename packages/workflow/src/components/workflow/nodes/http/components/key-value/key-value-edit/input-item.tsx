"use client"
import type { FC } from "react"
import React, { useCallback, useState } from "react"
import cn from "classnames"
import { useTranslation } from "react-i18next"
import useAvailableVarList from "../../../../_base/hooks/use-available-var-list"
import RemoveButton from "@/components/workflow/nodes/_base/components/remove-button"
import Input from "@/components/workflow/nodes/_base/components/input-support-select-var"
import type { Var } from "@/components/workflow/types"
import { VarType } from "@/components/workflow/types"
type Props = {
  className?: string
  instanceId?: string
  nodeId: string
  value: string
  onChange: (newValue: string) => void
  hasRemove: boolean
  onRemove?: () => void
  placeholder?: string
  readOnly?: boolean
}

const InputItem: FC<Props> = ({
  className,
  instanceId,
  nodeId,
  value,
  onChange,
  hasRemove,
  onRemove,
  placeholder,
  readOnly,
}) => {
  const { t } = useTranslation()

  const hasValue = !!value

  const [isFocus, setIsFocus] = useState(false)
  const { availableVars, availableNodesWithParent } = useAvailableVarList(
    nodeId,
    {
      onlyLeafNodeVar: false,
      filterVar: (varPayload: Var) => {
        return [VarType.string, VarType.number].includes(varPayload.type)
      },
    },
  )

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove?.()
    },
    [onRemove],
  )

  return (
    <div
      className={cn(
        className,
        "hover:cursor-text hover:bg-gray-50",
        "relative flex h-full",
      )}>
      {!readOnly ? (
        <Input
          instanceId={instanceId}
          className={cn(
            isFocus ? "bg-gray-100" : "bg-width",
            "w-0 grow px-3 py-1",
          )}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          nodesOutputVars={availableVars}
          availableNodes={availableNodesWithParent}
          onFocusChange={setIsFocus}
          placeholder={t("workflow.nodes.http.insertVarPlaceholder")!}
          placeholderClassName="!leading-[21px]"
          promptMinHeightClassName="h-full"
        />
      ) : (
        <div className="h-[18px] w-full pl-0.5 leading-[18px]">
          {!hasValue && (
            <div className="text-xs font-normal text-gray-300">
              {placeholder}
            </div>
          )}
          {hasValue && (
            <Input
              instanceId={instanceId}
              className={cn(
                isFocus
                  ? "shadow-xs border-gray-300 bg-gray-50"
                  : "border-gray-100 bg-gray-100",
                "w-0 grow rounded-lg border px-3 py-[6px]",
              )}
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              nodesOutputVars={availableVars}
              availableNodes={availableNodesWithParent}
              onFocusChange={setIsFocus}
              placeholder={t("workflow.nodes.http.insertVarPlaceholder")!}
              placeholderClassName="!leading-[21px]"
              promptMinHeightClassName="h-full"
            />
          )}
        </div>
      )}
      {hasRemove && !isFocus && (
        <RemoveButton
          className="absolute right-1 top-0.5 hidden group-hover:block"
          onClick={handleRemove}
        />
      )}
    </div>
  )
}
export default React.memo(InputItem)
