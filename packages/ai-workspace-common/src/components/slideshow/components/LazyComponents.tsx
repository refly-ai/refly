import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

// Loading component
const LoadingComponent = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8 h-full">
      <Spin tip={t('common.loading')} />
    </div>
  );
};

// 统一使用命名导出方式的懒加载组件
export const LazyCodeArtifactRenderer = lazy(() =>
  import('./CodeArtifactRenderer').then((module) => ({
    default: module.CodeArtifactRenderer,
  })),
);

export const LazyDocumentRenderer = lazy(() =>
  import('./DocumentRenderer').then((module) => ({
    default: module.DocumentRenderer,
  })),
);

export const LazyVideoRenderer = lazy(() =>
  import('./VideoRenderer').then((module) => ({
    default: module.VideoRenderer,
  })),
);

export const LazyImageRenderer = lazy(() =>
  import('./ImageRenderer').then((module) => ({
    default: module.ImageRenderer,
  })),
);

export const LazyMemoRenderer = lazy(() =>
  import('./MemoRenderer').then((module) => ({
    default: module.MemoRenderer,
  })),
);

export const LazyResourceRenderer = lazy(() =>
  import('./ResourceRenderer').then((module) => ({
    default: module.ResourceRenderer,
  })),
);

export const LazyWebsiteRenderer = lazy(() =>
  import('./WebsiteRenderer').then((module) => ({
    default: module.WebsiteRenderer,
  })),
);

// Wrapper component with Suspense
interface WithSuspenseProps {
  children: React.ReactNode;
}

// The WithSuspense component should directly render the Suspense component with its children
export const WithSuspense: React.FC<WithSuspenseProps> = ({ children }) => (
  <Suspense fallback={<LoadingComponent />}>{children}</Suspense>
);
