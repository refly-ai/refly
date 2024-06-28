import React, { useEffect } from "react"
import { Route, Routes } from "react-router-dom"

// 页面
import Workspace from "@/pages/workflow"
import { safeParseJSON } from "@refly/ai-workspace-common/utils/parse"
import { useUserStore } from "@refly/ai-workspace-common/stores/user"
import { useTranslation } from "react-i18next"
import { LOCALE } from "@refly/constants"

export const AppRouter = (props: { layout?: any }) => {
  const { layout: Layout } = props
  const userStore = useUserStore()

  const { i18n } = useTranslation()
  const language = i18n.languages?.[0]

  // 获取 locale
  const storageLocalSettings = safeParseJSON(
    localStorage.getItem("refly-local-settings"),
  )
  const locale =
    storageLocalSettings?.uiLocale ||
    userStore?.localSettings?.uiLocale ||
    LOCALE.EN

  // TODO: 国际化相关内容
  useEffect(() => {
    if (locale && language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [locale])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Workspace />} />
      </Routes>
    </Layout>
  )
}
