import { Navigate } from 'react-router-dom';
import { HomeRedirect } from '@refly-packages/ai-workspace-common/components/home-redirect';
import {
  UnsignedFrontPage,
  CanvasPage,
  Pricing,
  ShareCanvasPage,
  ShareCodePage,
  SharePagePage,
  TemplatePreviewPage,
  SkillResponseSharePage,
  DocumentSharePage,
  ArtifactGalleryPage,
  UseCasesGalleryPage,
  ProjectPage,
  WorkflowAppPage,
  WorkflowListPage,
  AppManager,
  WorkflowPage,
  WorkspacePage,
} from '@refly/web-core';

import type { RouteObject } from 'react-router-dom';

export const RoutesList: RouteObject[] = [
  {
    path: '/',
    element: <HomeRedirect defaultNode={<UnsignedFrontPage />} />,
  },
  {
    path: '/pricing',
    element: <Pricing />,
  },
  {
    path: '/share/canvas/:canvasId',
    element: <ShareCanvasPage />,
  },
  {
    path: '/share/code/:shareId',
    element: <ShareCodePage />,
  },
  {
    path: '/share/answer/:shareId',
    element: <SkillResponseSharePage />,
  },
  {
    path: '/share/doc/:shareId',
    element: <DocumentSharePage />,
  },
  {
    path: '/share/pages/:shareId',
    element: <SharePagePage />,
  },
  {
    path: '/artifact-gallery',
    element: <ArtifactGalleryPage />,
  },
  {
    path: '/use-cases-gallery',
    element: <UseCasesGalleryPage />,
  },
  {
    path: '/preview/canvas/:shareId',
    element: <TemplatePreviewPage />,
  },
  {
    path: '/canvas/',
    element: <Navigate to="/canvas/empty" replace />,
  },
  {
    path: '/canvas/:canvasId',
    element: <CanvasPage />,
  },
  {
    path: '/project/:projectId',
    element: <ProjectPage />,
  },
  {
    path: '/app/:shareId',
    element: <WorkflowAppPage />,
  },
  {
    path: '/workflow-list',
    element: <WorkflowListPage />,
  },
  {
    path: '/app-manager',
    element: <AppManager />,
  },
  // New SEO-optimized routes
  {
    path: '/workspace',
    element: <WorkspacePage />,
  },
  {
    path: '/workflow/:workflowId',
    element: <WorkflowPage />,
  },
];
