import { HomeRedirect } from '@refly-packages/ai-workspace-common/components/home-redirect';
import BackendRedirect from '@refly-packages/ai-workspace-common/components/backend-redirect';
import { InviteRedirect } from '@refly-packages/ai-workspace-common/components/invite-redirect';
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
  WorkspacePage,
  LoginPage,
} from '@refly/web-core';

import type { RouteObject } from 'react-router-dom';
import { CanvasRedirect, WorkspaceRedirect, ProtectedRoute } from './redirects';

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
    path: '/artifact-gallery',
    element: <WorkspaceRedirect />,
  },
  // TODO: deprecated and navigate to /workspace
  {
    path: '/use-cases-gallery',
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
  // TODO: deprecated and navigate to /workspace
  {
    path: '/project/:projectId',
    element: <WorkspaceRedirect />,
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
    path: '/workflow-template/:shareId',
    element: <WorkflowAppPage />,
  },
];
