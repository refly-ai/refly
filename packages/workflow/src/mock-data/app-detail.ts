import { App } from "@/types/app"

export const mockAppDetail = {
  id: "c8aadf44-94be-4dee-9d36-d0a093392f55",
  name: "工作流",
  description: "",
  mode: "advanced-chat",
  icon: "🤖",
  icon_background: "#FFEAD5",
  model_config: undefined,
  created_at: 1719465972,

  /** Enable web app */
  enable_site: true,
  /** Enable web API */
  enable_api: true,
  /** API requests per minute, default is 60 */
  api_rpm: 60,
  /** API requests per hour, default is 3600 */
  api_rph: 3600,
  /** Whether it's a demo app */
  is_demo: false,
  /** Model configuration */
  app_model_config: undefined,
  /** Timestamp of creation */
  /** Web Application Configuration */
  site: {},
  /** api site url */
  api_base_url: "http://localhost:3000",
  tags: [
    {
      id: "123",
      name: "test-tag",
      type: "test-tag-type",
      binding_count: 10,
    },
  ],
} as Partial<App>
