"use client"
import type { FC } from "react"
import React from "react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import s from "./style.module.css"
import type { InputVarType } from "@/components/workflow/types"
import InputVarTypeIcon from "@/components/workflow/nodes/_base/components/input-var-type-icon"
export type ISelectTypeItemProps = {
  type: InputVarType
  selected: boolean
  onClick: () => void
}

const SelectTypeItem: FC<ISelectTypeItemProps> = ({
  type,
  selected,
  onClick,
}) => {
  const { t } = useTranslation()
  const typeName = t(`appDebug.variableConig.${type}`)

  return (
    <div
      className={cn(s.item, selected && s.selected, "space-y-1")}
      onClick={onClick}>
      <div className="shrink-0">
        <InputVarTypeIcon type={type} className="h-5 w-5" />
      </div>
      <span className={cn(s.text)}>{typeName}</span>
    </div>
  )
}
export default React.memo(SelectTypeItem)
