import { lazy } from 'react';

// use case: lazy load page
export const LazyDebugPage = lazy(() =>
  import('./pages/debug').then((module) => ({
    default: module.DebugPage,
  })),
);

export const UnsignedFrontPage = lazy(() => import('./pages/home-new'));
export const CanvasPage = lazy(() => import('./pages/canvas'));
export const Pricing = lazy(() => import('./pages/pricing'));
export const ShareCanvasPage = lazy(() => import('./pages/share'));
export const ShareCodePage = lazy(() => import('./pages/code-share'));
export const SharePagePage = lazy(() => import('./pages/page-share'));
export const WorkflowAppPage = lazy(() => import('./pages/workflow-app'));
export const TemplatePreviewPage = lazy(() => import('./pages/template-preview'));
export const SkillResponseSharePage = lazy(() => import('./pages/skill-response-share'));
export const DocumentSharePage = lazy(() => import('./pages/document-share'));
export const ArtifactGalleryPage = lazy(() => import('./pages/artifact-gallery'));
export const UseCasesGalleryPage = lazy(() => import('./pages/use-cases-gallery'));
export const ProjectPage = lazy(() => import('./pages/project'));
export const WorkflowListPage = lazy(() => import('./pages/workflow-list'));
export const AppManager = lazy(() => import('./pages/app-manager'));
export const MarketplacePage = lazy(() => import('./pages/marketplace'));
export const WorkflowPage = lazy(() => import('./pages/workflow'));
export const WorkspacePage = lazy(() => import('./pages/workspace'));

export { AppLayout } from './components/layout';

export { setupI18n } from './effect/i18n';
export { setupSentry } from './effect/monitor';
