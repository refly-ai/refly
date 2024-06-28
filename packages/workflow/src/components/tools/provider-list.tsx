"use client"
import { useEffect, useMemo, useState } from "react"
import cn from "classnames"
import { useTranslation } from "react-i18next"
import { RiCloseLine } from "@remixicon/react"
import type { Collection } from "./types"
import { useTabSearchParams } from "@/hooks/use-tab-searchparams"
import TabSliderNew from "@/components/base/tab-slider-new"
import LabelFilter from "@/components/tools/labels/filter"
import SearchInput from "@/components/base/search-input"
import { DotsGrid } from "@/components/base/icons/src/vender/line/general"
import { Colors } from "@/components/base/icons/src/vender/line/others"
import { Route } from "@/components/base/icons/src/vender/line/mapsAndTravel"
import CustomCreateCard from "@/components/tools/provider/custom-create-card"
import ContributeCard from "@/components/tools/provider/contribute"
import ProviderCard from "@/components/tools/provider/card"
import ProviderDetail from "@/components/tools/provider/detail"
import Empty from "@/components/tools/add-tool-modal/empty"
import { fetchCollectionList } from "@/service/tools"

const ProviderList = () => {
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useTabSearchParams({
    defaultTab: "builtin",
  })
  const options = [
    {
      value: "builtin",
      text: t("tools.type.builtIn"),
      icon: <DotsGrid className="mr-1 h-[14px] w-[14px]" />,
    },
    {
      value: "api",
      text: t("tools.type.custom"),
      icon: <Colors className="mr-1 h-[14px] w-[14px]" />,
    },
    {
      value: "workflow",
      text: t("tools.type.workflow"),
      icon: <Route className="mr-1 h-[14px] w-[14px]" />,
    },
  ]
  const [tagFilterValue, setTagFilterValue] = useState<string[]>([])
  const handleTagsChange = (value: string[]) => {
    setTagFilterValue(value)
  }
  const [keywords, setKeywords] = useState<string>("")
  const handleKeywordsChange = (value: string) => {
    setKeywords(value)
  }

  const [collectionList, setCollectionList] = useState<Collection[]>([])
  const filteredCollectionList = useMemo(() => {
    return collectionList.filter(collection => {
      if (collection.type !== activeTab) return false
      if (
        tagFilterValue.length > 0 &&
        (!collection.labels ||
          collection.labels.every(label => !tagFilterValue.includes(label)))
      )
        return false
      if (keywords)
        return collection.name.toLowerCase().includes(keywords.toLowerCase())
      return true
    })
  }, [activeTab, tagFilterValue, keywords, collectionList])
  const getProviderList = async () => {
    const list = await fetchCollectionList()
    setCollectionList([...list])
  }
  useEffect(() => {
    getProviderList()
  }, [])

  const [currentProvider, setCurrentProvider] = useState<
    Collection | undefined
  >()
  useEffect(() => {
    if (currentProvider && collectionList.length > 0) {
      const newCurrentProvider = collectionList.find(
        collection => collection.id === currentProvider.id,
      )
      setCurrentProvider(newCurrentProvider)
    }
  }, [collectionList, currentProvider])

  return (
    <div className="relative flex h-0 shrink-0 grow overflow-hidden bg-gray-100">
      <div className="relative flex grow flex-col overflow-y-auto bg-gray-100">
        <div
          className={cn(
            "sticky top-0 z-20 flex flex-wrap items-center justify-between gap-y-2 bg-gray-100 px-12 pb-2 pt-4 leading-[56px]",
            currentProvider && "pr-6",
          )}>
          <TabSliderNew
            value={activeTab}
            onChange={state => {
              setActiveTab(state)
              if (state !== activeTab) setCurrentProvider(undefined)
            }}
            options={options}
          />
          <div className="flex items-center gap-2">
            <LabelFilter value={tagFilterValue} onChange={handleTagsChange} />
            <SearchInput
              className="w-[200px]"
              value={keywords}
              onChange={handleKeywordsChange}
            />
          </div>
        </div>
        <div
          className={cn(
            "relative grid shrink-0 grow grid-cols-1 content-start gap-4 px-12 pb-4 pt-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            currentProvider &&
              "pr-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          )}>
          {activeTab === "builtin" && <ContributeCard />}
          {activeTab === "api" && (
            <CustomCreateCard onRefreshData={getProviderList} />
          )}
          {filteredCollectionList.map(collection => (
            <ProviderCard
              active={currentProvider?.id === collection.id}
              onSelect={() => setCurrentProvider(collection)}
              key={collection.id}
              collection={collection}
            />
          ))}
          {!filteredCollectionList.length && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Empty />
            </div>
          )}
        </div>
      </div>
      <div
        className={cn(
          "border-black/8 w-0 shrink-0 overflow-y-auto border-l-[0.5px] transition-all duration-200 ease-in-out",
          currentProvider && "w-[420px]",
        )}>
        {currentProvider && (
          <ProviderDetail
            collection={currentProvider}
            onRefreshData={getProviderList}
          />
        )}
      </div>
      <div
        className="absolute right-5 top-5 cursor-pointer p-1"
        onClick={() => setCurrentProvider(undefined)}>
        <RiCloseLine className="h-4 w-4" />
      </div>
    </div>
  )
}
ProviderList.displayName = "ToolProviderList"
export default ProviderList
