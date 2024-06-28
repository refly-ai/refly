import type { FC } from "react"
import { useState } from "react"
import { RiSearchLine } from "@remixicon/react"
import type { DefaultModel, Model, ModelItem } from "../declarations"
import { useLanguage } from "../hooks"
import PopupItem from "./popup-item"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"

type PopupProps = {
  defaultModel?: DefaultModel
  modelList: Model[]
  onSelect: (provider: string, model: ModelItem) => void
}
const Popup: FC<PopupProps> = ({ defaultModel, modelList, onSelect }) => {
  const language = useLanguage()
  const [searchText, setSearchText] = useState("")

  const filteredModelList = modelList.filter(
    model =>
      model.models.filter(modelItem => {
        if (modelItem.label[language] !== undefined)
          return modelItem.label[language]
            .toLowerCase()
            .includes(searchText.toLowerCase())

        let found = false
        Object.keys(modelItem.label).forEach(key => {
          if (
            modelItem.label[key]
              .toLowerCase()
              .includes(searchText.toLowerCase())
          )
            found = true
        })

        return found
      }).length,
  )

  return (
    <div className="max-h-[480px] w-[320px] overflow-y-auto rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg">
      <div className="sticky top-0 z-10 bg-white pb-1 pl-3 pr-2 pt-3">
        <div
          className={`flex h-8 items-center rounded-lg border pl-[9px] pr-[10px] ${searchText ? "shadow-xs border-gray-300 bg-white" : "border-transparent bg-gray-100"} `}>
          <RiSearchLine
            className={`mr-[7px] h-[14px] w-[14px] shrink-0 ${searchText ? "text-gray-500" : "text-gray-400"} `}
          />
          <input
            className="block h-[18px] grow appearance-none bg-transparent text-[13px] outline-none"
            placeholder="Search model"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          {searchText && (
            <XCircle
              className="ml-1.5 h-[14px] w-[14px] shrink-0 cursor-pointer text-gray-400"
              onClick={() => setSearchText("")}
            />
          )}
        </div>
      </div>
      <div className="p-1">
        {filteredModelList.map(model => (
          <PopupItem
            key={model.provider}
            defaultModel={defaultModel}
            model={model}
            onSelect={onSelect}
          />
        ))}
        {!filteredModelList.length && (
          <div className="break-all px-3 py-1.5 text-center text-xs leading-[18px] text-gray-500">
            {`No model found for “${searchText}”`}
          </div>
        )}
      </div>
    </div>
  )
}

export default Popup
