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
} from '@refly/web-core';
import VariableExtractionTestPage from '../pages/variable-extraction-test';

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
    path: '/test/variable-extraction',
    element: <VariableExtractionTestPage />,
  },
];
