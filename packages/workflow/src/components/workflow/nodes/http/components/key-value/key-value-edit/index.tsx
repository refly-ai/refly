"use client"
import type { FC } from "react"
import React, { useCallback } from "react"
import produce from "immer"
import { useTranslation } from "react-i18next"
import type { KeyValue } from "../../../types"
import KeyValueItem from "./item"
// import TooltipPlus from '@/components/base/tooltip-plus'
// import { EditList } from '@/components/base/icons/src/vender/solid/communication'

const i18nPrefix = "workflow.nodes.http"

type Props = {
  readonly: boolean
  nodeId: string
  list: KeyValue[]
  onChange: (newList: KeyValue[]) => void
  onAdd: () => void
  // onSwitchToBulkEdit: () => void
}

const KeyValueList: FC<Props> = ({
  readonly,
  nodeId,
  list,
  onChange,
  onAdd,
  // onSwitchToBulkEdit,
}) => {
  const { t } = useTranslation()

  const handleChange = useCallback(
    (index: number) => {
      return (newItem: KeyValue) => {
        const newList = produce(list, (draft: any) => {
          draft[index] = newItem
        })
        onChange(newList)
      }
    },
    [list, onChange],
  )

  const handleRemove = useCallback(
    (index: number) => {
      return () => {
        const newList = produce(list, (draft: any) => {
          draft.splice(index, 1)
        })
        onChange(newList)
      }
    },
    [list, onChange],
  )

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex h-7 items-center text-xs font-medium uppercase leading-7 text-gray-500">
        <div className="h-full w-1/2 border-r border-gray-200 pl-3">
          {t(`${i18nPrefix}.key`)}
        </div>
        <div className="flex h-full w-1/2 items-center justify-between pl-3 pr-1">
          <div>{t(`${i18nPrefix}.value`)}</div>
          {/* {!readonly && (
            <TooltipPlus
              popupContent={t(`${i18nPrefix}.bulkEdit`)}
            >
              <div
                className='p-1 cursor-pointer rounded-md hover:bg-black/5 text-gray-500 hover:text-gray-800'
                onClick={onSwitchToBulkEdit}
              >
                <EditList className='w-3 h-3' />
              </div>
            </TooltipPlus>)} */}
        </div>
      </div>
      {list.map((item, index) => (
        <KeyValueItem
          key={item.id}
          instanceId={item.id!}
          nodeId={nodeId}
          payload={item}
          onChange={handleChange(index)}
          onRemove={handleRemove(index)}
          isLastItem={index === list.length - 1}
          onAdd={onAdd}
          readonly={readonly}
          canRemove={list.length > 1}
        />
      ))}
    </div>
  )
}
export default React.memo(KeyValueList)
