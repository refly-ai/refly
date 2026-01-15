import { lazy } from 'react';

// ========== 智能分组策略 ==========
// 基于页面依赖相似度和用户行为模式的分组
// 目标：减少重复打包，优化缓存命中率，加快页面切换速度

// use case: lazy load page
export const LazyDebugPage = lazy(() =>
  import('./pages/debug').then((module) => ({
    default: module.DebugPage,
  })),
);

// ========== Group 1: Auth（认证页面 - 独立轻量）==========
// 特点：简单页面，只需基础组件，不需要 Ant Design 等大型库
// 预估体积：~190 KB
export const LoginPage = lazy(
  () => import(/* webpackChunkName: "group-auth" */ './pages/login/index'),
);
export const CliAuthPage = lazy(
  () => import(/* webpackChunkName: "group-auth" */ './pages/cli-auth'),
);

// ========== Group 2: Workspace Core（核心工作区 - 频繁切换）==========
// 特点：用户最常用的核心功能，频繁在这些页面间切换
// 共享依赖：Ant Design, Monaco Editor, 图表库, 状态管理
// 预估体积：~1500 KB（但切换时 0 下载）
export const WorkspacePage = lazy(
  () => import(/* webpackChunkName: "group-workspace" */ './pages/workspace'),
);
export const WorkflowPage = lazy(
  () => import(/* webpackChunkName: "group-workflow" */ './pages/workflow'),
);

// ========== Group 3: Share（分享/查看页面）==========
// 特点：公开分享的页面，需要查看器组件但不需要编辑功能
// 共享依赖：查看器组件，部分 Ant Design 组件
// 预估体积：~700 KB
// Note: ShareCanvasPage 和 WorkflowPage 使用类似组件，但用途不同（查看 vs 编辑）
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
  () => import(/* webpackChunkName: "group-share" */ './pages/document-share'),
);
export const DriveFileSharePage = lazy(
  () => import(/* webpackChunkName: "group-share" */ './pages/drive-file-share'),
);

// ========== Group 4: Workflow Public（公开工作流页面）==========
// 特点：公开的工作流相关页面，需要 Ant Design 但不需要编辑器
// 共享依赖：Ant Design 部分组件，列表/卡片组件
// 预估体积：~900 KB
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

// ========== Group 5: Run History（运行历史）==========
// 特点：查看运行记录，主要使用表格组件
// 共享依赖：Ant Design Table, 时间处理
// 预估体积：~550 KB
export const RunHistoryPage = lazy(
  () => import(/* webpackChunkName: "group-run" */ './pages/run-history'),
);
export const RunDetailPage = lazy(
  () => import(/* webpackChunkName: "group-run" */ './pages/run-detail'),
);

// ========== Group 6: Landing（营销/首页）==========
// 特点：营销页面，需要动画效果，不需要业务组件
// 共享依赖：动画库（framer-motion, AOS）
// 预估体积：~500 KB
export const UnsignedFrontPage = lazy(
  () => import(/* webpackChunkName: "group-landing" */ './pages/home-new'),
);
export const Pricing = lazy(
  () => import(/* webpackChunkName: "group-landing" */ './pages/pricing'),
);

// ========== 暂时未使用的页面（单独分组）==========
// ProjectPage 当前未被路由引用，保持独立
export const ProjectPage = lazy(
  () => import(/* webpackChunkName: "page-project" */ './pages/project'),
);

export { AppLayout, LazyErrorBoundary } from './components/layout';

export { setupI18n } from './effect/i18n';
export { setupSentry } from './effect/monitor';
