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
  // TODO: deprecated and navigate to framer page
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

  // TODO: deprecated and navigate to /workspace
  {
    path: '/share/pages/:shareId',
    element: <SharePagePage />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/artifact-gallery',
    element: <ArtifactGalleryPage />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/use-cases-gallery',
    element: <UseCasesGalleryPage />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/preview/canvas/:shareId',
    element: <TemplatePreviewPage />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/canvas/',
    element: <Navigate to="/canvas/empty" replace />,
  },
  // TODO: deprecated and navigate to /workflow/:workflowId'
  {
    path: '/canvas/:canvasId',
    element: <CanvasPage />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/project/:projectId',
    element: <ProjectPage />,
  },
  // TODO: deprecated to migrate to SSR project
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
