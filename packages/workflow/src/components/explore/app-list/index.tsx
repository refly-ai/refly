"use client"

import React, { useMemo, useState } from "react"
import cn from "classnames"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useContext } from "use-context-selector"
import useSWR from "swr"
import Toast from "../../base/toast"
import s from "./style.module.css"
import ExploreContext from "@/context/explore-context"
import type { App } from "@/models/explore"
import Category from "@/components/explore/category"
import { fetchAppDetail, fetchAppList } from "@/service/explore"
import { importApp } from "@/service/apps"
import { useTabSearchParams } from "@/hooks/use-tab-searchparams"
import CreateAppModal from "@/components/explore/create-app-modal"
import AppTypeSelector from "@/components/app/type-selector"
import type { CreateAppModalProps } from "@/components/explore/create-app-modal"
import Loading from "@/components/base/loading"
import { NEED_REFRESH_APP_LIST_KEY } from "@/config"
import { useAppContext } from "@/context/app-context"
import { getRedirection } from "@/utils/app-redirection"

type AppsProps = {
  pageType?: PageType
  onSuccess?: () => void
}

export enum PageType {
  EXPLORE = "explore",
  CREATE = "create",
}

const Apps = ({ pageType = PageType.EXPLORE, onSuccess }: AppsProps) => {
  const { t } = useTranslation()
  const { isCurrentWorkspaceEditor } = useAppContext()
  const { push } = useRouter()
  const { hasEditPermission } = useContext(ExploreContext)
  const allCategoriesEn = t("explore.apps.allCategories", { lng: "en" })

  const [currentType, setCurrentType] = useState<string>("")
  const [currCategory, setCurrCategory] = useTabSearchParams({
    defaultTab: allCategoriesEn,
    disableSearchParams: pageType !== PageType.EXPLORE,
  })

  const {
    data: { categories, allList },
  } = useSWR(
    ["/explore/apps"],
    () =>
      fetchAppList().then(({ categories, recommended_apps }) => ({
        categories,
        allList: recommended_apps.sort((a, b) => a.position - b.position),
      })),
    {
      fallbackData: {
        categories: [],
        allList: [],
      },
    },
  )

  const filteredList = useMemo(() => {
    if (currCategory === allCategoriesEn) {
      if (!currentType) return allList
      else if (currentType === "chatbot")
        return allList.filter(
          item => item.app.mode === "chat" || item.app.mode === "advanced-chat",
        )
      else if (currentType === "agent")
        return allList.filter(item => item.app.mode === "agent-chat")
      else return allList.filter(item => item.app.mode === "workflow")
    } else {
      if (!currentType)
        return allList.filter(item => item.category === currCategory)
      else if (currentType === "chatbot")
        return allList.filter(
          item =>
            (item.app.mode === "chat" || item.app.mode === "advanced-chat") &&
            item.category === currCategory,
        )
      else if (currentType === "agent")
        return allList.filter(
          item =>
            item.app.mode === "agent-chat" && item.category === currCategory,
        )
      else
        return allList.filter(
          item =>
            item.app.mode === "workflow" && item.category === currCategory,
        )
    }
  }, [currentType, currCategory, allCategoriesEn, allList])

  const [currApp, setCurrApp] = React.useState<App | null>(null)
  const [isShowCreateModal, setIsShowCreateModal] = React.useState(false)
  const onCreate: CreateAppModalProps["onConfirm"] = async ({
    name,
    icon,
    icon_background,
    description,
  }) => {
    const { export_data } = await fetchAppDetail(currApp?.app.id as string)
    try {
      const app = await importApp({
        data: export_data,
        name,
        icon,
        icon_background,
        description,
      })
      setIsShowCreateModal(false)
      Toast.notify({
        type: "success",
        message: t("app.newApp.appCreated"),
      })
      if (onSuccess) onSuccess()
      localStorage.setItem(NEED_REFRESH_APP_LIST_KEY, "1")
      getRedirection(isCurrentWorkspaceEditor, app, push)
    } catch (e) {
      Toast.notify({ type: "error", message: t("app.newApp.appCreateFailed") })
    }
  }

  if (!categories) {
    return (
      <div className="flex items-center h-full">
        <Loading type="area" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        pageType === PageType.EXPLORE
          ? "h-full border-l border-gray-200"
          : "h-[calc(100%-56px)]",
      )}>
      {pageType === PageType.EXPLORE && (
        <div className="px-12 pt-6 shrink-0">
          <div className={`mb-1 ${s.textGradient} text-xl font-semibold`}>
            {t("explore.apps.title")}
          </div>
          <div className="text-sm text-gray-500">
            {t("explore.apps.description")}
          </div>
        </div>
      )}
      <div
        className={cn(
          "mt-6 flex items-center",
          pageType === PageType.EXPLORE ? "px-12" : "px-8",
        )}>
        {pageType !== PageType.EXPLORE && (
          <>
            <AppTypeSelector value={currentType} onChange={setCurrentType} />
            <div className="mx-2 h-3.5 w-[1px] bg-gray-200" />
          </>
        )}
        <Category
          list={categories}
          value={currCategory}
          onChange={setCurrCategory}
          allCategoriesEn={allCategoriesEn}
        />
      </div>
      {isShowCreateModal && (
        <CreateAppModal
          appIcon={currApp?.app.icon || ""}
          appIconBackground={currApp?.app.icon_background || ""}
          appName={currApp?.app.name || ""}
          appDescription={currApp?.app.description || ""}
          show={isShowCreateModal}
          onConfirm={onCreate}
          onHide={() => setIsShowCreateModal(false)}
        />
      )}
    </div>
  )
}

export default React.memo(Apps)
