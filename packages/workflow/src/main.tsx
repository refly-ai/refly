import React, { Suspense, useEffect } from "react"
import ReactDOM from "react-dom/client"
import {
  BrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom"
import { AppRouter } from "./routes/index"
import { AppLayout } from "@refly/ai-workspace-common/components/layout/index"

// 导入 i18n
import "@refly/ai-workspace-common/i18n/config"
import { Spin } from "@arco-design/web-react"
import { getEnv, setRuntime } from "@refly/ai-workspace-common/utils/env"
import { useUserStore } from "../../../packages/ai-workspace-common/src/stores/user"

setRuntime("web")
// dev for disable sentry as it will overload console.log result worse dev experience
if (process.env.NODE_ENV !== "development") {
  import("@sentry/react").then(Sentry => {
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
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", "https://refly.ai"],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    })
  })
}

export const App = () => {
  const userStore = useUserStore()

  useEffect(() => {
    setRuntime("web")
    userStore.setRuntime("web")
  }, [])

  return (
    <Suspense fallback={<Spin style={{ margin: "200px auto" }} />}>
      <BrowserRouter>
        <AppRouter layout={AppLayout} />
      </BrowserRouter>
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
