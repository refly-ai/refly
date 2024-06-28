import type { FC } from "react"
import React, { useCallback, useState } from "react"
import { t } from "i18next"
import { RiArrowDownSLine, RiSearchLine } from "@remixicon/react"
import type { CodeDependency } from "./types"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import { Check } from "@/components/base/icons/src/vender/line/general"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"

type Props = {
  value: CodeDependency
  available_dependencies: CodeDependency[]
  onChange: (dependency: CodeDependency) => void
}

const DependencyPicker: FC<Props> = ({
  available_dependencies,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState("")

  const handleChange = useCallback(
    (dependency: CodeDependency) => {
      return () => {
        setOpen(false)
        onChange(dependency)
      }
    },
    [onChange],
  )

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}>
      <PortalToFollowElemTrigger
        onClick={() => setOpen(!open)}
        className="flex-grow cursor-pointer">
        <div className="flex h-8 items-center justify-between rounded-lg border-0 bg-gray-100 px-2.5 text-[13px] text-gray-900">
          <div className="w-0 grow truncate" title={value.name}>
            {value.name}
          </div>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-gray-700" />
        </div>
      </PortalToFollowElemTrigger>
      <PortalToFollowElemContent
        style={{
          zIndex: 100,
        }}>
        <div
          className="rounded-lg bg-white p-1 shadow-sm"
          style={{
            width: 350,
          }}>
          <div className="mx-1 mb-2 flex items-center rounded-lg bg-gray-100 bg-white px-2 shadow-sm">
            <RiSearchLine className="ml-[1px] mr-[5px] h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              value={searchText}
              className="caret-primary-600 grow appearance-none bg-transparent px-0.5 py-[7px] text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
              placeholder={t("workflow.nodes.code.searchDependencies") || ""}
              onChange={e => setSearchText(e.target.value)}
              autoFocus
            />
            {searchText && (
              <div
                className="ml-[5px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center"
                onClick={() => setSearchText("")}>
                <XCircle className="h-[14px] w-[14px] text-gray-400" />
              </div>
            )}
          </div>
          <div className="max-h-[30vh] overflow-y-auto">
            {available_dependencies
              .filter(v => {
                if (!searchText) return true
                return v.name.toLowerCase().includes(searchText.toLowerCase())
              })
              .map(dependency => (
                <div
                  key={dependency.name}
                  className="flex h-[30px] cursor-pointer items-center justify-between rounded-lg pl-3 pr-2 text-[13px] text-gray-900 hover:bg-gray-100"
                  onClick={handleChange(dependency)}>
                  <div className="w-0 grow truncate">{dependency.name}</div>
                  {dependency.name === value.name && (
                    <Check className="text-primary-600 h-4 w-4 shrink-0" />
                  )}
                </div>
              ))}
          </div>
        </div>
      </PortalToFollowElemContent>
    </PortalToFollowElem>
  )
}

export default React.memo(DependencyPicker)
