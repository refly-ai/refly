import { lazy, Suspense } from "react"
import { Route, Routes, useMatch } from "react-router-dom"
import { Spin } from "@arco-design/web-react"
import { useEffect } from "react"
import { safeParseJSON } from "@refly-packages/ai-workspace-common/utils/parse"
import { useUserStoreShallow } from "@refly-packages/ai-workspace-common/stores/user"
import { useTranslation } from "react-i18next"
import { useGetUserSettings } from "@refly-packages/ai-workspace-common/hooks/use-get-user-settings"
import { useHandleEditorEmitter } from "@refly-packages/ai-workspace-common/hooks/use-handle-editor-emitter"
import { LOCALE } from "@refly/common-types"
import {
  BetaProtectedRoute,
  RequestAccessRoute,
} from "@refly-packages/ai-workspace-common/components/request-access/protected-route"

// Lazy load components
const Home = lazy(() => import("@/pages/home"))
const Library = lazy(() => import("@/pages/library"))
const Resource = lazy(() => import("@/pages/resource"))
const ConvLibrary = lazy(() => import("@/pages/conv-library"))
const ConvItem = lazy(() => import("@/pages/conv-item"))
const Project = lazy(() => import("@/pages/project"))
const Skill = lazy(() => import("@/pages/skill"))
const SkillDetailPage = lazy(() => import("@/pages/skill-detail"))
const Settings = lazy(() => import("@/pages/settings"))
const ShareContent = lazy(() => import("@/pages/share-content"))

// Loading component
const LoadingFallback = () => (
  <div
    style={{
      height: "100vh",
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}>
    <Spin />
  </div>
)

const prefetchRoutes = () => {
  // Prefetch common routes
  import("@/pages/login")
  import("@/pages/home")
  import("@/pages/library")
  import("@/pages/resource")
  import("@/pages/project")
  import("@/pages/conv-library")
  import("@/pages/conv-item")
  import("@/pages/skill")
  import("@/pages/skill-detail")
  import("@/pages/settings")
  import("@/pages/share-content")
  import("@refly-packages/ai-workspace-common/components/request-access/index")
}

export const AppRouter = (props: { layout?: any }) => {
  const { layout: Layout } = props
  const userStore = useUserStoreShallow(state => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }))

  // Get storage user profile
  const storageUserProfile = safeParseJSON(
    localStorage.getItem("refly-user-profile"),
  )
  const notShowLoginBtn = storageUserProfile?.uid || userStore?.userProfile?.uid

  // Get locale settings
  const storageLocalSettings = safeParseJSON(
    localStorage.getItem("refly-local-settings"),
  )

  const locale =
    storageLocalSettings?.uiLocale ||
    userStore?.localSettings?.uiLocale ||
    LOCALE.EN

  useEffect(() => {
    prefetchRoutes()
  }, [])

  // Check user login status
  useGetUserSettings()

  // Globally handle editor emitter events
  useHandleEditorEmitter()

  // Change locale if not matched
  const { i18n } = useTranslation()
  useEffect(() => {
    if (locale && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [i18n, locale])

  const routeLogin = useMatch("/")

  const isShareContent = useMatch("/share/:shareCode")

  if (!isShareContent) {
    if (
      !userStore.isCheckingLoginStatus === undefined ||
      userStore.isCheckingLoginStatus
    ) {
      return <LoadingFallback />
    }

    if (!notShowLoginBtn && !routeLogin) {
      return <LoadingFallback />
    }
  }

  const hasBetaAccess = userStore?.isLogin
    ? userStore?.userProfile?.hasBetaAccess || false
    : true

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <BetaProtectedRoute
                component={Home}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />

          <Route
            path="/library"
            element={
              <BetaProtectedRoute
                component={Library}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/resource/:resId"
            element={
              <BetaProtectedRoute
                component={Resource}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <BetaProtectedRoute
                component={Project}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/thread"
            element={
              <BetaProtectedRoute
                component={ConvLibrary}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/thread/:convId"
            element={
              <BetaProtectedRoute
                component={ConvItem}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/skill"
            element={
              <BetaProtectedRoute
                component={Skill}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/skill-detail"
            element={
              <BetaProtectedRoute
                component={SkillDetailPage}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <BetaProtectedRoute
                component={Settings}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/request-access"
            element={<RequestAccessRoute hasBetaAccess={hasBetaAccess} />}
          />
          <Route path="/share/:shareCode" element={<ShareContent />} />
        </Routes>
      </Layout>
    </Suspense>
  )
}
