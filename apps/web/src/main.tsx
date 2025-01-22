import "./utils/dom-patch"

import React, { Suspense, useEffect, lazy } from "react"
import { ConfigProvider } from "antd"
import ReactDOM from "react-dom/client"
import {
  createBrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
  RouterProvider,
  Outlet,
} from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@refly-packages/ai-workspace-common/utils/request"

// Import AppRouter lazily
const AppRouter = lazy(() =>
  import("./routes/index").then(module => ({ default: module.AppRouter })),
)
// Import AppLayout lazily
const AppLayout = lazy(() =>
  import("@/components/layout/index").then(module => ({
    default: module.AppLayout,
  })),
)

import "@refly-packages/ai-workspace-common/i18n/config"
import {
  getEnv,
  setRuntime,
} from "@refly-packages/ai-workspace-common/utils/env"
import { useUserStoreShallow } from "@refly-packages/ai-workspace-common/stores/user"
import { SuspenseLoading } from "@refly-packages/ai-workspace-common/components/common/loading"

// styles
import "@/styles/style.css"

setRuntime("web")

// Move Sentry initialization to a separate function
const initSentry = async () => {
  if (process.env.NODE_ENV !== "development") {
    const Sentry = await import("@sentry/react")
    Sentry.init({
      dsn: "https://a687291d5ba3a77b0fa559e6d197eac8@o4507205453414400.ingest.us.sentry.io/4507208398602240",
      environment: getEnv(),
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
      ],
      // Reduce sampling rates to minimize performance impact
      tracesSampleRate: 0.1, // Reduce from 1.0 to 0.1 (10% sampling)
      tracePropagationTargets: ["localhost", "https://refly.ai"],
      // Session Replay
      replaysSessionSampleRate: 0.05, // Reduce from 0 to 0.05 (5% sampling)
      replaysOnErrorSampleRate: 0.2, // Reduce from 1.0 to 0.2 (20% sampling on errors)
    })
  }
}

// Call Sentry initialization
initSentry()

// Update App component to remove Suspense (moved to router definition)
export const App = () => {
  const setRuntime = useUserStoreShallow(state => state.setRuntime)

  useEffect(() => {
    setRuntime("web")
  }, [setRuntime])

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#00968F",
          borderRadius: 6,
          controlItemBgActive: "#f1f1f0",
          controlItemBgActiveHover: "#e0e0e0",
        },
      }}>
      <Outlet />
    </ConfigProvider>
  )
}

// Update router creation to use createBrowserRouter with proper route definitions
const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
    children: [
      {
        path: "*",
        async loader() {
          await Promise.all([
            import("./routes/index"),
            import("@/components/layout/index"),
          ])
          return null
        },
        element: (
          <Suspense fallback={<SuspenseLoading />}>
            <AppRouter layout={AppLayout} />
          </Suspense>
        ),
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
)
