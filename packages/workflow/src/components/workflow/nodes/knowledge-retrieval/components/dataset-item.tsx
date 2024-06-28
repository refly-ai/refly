"use client"
import type { FC } from "react"
import React, { useCallback } from "react"
import { useBoolean } from "ahooks"
import { RiDeleteBinLine } from "@remixicon/react"
import type { DataSet } from "@/models/datasets"
import { DataSourceType } from "@/models/datasets"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import FileIcon from "@/components/base/file-icon"
import { Folder } from "@/components/base/icons/src/vender/solid/files"
import SettingsModal from "@/components/configuration/dataset-config/settings-modal"
import Drawer from "@/components/base/drawer"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"

type Props = {
  payload: DataSet
  onRemove: () => void
  onChange: (dataSet: DataSet) => void
  readonly?: boolean
}

const DatasetItem: FC<Props> = ({ payload, onRemove, onChange, readonly }) => {
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const [
    isShowSettingsModal,
    { setTrue: showSettingsModal, setFalse: hideSettingsModal },
  ] = useBoolean(false)

  const handleSave = useCallback(
    (newDataset: DataSet) => {
      onChange(newDataset)
      hideSettingsModal()
    },
    [hideSettingsModal, onChange],
  )

  return (
    <div className="group/dataset-item flex h-10 cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white px-2">
      <div className="flex w-0 grow items-center space-x-1.5">
        {payload.data_source_type === DataSourceType.NOTION ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[#EAECF5]">
            <FileIcon type="notion" className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[#E0EAFF] bg-[#F5F8FF]">
            <Folder className="h-4 w-4 text-[#444CE7]" />
          </div>
        )}
        <div className="w-0 grow truncate text-[13px] font-normal text-gray-800">
          {payload.name}
        </div>
      </div>
      {!readonly && (
        <div className="ml-2 hidden shrink-0 items-center space-x-1 group-hover/dataset-item:flex">
          <div
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
            onClick={showSettingsModal}>
            <Settings01 className="h-4 w-4 text-gray-500" />
          </div>
          <div
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
            onClick={onRemove}>
            <RiDeleteBinLine className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      )}

      {isShowSettingsModal && (
        <Drawer
          isOpen={isShowSettingsModal}
          onClose={hideSettingsModal}
          footer={null}
          mask={isMobile}
          panelClassname="mt-16 mx-2 sm:mr-2 mb-3 !p-0 !max-w-[640px] rounded-xl">
          <SettingsModal
            currentDataset={payload}
            onCancel={hideSettingsModal}
            onSave={handleSave}
          />
        </Drawer>
      )}
    </div>
  )
}
export default React.memo(DatasetItem)
