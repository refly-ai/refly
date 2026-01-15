import { lazy } from 'react';

// use case: lazy load page
export const LazyDebugPage = lazy(() =>
  import('./pages/debug').then((module) => ({
    default: module.DebugPage,
  })),
);

export const UnsignedFrontPage = lazy(
  () => import(/* webpackChunkName: "page-home" */ './pages/home-new'),
);
export const Pricing = lazy(() => import(/* webpackChunkName: "page-pricing" */ './pages/pricing'));
export const LoginPage = lazy(
  () => import(/* webpackChunkName: "page-login" */ './pages/login/index'),
);
export const ShareCanvasPage = lazy(
  () => import(/* webpackChunkName: "page-share-canvas" */ './pages/share'),
);
export const ShareCodePage = lazy(
  () => import(/* webpackChunkName: "page-share-code" */ './pages/code-share'),
);
export const SharePagePage = lazy(
  () => import(/* webpackChunkName: "page-share-page" */ './pages/page-share'),
);
export const WorkflowAppPage = lazy(
  () => import(/* webpackChunkName: "page-workflow-app" */ './pages/workflow-app'),
);
export const TemplatePreviewPage = lazy(
  () => import(/* webpackChunkName: "page-template-preview" */ './pages/template-preview'),
);
export const SkillResponseSharePage = lazy(
  () => import(/* webpackChunkName: "page-skill-response-share" */ './pages/skill-response-share'),
);
export const DocumentSharePage = lazy(
  () => import(/* webpackChunkName: "page-document-share" */ './pages/document-share'),
);
export const DriveFileSharePage = lazy(
  () => import(/* webpackChunkName: "page-drive-file-share" */ './pages/drive-file-share'),
);
export const ProjectPage = lazy(
  () => import(/* webpackChunkName: "page-project" */ './pages/project'),
);
export const WorkflowListPage = lazy(
  () => import(/* webpackChunkName: "page-workflow-list" */ './pages/workflow-list'),
);
export const AppManager = lazy(
  () => import(/* webpackChunkName: "page-app-manager" */ './pages/app-manager'),
);
export const MarketplacePage = lazy(
  () => import(/* webpackChunkName: "page-marketplace" */ './pages/marketplace'),
);
export const WorkflowPage = lazy(
  () => import(/* webpackChunkName: "page-workflow" */ './pages/workflow'),
);
export const WorkspacePage = lazy(
  () => import(/* webpackChunkName: "page-workspace" */ './pages/workspace'),
);
export const RunHistoryPage = lazy(
  () => import(/* webpackChunkName: "page-run-history" */ './pages/run-history'),
);
export const RunDetailPage = lazy(
  () => import(/* webpackChunkName: "page-run-detail" */ './pages/run-detail'),
);
export const CliAuthPage = lazy(
  () => import(/* webpackChunkName: "page-cli-auth" */ './pages/cli-auth'),
);

export { AppLayout, LazyErrorBoundary } from './components/layout';

export { setupI18n } from './effect/i18n';
export { setupSentry } from './effect/monitor';
