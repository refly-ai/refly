import React, { useEffect } from "react"
import { Route, Routes } from "react-router-dom"

// 页面
import Workspace from "@/pages/workflow"
import { safeParseJSON } from "@refly/ai-workspace-common/utils/parse"
import { useUserStore } from "@refly/ai-workspace-common/stores/user"
import { useTranslation } from "react-i18next"
import { LOCALE } from "@refly/constants"

// 样式
import "../styles/globals.css"
import "../styles/markdown.scss"

export const AppRouter = (props: { layout?: any }) => {
  return (
    <Routes>
      <Route path="/" element={<Workspace />} />
      {/* http://localhost:5173/app/08402e34-b33a-4cc4-8224-6c6ee453a773/workflow */}
      <Route path="/app/:appId/workflow" element={<Workspace />} />
    </Routes>
  )
}
