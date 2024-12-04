import { lazy, Suspense } from "react"
import { Route, Routes, useMatch } from "react-router-dom"
import { useEffect } from "react"
import { safeParseJSON } from "@refly-packages/ai-workspace-common/utils/parse"
import { useUserStoreShallow } from "@refly-packages/ai-workspace-common/stores/user"
import { useTranslation } from "react-i18next"
import { useGetUserSettings } from "@refly-packages/ai-workspace-common/hooks/use-get-user-settings"
import { LOCALE } from "@refly/common-types"
import {
  BetaProtectedRoute,
  RequestAccessRoute,
} from "@refly-packages/ai-workspace-common/components/request-access/protected-route"
import { useHandleUrlParamsCallback } from "@refly-packages/ai-workspace-common/hooks/use-handle-url-params-callback"
import { SuspenseLoading } from "@refly-packages/ai-workspace-common/components/common/loading"
import { HomeRedirect } from "@refly-packages/ai-workspace-common/components/home-redirect"
// Lazy load components
const Home = lazy(() => import("@/pages/home"))
const Canvas = lazy(() => import("@/pages/canvas"))

const prefetchRoutes = () => {
  // Prefetch common routes
  import("@/pages/login")
  import("@/pages/home")
  import("@/pages/canvas")
  import("@/pages/library")
  import("@/pages/conv-library")
  import("@/pages/conv-item")
  import("@/pages/skill")
  import("@/pages/skill-detail")
  import("@/pages/settings")
  import("@/pages/share-content")
  import("@refly-packages/ai-workspace-common/components/request-access")
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

  // Change locale if not matched
  const { i18n } = useTranslation()
  useEffect(() => {
    if (locale && i18n.languages?.[0] !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [i18n, locale])

  // Handle payment callback
  useHandleUrlParamsCallback()

  const routeLogin = useMatch("/")

  const isShareContent = useMatch("/share/:shareCode")

  if (!isShareContent) {
    if (
      !userStore.isCheckingLoginStatus === undefined ||
      userStore.isCheckingLoginStatus
    ) {
      return <SuspenseLoading />
    }

    if (!notShowLoginBtn && !routeLogin) {
      return <SuspenseLoading />
    }
  }

  const hasBetaAccess = userStore?.isLogin
    ? userStore?.userProfile?.hasBetaAccess || false
    : true

  return (
    <Suspense fallback={<SuspenseLoading />}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeRedirect defaultNode={<Home />} />} />

          <Route
            path="/canvas/:canvasId"
            element={
              <BetaProtectedRoute
                component={Canvas}
                hasBetaAccess={hasBetaAccess}
              />
            }
          />
          <Route
            path="/request-access"
            element={<RequestAccessRoute hasBetaAccess={hasBetaAccess} />}
          />
          {/* <Route path="/share/:shareCode" element={<ShareContent />} /> */}
        </Routes>
      </Layout>
    </Suspense>
  )
}
