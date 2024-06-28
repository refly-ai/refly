"use client"
import type { FC } from "react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { RiDeleteBinLine } from "@remixicon/react"
import SettingsModal from "../settings-modal"
import type { DataSet } from "@/models/datasets"
import { DataSourceType } from "@/models/datasets"
import { formatNumber } from "@/utils/format"
import FileIcon from "@/components/base/file-icon"
import { Settings01 } from "@/components/base/icons/src/vender/line/general"
import { Folder } from "@/components/base/icons/src/vender/solid/files"
import { Globe06 } from "@/components/base/icons/src/vender/solid/mapsAndTravel"
import Drawer from "@/components/base/drawer"
import useBreakpoints, { MediaType } from "@/hooks/use-breakpoints"

type ItemProps = {
  className?: string
  config: DataSet
  onRemove: (id: string) => void
  readonly?: boolean
  onSave: (newDataset: DataSet) => void
}

const Item: FC<ItemProps> = ({ config, onSave, onRemove }) => {
  const { t } = useTranslation()

  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const handleSave = (newDataset: DataSet) => {
    onSave(newDataset)
    setShowSettingsModal(false)
  }

  return (
    <div className="shadow-xs group relative mb-1 flex w-full items-center rounded-lg border-[0.5px] border-gray-200 bg-white py-2 pl-2.5 pr-3 last-of-type:mb-0">
      {config.data_source_type === DataSourceType.FILE && (
        <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[#E0EAFF] bg-[#F5F8FF]">
          <Folder className="h-4 w-4 text-[#444CE7]" />
        </div>
      )}
      {config.data_source_type === DataSourceType.NOTION && (
        <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[#EAECF5]">
          <FileIcon type="notion" className="h-4 w-4" />
        </div>
      )}
      {config.data_source_type === DataSourceType.WEB && (
        <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-blue-100 bg-[#F5FAFF]">
          <Globe06 className="h-4 w-4 text-blue-600" />
        </div>
      )}
      <div className="grow">
        <div className="flex h-[18px] items-center">
          <div
            className="grow truncate text-[13px] font-medium text-gray-800"
            title={config.name}>
            {config.name}
          </div>
          <div className="shrink-0 text-xs text-gray-500">
            {formatNumber(config.word_count)}{" "}
            {t("appDebug.feature.dataSet.words")} ·{" "}
            {formatNumber(config.document_count)}{" "}
            {t("appDebug.feature.dataSet.textBlocks")}
          </div>
        </div>
        {/* {
          config.description && (
            <div className='text-xs text-gray-500'>{config.description}</div>
          )
        } */}
      </div>
      <div className="absolute bottom-0 right-0 top-0 hidden w-[124px] items-center justify-end rounded-lg bg-gradient-to-r from-white/50 to-white to-50% pr-2 group-hover:flex">
        <div
          className="mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
          onClick={() => setShowSettingsModal(true)}>
          <Settings01 className="h-4 w-4 text-gray-500" />
        </div>
        <div
          className="group/action flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-[#FEE4E2]"
          onClick={() => onRemove(config.id)}>
          <RiDeleteBinLine className="h-4 w-4 text-gray-500 group-hover/action:text-[#D92D20]" />
        </div>
      </div>
      <Drawer
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        footer={null}
        mask={isMobile}
        panelClassname="mt-16 mx-2 sm:mr-2 mb-3 !p-0 !max-w-[640px] rounded-xl">
        <SettingsModal
          currentDataset={config}
          onCancel={() => setShowSettingsModal(false)}
          onSave={handleSave}
        />
      </Drawer>
    </div>
  )
}

export default Item
