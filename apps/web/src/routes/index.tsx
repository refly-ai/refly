import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy load all components, including redirect components
const HomeRedirect = lazy(() =>
  import('@refly-packages/ai-workspace-common/components/home-redirect').then((m) => ({
    default: m.HomeRedirect,
  })),
);
const BackendRedirect = lazy(
  () => import('@refly-packages/ai-workspace-common/components/backend-redirect'),
);
const InviteRedirect = lazy(() =>
  import('@refly-packages/ai-workspace-common/components/invite-redirect').then((m) => ({
    default: m.InviteRedirect,
  })),
);

// Lazy load redirect components
const CanvasRedirect = lazy(() =>
  import('./redirects').then((m) => ({ default: m.CanvasRedirect })),
);
const WorkspaceRedirect = lazy(() =>
  import('./redirects').then((m) => ({ default: m.WorkspaceRedirect })),
);
const ProtectedRoute = lazy(() =>
  import('./redirects').then((m) => ({ default: m.ProtectedRoute })),
);

// Components imported from web-core are already lazy-loaded
import {
  Pricing,
  ShareCanvasPage,
  ShareCodePage,
  SkillResponseSharePage,
  DocumentSharePage,
  DriveFileSharePage,
  WorkflowAppPage,
  WorkflowListPage,
  AppManager,
  MarketplacePage,
  WorkflowPage,
  ToolInstallPage,
  WorkspacePage,
  LoginPage,
  RunHistoryPage,
  RunDetailPage,
  CliAuthPage,
} from '@refly/web-core';

export const RoutesList: RouteObject[] = [
  // TODO: deprecated and navigate to framer page
  {
    path: '/',
    element: <HomeRedirect defaultNode={<BackendRedirect />} />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/cli/auth',
    element: <CliAuthPage />,
  },
  {
    path: '/invite',
    element: <InviteRedirect />,
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
    path: '/share/file/:shareId',
    element: <DriveFileSharePage />,
  },

  // Deprecated routes - redirect to new routes
  // TODO: deprecated and navigate to /workspace
  {
    path: '/share/pages/:shareId',
    element: <WorkspaceRedirect />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/preview/canvas/:shareId',
    element: <WorkspaceRedirect />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/canvas/',
    element: <WorkspaceRedirect />,
  },
  // TODO: deprecated and navigate to /workflow/:workflowId
  {
    path: '/canvas/:canvasId',
    element: <CanvasRedirect />,
  },
  // TODO: deprecated and navigate to /workflow-template/:shareId
  {
    path: '/app/:shareId',
    element: <WorkflowAppPage />,
  },
  {
    path: '/workflow-list',
    element: <WorkflowListPage />,
  },
  {
    path: '/run-history',
    element: (
      <ProtectedRoute>
        <RunHistoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/run-history/:recordId',
    element: (
      <ProtectedRoute>
        <RunDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/app-manager',
    element: <AppManager />,
  },
  {
    path: '/marketplace',
    element: <MarketplacePage />,
  },
  // New SEO-optimized routes
  {
    path: '/workspace',
    element: (
      <ProtectedRoute>
        <WorkspacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workflow/:workflowId',
    element: <WorkflowPage />,
  },
  {
    path: '/workflow/:workflowId/install-tools',
    element: (
      <ProtectedRoute>
        <ToolInstallPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workflow-template/:shareId',
    element: <WorkflowAppPage />,
  },
];
