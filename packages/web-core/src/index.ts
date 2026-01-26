import { lazy } from 'react';

// ========== Intelligent grouping strategy ==========
// Grouping based on page dependency similarity and user behavior patterns
// Goals: Reduce duplicate bundling, optimize cache hit rate, accelerate page transitions

// use case: lazy load page
export const LazyDebugPage = lazy(() =>
  import('./pages/debug').then((module) => ({
    default: module.DebugPage,
  })),
);

// ========== Group 1: Auth (Authentication pages - Independent and lightweight) ==========
// Features: Simple pages, only need basic components, don't need large libraries like Ant Design
// Estimated size: ~190 KB
export const LoginPage = lazy(
  () => import(/* webpackChunkName: "group-auth" */ './pages/login/index'),
);
export const CliAuthPage = lazy(
  () => import(/* webpackChunkName: "group-auth" */ './pages/cli-auth'),
);

// ========== Group 2: Workspace Core (Core workspace - Frequent switching) ==========
// Features: User's most frequently used core functions, frequent switching between these pages
// Shared dependencies: Ant Design, Monaco Editor, chart libraries, state management
// Estimated size: ~1500 KB (but 0 download when switching)
// Note: Prefetch is handled conditionally after login, not globally
export const WorkspacePage = lazy(
  () => import(/* webpackChunkName: "group-workspace" */ './pages/workspace'),
);
export const WorkflowPage = lazy(
  () => import(/* webpackChunkName: "group-workflow" */ './pages/workflow'),
);
export const ToolInstallPage = lazy(
  () => import(/* webpackChunkName: "group-workflow" */ './pages/tool-install'),
);

// ========== Group 3: Share (Share/View pages) ==========
// Features: Public share pages, need viewer components but no editing functionality
// Shared dependencies: Viewer components, partial Ant Design components
// Estimated size: ~700 KB
// Note: ShareCanvasPage and WorkflowPage use similar components, but different purposes (view vs edit)
export const ShareCanvasPage = lazy(
  () => import(/* webpackChunkName: "group-share" */ './pages/share'),
);
export const ShareCodePage = lazy(
  () => import(/* webpackChunkName: "group-share" */ './pages/code-share'),
);
export const SharePagePage = lazy(
  () => import(/* webpackChunkName: "group-share" */ './pages/page-share'),
);
export const SkillResponseSharePage = lazy(
  () => import(/* webpackChunkName: "group-share" */ './pages/skill-response-share'),
);
export const DocumentSharePage = lazy(
  () => import(/* webpackChunkName: "group-share-file" */ './pages/document-share'),
);
export const DriveFileSharePage = lazy(
  () => import(/* webpackChunkName: "group-share-file" */ './pages/drive-file-share'),
);

// ========== Group 4: Workflow Public (Public workflow pages) ==========
// Features: Public workflow-related pages, need Ant Design but not editors
// Shared dependencies: Partial Ant Design components, list/card components
// Estimated size: ~900 KB
export const WorkflowAppPage = lazy(
  () => import(/* webpackChunkName: "group-workflow-public" */ './pages/workflow-app'),
);
export const WorkflowListPage = lazy(
  () => import(/* webpackChunkName: "group-workflow-public" */ './pages/workflow-list'),
);
export const AppManager = lazy(
  () => import(/* webpackChunkName: "group-workflow-public" */ './pages/app-manager'),
);
export const MarketplacePage = lazy(
  () => import(/* webpackChunkName: "group-workflow-public" */ './pages/marketplace'),
);
export const TemplatePreviewPage = lazy(
  () => import(/* webpackChunkName: "group-workflow-public" */ './pages/template-preview'),
);

// ========== Group 5: Run History (Run history) ==========
// Features: View run records, mainly uses table components
// Shared dependencies: Ant Design Table, time processing
// Estimated size: ~550 KB
export const RunHistoryPage = lazy(
  () => import(/* webpackChunkName: "group-run" */ './pages/run-history'),
);
export const RunDetailPage = lazy(
  () => import(/* webpackChunkName: "group-run" */ './pages/run-detail'),
);

// ========== Group 6: Landing (Marketing/Homepage) ==========
// Features: Marketing pages, need animation effects, don't need business components
// Shared dependencies: Animation libraries (framer-motion, AOS)
// Estimated size: ~500 KB
export const UnsignedFrontPage = lazy(
  () => import(/* webpackChunkName: "group-landing" */ './pages/home-new'),
);
export const Pricing = lazy(
  () => import(/* webpackChunkName: "group-landing" */ './pages/pricing'),
);

export { AppLayout, LazyErrorBoundary } from './components/layout';

export { setupI18n } from './effect/i18n';
export { setupSentry } from './effect/monitor';
