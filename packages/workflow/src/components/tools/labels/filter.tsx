import type { FC } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import { useDebounceFn, useMount } from "ahooks"
import cn from "classnames"
import { RiArrowDownSLine } from "@remixicon/react"
import { useStore as useLabelStore } from "./store"
import {
  PortalToFollowElem,
  PortalToFollowElemContent,
  PortalToFollowElemTrigger,
} from "@/components/base/portal-to-follow-elem"
import SearchInput from "@/components/base/search-input"
import {
  Tag01,
  Tag03,
} from "@/components/base/icons/src/vender/line/financeAndECommerce"
import { Check } from "@/components/base/icons/src/vender/line/general"
import { XCircle } from "@/components/base/icons/src/vender/solid/general"
import type { Label } from "@/components/tools/labels/constant"
import { fetchLabelList } from "@/service/tools"
import I18n from "@/context/i18n"
import { getLanguage } from "@/i18n/language"

type LabelFilterProps = {
  value: string[]
  onChange: (v: string[]) => void
}
const LabelFilter: FC<LabelFilterProps> = ({ value, onChange }) => {
  const { t } = useTranslation()
  const { locale } = useContext(I18n)
  const language = getLanguage(locale)
  const [open, setOpen] = useState(false)

  const labelList = useLabelStore(s => s.labelList)
  const setLabelList = useLabelStore(s => s.setLabelList)

  const [keywords, setKeywords] = useState("")
  const [searchKeywords, setSearchKeywords] = useState("")
  const { run: handleSearch } = useDebounceFn(
    () => {
      setSearchKeywords(keywords)
    },
    { wait: 500 },
  )
  const handleKeywordsChange = (value: string) => {
    setKeywords(value)
    handleSearch()
  }

  const filteredLabelList = useMemo(() => {
    return labelList.filter(label => label.name.includes(searchKeywords))
  }, [labelList, searchKeywords])

  const currentLabel = useMemo(() => {
    return labelList.find(label => label.name === value[0])
  }, [value, labelList])

  const selectLabel = (label: Label) => {
    if (value.includes(label.name))
      onChange(value.filter(v => v !== label.name))
    else onChange([...value, label.name])
  }

  useMount(() => {
    fetchLabelList().then(res => {
      setLabelList(res)
    })
  })

  return (
    <PortalToFollowElem
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      offset={4}>
      <div className="relative">
        <PortalToFollowElemTrigger
          onClick={() => setOpen(v => !v)}
          className="block">
          <div
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1 rounded-lg border-[0.5px] border-transparent bg-gray-200 px-2 hover:bg-gray-300",
              open && !value.length && "!bg-gray-300 hover:bg-gray-300",
              !open &&
                !!value.length &&
                "shadow-xs !border-black/5 !bg-white/80 hover:!bg-gray-200",
              open &&
                !!value.length &&
                "shadow-xs !border-black/5 !bg-gray-200 hover:!bg-gray-200",
            )}>
            <div className="p-[1px]">
              <Tag01 className="h-3.5 w-3.5 text-gray-700" />
            </div>
            <div className="text-[13px] leading-[18px] text-gray-700">
              {!value.length && t("common.tag.placeholder")}
              {!!value.length && currentLabel?.label[language]}
            </div>
            {value.length > 1 && (
              <div className="text-xs font-medium leading-[18px] text-gray-500">{`+${value.length - 1}`}</div>
            )}
            {!value.length && (
              <div className="p-[1px]">
                <RiArrowDownSLine className="h-3.5 w-3.5 text-gray-700" />
              </div>
            )}
            {!!value.length && (
              <div
                className="group/clear cursor-pointer p-[1px]"
                onClick={e => {
                  e.stopPropagation()
                  onChange([])
                }}>
                <XCircle className="h-3.5 w-3.5 text-gray-400 group-hover/clear:text-gray-600" />
              </div>
            )}
          </div>
        </PortalToFollowElemTrigger>
        <PortalToFollowElemContent className="z-[1002]">
          <div className="relative w-[240px] rounded-lg border-[0.5px] border-gray-200 bg-white shadow-lg">
            <div className="border-b-[0.5px] border-black/5 p-2">
              <SearchInput
                white
                value={keywords}
                onChange={handleKeywordsChange}
              />
            </div>
            <div className="p-1">
              {filteredLabelList.map(label => (
                <div
                  key={label.name}
                  className="flex cursor-pointer items-center gap-2 rounded-lg py-[6px] pl-3 pr-2 hover:bg-gray-100"
                  onClick={() => selectLabel(label)}>
                  <div
                    title={label.label[language]}
                    className="grow truncate text-sm leading-5 text-gray-700">
                    {label.label[language]}
                  </div>
                  {value.includes(label.name) && (
                    <Check className="text-primary-600 h-4 w-4 shrink-0" />
                  )}
                </div>
              ))}
              {!filteredLabelList.length && (
                <div className="flex flex-col items-center gap-1 p-3">
                  <Tag03 className="h-6 w-6 text-gray-300" />
                  <div className="text-xs leading-[14px] text-gray-500">
                    {t("common.tag.noTag")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </PortalToFollowElemContent>
      </div>
    </PortalToFollowElem>
  )
}

export default LabelFilter
